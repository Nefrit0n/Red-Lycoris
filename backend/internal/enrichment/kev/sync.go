package kev

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
	body, err := s.downloadWithRetry(ctx, kevURL)
	if err != nil {
		return fmt.Errorf("kev.Sync: download: %w", err)
	}

	vulns, err := parseKEV(body)
	if err != nil {
		return fmt.Errorf("kev.Sync: parse: %w", err)
	}

	if len(vulns) == 0 {
		return fmt.Errorf("kev.Sync: parsed zero vulnerabilities")
	}

	if err := s.upsert(ctx, vulns); err != nil {
		return fmt.Errorf("kev.Sync: upsert: %w", err)
	}

	var ransomwareCount, withDueDate int
	for _, v := range vulns {
		if parseDate(v.DueDate) != nil {
			withDueDate++
		}
		switch strings.ToLower(strings.TrimSpace(v.KnownRansomwareCampaignUse)) {
		case "known", "yes", "true":
			ransomwareCount++
		}
	}

	slog.Info("KEV sync: imported records",
		"count", len(vulns),
		"ransomware", ransomwareCount,
		"with_due_date", withDueDate,
	)
	return nil
}

func (s *KEVSyncer) downloadWithRetry(ctx context.Context, url string) ([]byte, error) {
	const maxRetries = 4

	for attempt := 0; attempt < maxRetries; attempt++ {
		body, retryable, retryAfter, err := s.downloadOnce(ctx, url)
		if err == nil {
			return body, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := retryAfter
		if backoff <= 0 {
			backoff = defaultBackoff(attempt)
		}

		slog.Warn("KEV download failed, retrying",
			"url", url,
			"attempt", attempt+1,
			"backoff", backoff,
			"error", err,
		)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}
	}

	return nil, fmt.Errorf("unreachable")
}

func (s *KEVSyncer) downloadOnce(ctx context.Context, url string) ([]byte, bool, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, false, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "redlycoris/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, true, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, true, 0, fmt.Errorf("read body: %w", readErr)
	}

	switch resp.StatusCode {
	case http.StatusOK:
		return body, false, 0, nil
	case http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return nil, true, parseRetryAfter(resp.Header.Get("Retry-After")), fmt.Errorf(
			"transient status %d, body=%q",
			resp.StatusCode,
			bodyPreview(body, 512),
		)
	default:
		return nil, false, 0, fmt.Errorf(
			"unexpected status %d, body=%q",
			resp.StatusCode,
			bodyPreview(body, 512),
		)
	}
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

type kevCatalog struct {
	Vulnerabilities []kevEntry `json:"vulnerabilities"`
}

type kevEntry struct {
	CVEID                      string `json:"cveID"`
	VendorProject              string `json:"vendorProject"`
	Product                    string `json:"product"`
	VulnerabilityName          string `json:"vulnerabilityName"`
	DateAdded                  string `json:"dateAdded"`
	ShortDescription           string `json:"shortDescription"`
	RequiredAction             string `json:"requiredAction"`
	DueDate                    string `json:"dueDate"`
	KnownRansomwareCampaignUse string `json:"knownRansomwareCampaignUse"`
	Notes                      string `json:"notes"`
}

func parseKEV(data []byte) ([]kevEntry, error) {
	var catalog kevCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	out := make([]kevEntry, 0, len(catalog.Vulnerabilities))
	seen := make(map[string]struct{}, len(catalog.Vulnerabilities))

	for _, v := range catalog.Vulnerabilities {
		v.CVEID = strings.ToUpper(strings.TrimSpace(v.CVEID))
		v.VendorProject = strings.TrimSpace(v.VendorProject)
		v.Product = strings.TrimSpace(v.Product)
		v.VulnerabilityName = strings.TrimSpace(v.VulnerabilityName)
		v.ShortDescription = strings.TrimSpace(v.ShortDescription)
		v.RequiredAction = strings.TrimSpace(v.RequiredAction)
		v.DueDate = strings.TrimSpace(v.DueDate)
		v.DateAdded = strings.TrimSpace(v.DateAdded)
		v.KnownRansomwareCampaignUse = strings.TrimSpace(v.KnownRansomwareCampaignUse)
		v.Notes = strings.TrimSpace(v.Notes)

		if !strings.HasPrefix(v.CVEID, "CVE-") {
			continue
		}
		if _, exists := seen[v.CVEID]; exists {
			continue
		}
		seen[v.CVEID] = struct{}{}

		out = append(out, v)
	}

	return out, nil
}

func (s *KEVSyncer) upsert(ctx context.Context, vulns []kevEntry) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE kev_staging (
			cve_id            TEXT NOT NULL,
			vendor            TEXT,
			product           TEXT,
			vulnerability_name TEXT,
			date_added        DATE,
			due_date          DATE,
			known_ransomware  BOOLEAN,
			notes             TEXT,
			short_description TEXT,
			required_action   TEXT
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(vulns))
	for i, v := range vulns {
		dateAdded := parseDate(v.DateAdded)
		dueDate := parseDate(v.DueDate)

		knownRansomware := false
		switch strings.ToLower(strings.TrimSpace(v.KnownRansomwareCampaignUse)) {
		case "known", "yes", "true":
			knownRansomware = true
		}

		rows[i] = []any{
			v.CVEID,
			v.VendorProject,
			v.Product,
			v.VulnerabilityName,
			dateAdded,
			dueDate,
			knownRansomware,
			v.Notes,
			v.ShortDescription,
			v.RequiredAction,
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"kev_staging"},
		[]string{
			"cve_id",
			"vendor",
			"product",
			"vulnerability_name",
			"date_added",
			"due_date",
			"known_ransomware",
			"notes",
			"short_description",
			"required_action",
		},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO kev_catalog (
			cve_id,
			vendor,
			product,
			vulnerability_name,
			date_added,
			due_date,
			known_ransomware,
			notes,
			short_description,
			required_action,
			synced_at
		)
		SELECT
			cve_id,
			vendor,
			product,
			vulnerability_name,
			date_added,
			due_date,
			known_ransomware,
			notes,
			short_description,
			required_action,
			now()
		FROM kev_staging
		ON CONFLICT (cve_id) DO UPDATE
		SET vendor             = EXCLUDED.vendor,
		    product            = EXCLUDED.product,
		    vulnerability_name = EXCLUDED.vulnerability_name,
		    date_added         = EXCLUDED.date_added,
		    due_date           = EXCLUDED.due_date,
		    known_ransomware   = EXCLUDED.known_ransomware,
		    notes              = EXCLUDED.notes,
		    short_description  = EXCLUDED.short_description,
		    required_action    = EXCLUDED.required_action,
		    synced_at          = now()
	`)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	return tx.Commit(ctx)
}

func parseDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}

	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}
