package osv

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	bucketURLTemplate = "https://osv-vulnerabilities.storage.googleapis.com/%s/all.zip"
	syncBatchSize     = 2000
)

var defaultEcosystems = []string{
	"AlmaLinux",
	"Alpaquita",
	"Alpine",
	"Android",
	"BellSoft Hardened Containers",
	"Bitnami",
	"Chainguard",
	"CleanStart",
	"CRAN",
	"crates.io",
	"Debian",
	"Echo",
	"GHC",
	"GIT",
	"GitHub Actions",
	"Go",
	"Hackage",
	"Hex",
	"Julia",
	"Linux",
	"Mageia",
	"Maven",
	"MiniOS",
	"npm",
	"NuGet",
	"opam",
	"openEuler",
	"openSUSE",
	"OSS-Fuzz",
	"Packagist",
	"Pub",
	"PyPI",
	"Red Hat",
	"Rocky Linux",
	"Root",
	"RubyGems",
	"SUSE",
	"SwiftURL",
	"Ubuntu",
	"VSCode",
	"Wolfi",
}

var ErrArchiveNotFound = errors.New("osv archive not found")

type OSVSyncer struct {
	pool       *pgxpool.Pool
	client     *http.Client
	ecosystems []string
	log        *slog.Logger
}

func NewSyncer(pool *pgxpool.Pool) *OSVSyncer {
	return &OSVSyncer{
		pool:       pool,
		client:     &http.Client{Timeout: 30 * time.Minute},
		ecosystems: defaultEcosystems,
		log:        slog.Default(),
	}
}

func (s *OSVSyncer) Name() string { return "osv" }

func (s *OSVSyncer) Sync(ctx context.Context) error {
	totalProcessed := 0
	startedAt := time.Now()

	s.log.Info("OSV sync: started", "ecosystems", len(s.ecosystems))

	for _, eco := range s.ecosystems {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		count, err := s.syncEcosystem(ctx, eco)
		if err != nil {
			if isArchiveNotFound(err) {
				s.log.Warn("OSV sync: ecosystem archive not found, skipping", "ecosystem", eco, "error", err)
				continue
			}

			s.log.Error("OSV sync: ecosystem failed", "ecosystem", eco, "error", err)
			continue
		}

		totalProcessed += count
	}

	s.log.Info(
		"OSV sync: completed all ecosystems",
		"total_processed", totalProcessed,
		"duration", time.Since(startedAt).String(),
	)

	return nil
}

func (s *OSVSyncer) syncEcosystem(ctx context.Context, ecosystem string) (int, error) {
	archiveURL := fmt.Sprintf(bucketURLTemplate, url.PathEscape(ecosystem))

	s.log.Info("OSV sync: downloading ecosystem", "ecosystem", ecosystem, "url", archiveURL)

	tmpFile, downloadedBytes, err := s.downloadWithRetryToTempFile(ctx, archiveURL)
	if err != nil {
		return 0, fmt.Errorf("download: %w", err)
	}
	defer func() {
		name := tmpFile.Name()
		if closeErr := tmpFile.Close(); closeErr != nil {
			s.log.Warn("OSV sync: failed to close temp file", "ecosystem", ecosystem, "path", name, "error", closeErr)
		}
		if removeErr := os.Remove(name); removeErr != nil && !os.IsNotExist(removeErr) {
			s.log.Warn("OSV sync: failed to remove temp file", "ecosystem", ecosystem, "path", name, "error", removeErr)
		}
	}()

	s.log.Info("OSV sync: downloaded ecosystem archive", "ecosystem", ecosystem, "bytes", downloadedBytes)

	zr, err := openZIP(tmpFile)
	if err != nil {
		return 0, fmt.Errorf("open zip: %w", err)
	}

	totalJSONFiles := countJSONFiles(zr.File)
	s.log.Info("OSV sync: archive opened", "ecosystem", ecosystem, "json_files", totalJSONFiles)

	batch := make([]osvRecord, 0, syncBatchSize)
	imported := 0
	parsed := 0
	skipped := 0

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}

		if err := s.upsertBatch(ctx, batch); err != nil {
			return err
		}

		imported += len(batch)

		s.log.Info(
			"OSV sync: progress",
			"ecosystem", ecosystem,
			"upserted", imported,
			"parsed", parsed,
			"skipped", skipped,
		)

		clear(batch)
		batch = batch[:0]
		return nil
	}

	for _, f := range zr.File {
		select {
		case <-ctx.Done():
			return imported, ctx.Err()
		default:
		}

		if f.FileInfo().IsDir() {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(f.Name), ".json") {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			skipped++
			s.log.Debug("OSV sync: failed to open file in zip", "ecosystem", ecosystem, "file", f.Name, "skipped", skipped, "error", err)
			continue
		}

		rec, parseErr := parseEntryReader(rc, ecosystem)
		closeErr := rc.Close()
		if closeErr != nil {
			s.log.Warn("OSV sync: failed to close zip entry", "ecosystem", ecosystem, "file", f.Name, "error", closeErr)
		}

		if parseErr != nil {
			skipped++
			s.log.Debug("OSV sync: failed to parse entry", "ecosystem", ecosystem, "file", f.Name, "skipped", skipped, "error", parseErr)
			continue
		}

		parsed++
		batch = append(batch, rec)

		if len(batch) >= syncBatchSize {
			if err := flush(); err != nil {
				return imported, fmt.Errorf("flush batch: %w", err)
			}
		}
	}

	if err := flush(); err != nil {
		return imported, fmt.Errorf("flush final batch: %w", err)
	}

	s.log.Info(
		"OSV sync: ecosystem completed",
		"ecosystem", ecosystem,
		"imported", imported,
		"parsed", parsed,
		"skipped", skipped,
		"json_files", totalJSONFiles,
	)

	return imported, nil
}

