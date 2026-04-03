package osv

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const bucketURLTemplate = "https://osv-vulnerabilities.storage.googleapis.com/%s/all.zip"

var defaultEcosystems = []string{
	"Go", "npm", "PyPI", "Maven", "crates.io", "NuGet", "Packagist", "RubyGems",
}

type OSVSyncer struct {
	pool       *pgxpool.Pool
	client     *http.Client
	ecosystems []string
}

func NewSyncer(pool *pgxpool.Pool) *OSVSyncer {
	return &OSVSyncer{
		pool:       pool,
		client:     &http.Client{Timeout: 10 * time.Minute},
		ecosystems: defaultEcosystems,
	}
}

func (s *OSVSyncer) Name() string { return "osv" }

func (s *OSVSyncer) Sync(ctx context.Context) error {
	totalUpserted := 0

	for _, eco := range s.ecosystems {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		count, err := s.syncEcosystem(ctx, eco)
		if err != nil {
			slog.Error("OSV sync: ecosystem failed", "ecosystem", eco, "error", err)
			continue
		}
		totalUpserted += count
	}

	slog.Info("OSV sync: completed all ecosystems", "total_upserted", totalUpserted)
	return nil
}

func (s *OSVSyncer) syncEcosystem(ctx context.Context, ecosystem string) (int, error) {
	url := fmt.Sprintf(bucketURLTemplate, ecosystem)
	slog.Info("OSV sync: downloading ecosystem", "ecosystem", ecosystem, "url", url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read body: %w", err)
	}

	records, skipped, err := parseZIP(body, ecosystem)
	if err != nil {
		return 0, fmt.Errorf("parse zip: %w", err)
	}

	if skipped > 0 {
		slog.Warn("OSV sync: skipped entries", "ecosystem", ecosystem, "skipped", skipped)
	}

	slog.Info("OSV sync: parsed entries", "ecosystem", ecosystem, "count", len(records))

	// Upsert пачками по 5000
	const batchSize = 5000
	upserted := 0
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		if err := s.upsertBatch(ctx, records[i:end]); err != nil {
			return upserted, fmt.Errorf("upsert batch at %d: %w", i, err)
		}
		upserted += end - i

		slog.Info("OSV sync: progress",
			"ecosystem", ecosystem,
			"upserted", upserted,
			"total", len(records),
		)
	}

	return upserted, nil
}

// --- OSV JSON structures ---

type osvEntry struct {
	ID        string          `json:"id"`
	Summary   string          `json:"summary"`
	Details   string          `json:"details"`
	Aliases   []string        `json:"aliases"`
	Affected  []osvAffected   `json:"affected"`
	Severity  json.RawMessage `json:"severity"`
	References json.RawMessage `json:"references"`
	Published string          `json:"published"`
	Modified  string          `json:"modified"`
}

type osvAffected struct {
	Package osvPackage      `json:"package"`
	Ranges  json.RawMessage `json:"ranges"`
}

type osvPackage struct {
	Ecosystem string `json:"ecosystem"`
	Name      string `json:"name"`
}

// --- Parsed record ---

type osvRecord struct {
	OSVID          string
	Summary        string
	Details        string
	Aliases        []string
	Ecosystem      string
	PackageName    string
	AffectedRanges []byte // JSON
	Severity       []byte // JSON
	References     []byte // JSON
	PublishedAt    *time.Time
	ModifiedAt     *time.Time
}

func parseZIP(data []byte, ecosystem string) ([]osvRecord, int, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, 0, fmt.Errorf("open zip: %w", err)
	}

	records := make([]osvRecord, 0, len(r.File))
	skipped := 0

	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			slog.Debug("OSV: failed to open file in zip", "file", f.Name, "error", err)
			skipped++
			continue
		}

		fileData, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			slog.Debug("OSV: failed to read file in zip", "file", f.Name, "error", err)
			skipped++
			continue
		}

		rec, err := parseEntry(fileData, ecosystem)
		if err != nil {
			slog.Debug("OSV: failed to parse entry", "file", f.Name, "error", err)
			skipped++
			continue
		}

		records = append(records, rec)
	}

	return records, skipped, nil
}

