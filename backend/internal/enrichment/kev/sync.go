package kev

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const kevURL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

type KEVSyncer struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewSyncer(pool *pgxpool.Pool) *KEVSyncer {
	return &KEVSyncer{
		pool:   pool,
		client: &http.Client{Timeout: 2 * time.Minute},
	}
}

func (s *KEVSyncer) Name() string { return "kev" }

func (s *KEVSyncer) Sync(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, kevURL, nil)
	if err != nil {
		return fmt.Errorf("kev.Sync: create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("kev.Sync: download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("kev.Sync: unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("kev.Sync: read body: %w", err)
	}

	vulns, err := parseKEV(body)
	if err != nil {
		return fmt.Errorf("kev.Sync: parse: %w", err)
	}

	if err := s.upsert(ctx, vulns); err != nil {
		return fmt.Errorf("kev.Sync: upsert: %w", err)
	}

	slog.Info("KEV sync: imported records", "count", len(vulns))
	return nil
}

type kevCatalog struct {
	Vulnerabilities []kevEntry `json:"vulnerabilities"`
}

type kevEntry struct {
	CVEID                    string `json:"cveID"`
	VendorProject            string `json:"vendorProject"`
	Product                  string `json:"product"`
	VulnerabilityName        string `json:"vulnerabilityName"`
	DateAdded                string `json:"dateAdded"`
	ShortDescription         string `json:"shortDescription"`
	RequiredAction           string `json:"requiredAction"`
	DueDate                  string `json:"dueDate"`
	KnownRansomwareCampaignUse string `json:"knownRansomwareCampaignUse"`
	Notes                    string `json:"notes"`
}

func parseKEV(data []byte) ([]kevEntry, error) {
	var catalog kevCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	return catalog.Vulnerabilities, nil
}

func (s *KEVSyncer) upsert(ctx context.Context, vulns []kevEntry) error {
	const query = `
		INSERT INTO kev_catalog (cve_id, vendor, product, vulnerability_name,
		                         date_added, due_date, known_ransomware, notes, synced_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (cve_id) DO UPDATE
		SET vendor           = EXCLUDED.vendor,
		    product          = EXCLUDED.product,
		    vulnerability_name = EXCLUDED.vulnerability_name,
		    date_added       = EXCLUDED.date_added,
		    due_date         = EXCLUDED.due_date,
		    known_ransomware = EXCLUDED.known_ransomware,
		    notes            = EXCLUDED.notes,
		    synced_at        = now()
	`

	// Пакетный upsert через pgx batch
	b := &pgxBatch{}
	for _, v := range vulns {
		dateAdded := parseDate(v.DateAdded)
		dueDate := parseDate(v.DueDate)
		knownRansomware := strings.EqualFold(v.KnownRansomwareCampaignUse, "Known")

		b.entries = append(b.entries, batchEntry{
			query: query,
			args: []any{
				v.CVEID, v.VendorProject, v.Product, v.VulnerabilityName,
				dateAdded, dueDate, knownRansomware, v.Notes,
			},
		})
	}

	return b.execute(ctx, s.pool)
}

type batchEntry struct {
	query string
	args  []any
}

type pgxBatch struct {
	entries []batchEntry
}

func (b *pgxBatch) execute(ctx context.Context, pool *pgxpool.Pool) error {
	// Выполняем пакетами по 500 для баланса между скоростью и памятью
	const batchSize = 500

	for i := 0; i < len(b.entries); i += batchSize {
		end := i + batchSize
		if end > len(b.entries) {
			end = len(b.entries)
		}
		chunk := b.entries[i:end]

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin tx at offset %d: %w", i, err)
		}

		for _, entry := range chunk {
			if _, err := tx.Exec(ctx, entry.query, entry.args...); err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("exec at offset %d: %w", i, err)
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit at offset %d: %w", i, err)
		}
	}
	return nil
}

func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}