func (s *OSVSyncer) downloadWithRetryToTempFile(ctx context.Context, archiveURL string) (*os.File, int64, error) {
	const maxRetries = 4

	for attempt := 0; attempt < maxRetries; attempt++ {
		file, bytesWritten, retryable, retryAfter, err := s.downloadOnceToTempFile(ctx, archiveURL)
		if err == nil {
			return file, bytesWritten, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, 0, err
		}

		backoff := retryAfter
		if backoff <= 0 {
			backoff = defaultBackoff(attempt)
		}

		s.log.Warn(
			"OSV download failed, retrying",
			"url", archiveURL,
			"attempt", attempt+1,
			"backoff", backoff,
			"error", err,
		)

		select {
		case <-ctx.Done():
			return nil, 0, ctx.Err()
		case <-time.After(backoff):
		}
	}

	return nil, 0, fmt.Errorf("unreachable")
}

func (s *OSVSyncer) downloadOnceToTempFile(ctx context.Context, archiveURL string) (*os.File, int64, bool, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, archiveURL, nil)
	if err != nil {
		return nil, 0, false, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Accept", "application/zip, application/octet-stream, */*")
	req.Header.Set("User-Agent", "red-lycoris/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, true, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		tmpFile, err := os.CreateTemp("", "red-lycoris-osv-*.zip")
		if err != nil {
			return nil, 0, false, 0, fmt.Errorf("create temp file: %w", err)
		}

		written, err := io.Copy(tmpFile, resp.Body)
		if err != nil {
			name := tmpFile.Name()
			_ = tmpFile.Close()
			_ = os.Remove(name)
			return nil, 0, true, 0, fmt.Errorf("copy response to temp file: %w", err)
		}

		if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
			name := tmpFile.Name()
			_ = tmpFile.Close()
			_ = os.Remove(name)
			return nil, 0, false, 0, fmt.Errorf("rewind temp file: %w", err)
		}

		return tmpFile, written, false, 0, nil

	case http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		bodyPreviewBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, 0, true, parseRetryAfter(resp.Header.Get("Retry-After")), fmt.Errorf(
			"transient status %d, body=%q",
			resp.StatusCode,
			bodyPreview(bodyPreviewBytes, 512),
		)

	default:
		bodyPreviewBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		preview := bodyPreview(bodyPreviewBytes, 512)

		if resp.StatusCode == http.StatusNotFound &&
			(strings.Contains(preview, "NoSuchKey") || strings.Contains(preview, "No such object")) {
			return nil, 0, false, 0, wrapArchiveNotFound(archiveURL, preview)
		}

		return nil, 0, false, 0, fmt.Errorf(
			"unexpected status %d, body=%q",
			resp.StatusCode,
			preview,
		)
	}
}

func openZIP(file *os.File) (*zip.Reader, error) {
	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("stat zip file: %w", err)
	}

	zr, err := zip.NewReader(file, stat.Size())
	if err != nil {
		return nil, fmt.Errorf("open zip reader: %w", err)
	}

	return zr, nil
}

func countJSONFiles(files []*zip.File) int {
	count := 0
	for _, f := range files {
		if f.FileInfo().IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(f.Name), ".json") {
			count++
		}
	}
	return count
}

func defaultBackoff(attempt int) time.Duration {
	steps := []time.Duration{
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		16 * time.Second,
	}
	if attempt < len(steps) {
		return steps[attempt]
	}
	return 16 * time.Second
}

func parseRetryAfter(value string) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}

	if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}

	if t, err := http.ParseTime(value); err == nil {
		d := time.Until(t)
		if d > 0 {
			return d
		}
	}

	return 0
}

func bodyPreview(body []byte, limit int) string {
	if len(body) == 0 {
		return ""
	}
	if len(body) > limit {
		return string(body[:limit])
	}
	return string(body)
}

func isArchiveNotFound(err error) bool {
	return errors.Is(err, ErrArchiveNotFound)
}

func wrapArchiveNotFound(archiveURL string, body string) error {
	return fmt.Errorf("%w: url=%s body=%q", ErrArchiveNotFound, archiveURL, body)
}

// --- OSV JSON structures ---

type osvEntry struct {
	ID         string          `json:"id"`
	Summary    string          `json:"summary"`
	Details    string          `json:"details"`
	Aliases    []string        `json:"aliases"`
	Affected   []osvAffected   `json:"affected"`
	Severity   json.RawMessage `json:"severity"`
	References json.RawMessage `json:"references"`
	Published  string          `json:"published"`
	Modified   string          `json:"modified"`
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
	AffectedRanges []byte
	Severity       []byte
	References     []byte
	PublishedAt    *time.Time
	ModifiedAt     *time.Time
}

func parseEntryReader(r io.Reader, fallbackEcosystem string) (osvRecord, error) {
	var entry osvEntry
	if err := json.NewDecoder(r).Decode(&entry); err != nil {
		return osvRecord{}, fmt.Errorf("decode json: %w", err)
	}

	id := strings.TrimSpace(entry.ID)
	if id == "" {
		return osvRecord{}, fmt.Errorf("empty ID")
	}

	rec := osvRecord{
		OSVID:   id,
		Summary: strings.TrimSpace(entry.Summary),
		Details: strings.TrimSpace(entry.Details),
		Aliases: dedupStrings(entry.Aliases),
	}

	rec.Ecosystem, rec.PackageName = selectPackageInfo(entry.Affected, fallbackEcosystem)
	rec.AffectedRanges = collectRanges(entry.Affected)

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

func selectPackageInfo(affected []osvAffected, fallbackEcosystem string) (string, string) {
	ecosystem := strings.TrimSpace(fallbackEcosystem)
	packageName := ""

	for _, a := range affected {
		if ecosystem == "" && strings.TrimSpace(a.Package.Ecosystem) != "" {
			ecosystem = strings.TrimSpace(a.Package.Ecosystem)
		}
		if packageName == "" && strings.TrimSpace(a.Package.Name) != "" {
			packageName = strings.TrimSpace(a.Package.Name)
		}
	}

	return ecosystem, packageName
}

func collectRanges(affected []osvAffected) []byte {
	var flat []json.RawMessage

	for _, a := range affected {
		if len(a.Ranges) == 0 || string(a.Ranges) == "null" {
			continue
		}

		var one []json.RawMessage
		if err := json.Unmarshal(a.Ranges, &one); err == nil {
			flat = append(flat, one...)
			continue
		}

		flat = append(flat, a.Ranges)
	}

	if len(flat) == 0 {
		return nil
	}

	data, err := json.Marshal(flat)
	if err != nil {
		return nil
	}
	return data
}

func parseOSVTime(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}

	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
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

func dedupStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))

	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, exists := seen[v]; exists {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}

	if len(out) == 0 {
		return nil
	}
	return out
}

func (s *OSVSyncer) upsertBatch(ctx context.Context, records []osvRecord) error {
	if len(records) == 0 {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

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

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"osv_staging"},
		[]string{
			"osv_id",
			"summary",
			"details",
			"aliases",
			"ecosystem",
			"package_name",
			"affected_ranges",
			"severity",
			"refs",
			"published_at",
			"modified_at",
		},
		pgx.CopyFromSlice(len(records), func(i int) ([]any, error) {
			rec := records[i]
			return []any{
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
			}, nil
		}),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO osv_vulnerabilities (
			osv_id,
			summary,
			details,
			aliases,
			ecosystem,
			package_name,
			affected_ranges,
			severity,
			"references",
			published_at,
			modified_at,
			synced_at
		)
		SELECT
			osv_id,
			summary,
			details,
			aliases,
			ecosystem,
			package_name,
			affected_ranges,
			severity,
			refs,
			published_at,
			modified_at,
			now()
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

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	return nil
}

func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return json.RawMessage(data)
}