func parseEntry(data []byte, ecosystem string) (osvRecord, error) {
	var entry osvEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return osvRecord{}, fmt.Errorf("unmarshal: %w", err)
	}

	if entry.ID == "" {
		return osvRecord{}, fmt.Errorf("empty ID")
	}

	rec := osvRecord{
		OSVID:     entry.ID,
		Summary:   entry.Summary,
		Details:   entry.Details,
		Aliases:   entry.Aliases,
		Ecosystem: ecosystem,
	}

	// Package name и affected ranges — берём из первого affected
	if len(entry.Affected) > 0 {
		rec.PackageName = entry.Affected[0].Package.Name
		// Собираем все ranges в единый JSON-массив
		allRanges := collectRanges(entry.Affected)
		if len(allRanges) > 0 {
			rec.AffectedRanges = allRanges
		}
	}

	// severity и references — raw JSON
	if len(entry.Severity) > 0 && string(entry.Severity) != "null" {
		rec.Severity = entry.Severity
	}
	if len(entry.References) > 0 && string(entry.References) != "null" {
		rec.References = entry.References
	}

	rec.PublishedAt = parseOSVTime(entry.Published)
	rec.ModifiedAt = parseOSVTime(entry.Modified)

	return rec, nil
}

func collectRanges(affected []osvAffected) []byte {
	var all []json.RawMessage
	for _, a := range affected {
		if len(a.Ranges) > 0 && string(a.Ranges) != "null" {
			all = append(all, a.Ranges)
		}
	}
	if len(all) == 0 {
		return nil
	}
	data, _ := json.Marshal(all)
	return data
}

func parseOSVTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	for _, layout := range []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
	} {
		t, err := time.Parse(layout, s)
		if err == nil {
			return &t
		}
	}
	return nil
}

func (s *OSVSyncer) upsertBatch(ctx context.Context, records []osvRecord) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE osv_staging (
			osv_id          TEXT NOT NULL,
			summary         TEXT,
			details         TEXT,
			aliases         TEXT[],
			ecosystem       TEXT,
			package_name    TEXT,
			affected_ranges JSONB,
			severity        JSONB,
			refs            JSONB,
			published_at    TIMESTAMPTZ,
			modified_at     TIMESTAMPTZ
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.OSVID,
			rec.Summary,
			rec.Details,
			rec.Aliases,
			rec.Ecosystem,
			rec.PackageName,
			jsonbOrNull(rec.AffectedRanges),
			jsonbOrNull(rec.Severity),
			jsonbOrNull(rec.References),
			rec.PublishedAt,
			rec.ModifiedAt,
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"osv_staging"},
		[]string{"osv_id", "summary", "details", "aliases", "ecosystem",
			"package_name", "affected_ranges", "severity", "refs",
			"published_at", "modified_at"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO osv_vulnerabilities (osv_id, summary, details, aliases, ecosystem,
		                                  package_name, affected_ranges, severity,
		                                  "references", published_at, modified_at, synced_at)
		SELECT osv_id, summary, details, aliases, ecosystem,
		       package_name, affected_ranges, severity,
		       refs, published_at, modified_at, now()
		FROM osv_staging
		ON CONFLICT (osv_id) DO UPDATE
		SET summary         = EXCLUDED.summary,
		    details         = EXCLUDED.details,
		    aliases         = EXCLUDED.aliases,
		    ecosystem       = EXCLUDED.ecosystem,
		    package_name    = EXCLUDED.package_name,
		    affected_ranges = EXCLUDED.affected_ranges,
		    severity        = EXCLUDED.severity,
		    "references"    = EXCLUDED."references",
		    published_at    = EXCLUDED.published_at,
		    modified_at     = EXCLUDED.modified_at,
		    synced_at       = now()
	`)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	return tx.Commit(ctx)
}

func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}
