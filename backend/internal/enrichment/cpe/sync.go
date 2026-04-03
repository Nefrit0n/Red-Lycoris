package cpe

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

const (
	baseURL        = "https://services.nvd.nist.gov/rest/json/cpes/2.0"
	resultsPerPage = 2000
)

type CPESyncer struct {
	pool            *pgxpool.Pool
	apiKey          string
	client          *http.Client
	requestInterval time.Duration
}

func NewSyncer(pool *pgxpool.Pool, apiKey string) *CPESyncer {
	interval := 6 * time.Second
	if apiKey != "" {
		interval = 600 * time.Millisecond
	}

	return &CPESyncer{
		pool:            pool,
		apiKey:          apiKey,
		client:          &http.Client{Timeout: 60 * time.Second},
		requestInterval: interval,
	}
}

func (s *CPESyncer) Name() string { return "cpe" }

func (s *CPESyncer) Sync(ctx context.Context) error {
	ticker := time.NewTicker(s.requestInterval)
	defer ticker.Stop()

	startIndex := 0
	totalResults := -1
	totalUpserted := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}

		resp, err := s.fetchPage(ctx, startIndex)
		if err != nil {
			return fmt.Errorf("cpe.Sync: fetch page at startIndex=%d: %w", startIndex, err)
		}

		if totalResults < 0 {
			totalResults = resp.TotalResults
			slog.Info("CPE sync: total results", "total", totalResults)
		}

		records := parseProducts(resp)
		if len(records) > 0 {
			if err := s.upsertBatch(ctx, records); err != nil {
				return fmt.Errorf("cpe.Sync: upsert at startIndex=%d: %w", startIndex, err)
			}
			totalUpserted += len(records)
		}

		startIndex += resp.ResultsPerPage

		if totalResults > 0 {
			pct := float64(startIndex) / float64(totalResults) * 100
			if pct > 100 {
				pct = 100
			}
			slog.Info("CPE sync: progress",
				"fetched", startIndex,
				"total", totalResults,
				"percent", fmt.Sprintf("%.1f%%", pct),
				"upserted", totalUpserted,
			)
		}

		if startIndex >= totalResults {
			break
		}
	}

	slog.Info("CPE sync: completed", "total_upserted", totalUpserted)
	return nil
}

// fetchPage с retry и exponential backoff при 403/429.
func (s *CPESyncer) fetchPage(ctx context.Context, startIndex int) (*cpeResponse, error) {
	const maxRetries = 3

	for attempt := range maxRetries {
		resp, retryable, err := s.doRequest(ctx, startIndex)
		if err == nil {
			return resp, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := time.Duration(1<<uint(attempt+1)) * time.Second
		slog.Warn("CPE API request failed, retrying",
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

func (s *CPESyncer) doRequest(ctx context.Context, startIndex int) (*cpeResponse, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return nil, false, fmt.Errorf("create request: %w", err)
	}

	q := req.URL.Query()
	q.Set("startIndex", strconv.Itoa(startIndex))
	q.Set("resultsPerPage", strconv.Itoa(resultsPerPage))
	req.URL.RawQuery = q.Encode()

	if s.apiKey != "" {
		req.Header.Set("apiKey", s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		return nil, true, fmt.Errorf("rate limited: status %d", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, true, fmt.Errorf("read body: %w", err)
	}

	var cpeResp cpeResponse
	if err := json.Unmarshal(body, &cpeResp); err != nil {
		return nil, false, fmt.Errorf("unmarshal: %w", err)
	}

	return &cpeResp, false, nil
}

// --- NVD CPE API 2.0 response ---

type cpeResponse struct {
	ResultsPerPage int          `json:"resultsPerPage"`
	StartIndex     int          `json:"startIndex"`
	TotalResults   int          `json:"totalResults"`
	Products       []cpeProduct `json:"products"`
}

type cpeProduct struct {
	CPE cpeItem `json:"cpe"`
}

type cpeItem struct {
	CPEName    string      `json:"cpeName"`
	Deprecated bool        `json:"deprecated"`
	Titles     []cpeTitle  `json:"titles"`
}

type cpeTitle struct {
	Title string `json:"title"`
	Lang  string `json:"lang"`
}

// --- Parsed record ---

type cpeRecord struct {
	CPEURI     string
	Vendor     string
	Product    string
	Version    string
	Title      string
	Deprecated bool
}

func parseProducts(resp *cpeResponse) []cpeRecord {
	records := make([]cpeRecord, 0, len(resp.Products))

	for _, p := range resp.Products {
		rec := cpeRecord{
			CPEURI:     p.CPE.CPEName,
			Deprecated: p.CPE.Deprecated,
		}

		// title — первый en
		for _, t := range p.CPE.Titles {
			if t.Lang == "en" {
				rec.Title = t.Title
				break
			}
		}

		// Разбор CPE URI: cpe:2.3:part:vendor:product:version:...
		rec.Vendor, rec.Product, rec.Version = parseCPEURI(p.CPE.CPEName)

		records = append(records, rec)
	}

	return records
}

// parseCPEURI извлекает vendor, product, version из CPE 2.3 formatted string.
// Формат: cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
func parseCPEURI(uri string) (vendor, product, version string) {
	parts := strings.Split(uri, ":")
	if len(parts) < 6 {
		return "", "", ""
	}
	// parts[0]="cpe", parts[1]="2.3", parts[2]=part, parts[3]=vendor, parts[4]=product, parts[5]=version
	vendor = unescapeCPE(parts[3])
	product = unescapeCPE(parts[4])
	version = unescapeCPE(parts[5])

	if vendor == "*" {
		vendor = ""
	}
	if product == "*" {
		product = ""
	}
	if version == "*" || version == "-" {
		version = ""
	}

	return vendor, product, version
}

func unescapeCPE(s string) string {
	return strings.ReplaceAll(s, "\\:", ":")
}

func (s *CPESyncer) upsertBatch(ctx context.Context, records []cpeRecord) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE cpe_staging (
			cpe_uri    TEXT NOT NULL,
			vendor     TEXT,
			product    TEXT,
			version    TEXT,
			title      TEXT,
			deprecated BOOLEAN NOT NULL
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.CPEURI,
			rec.Vendor,
			rec.Product,
			rec.Version,
			rec.Title,
			rec.Deprecated,
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"cpe_staging"},
		[]string{"cpe_uri", "vendor", "product", "version", "title", "deprecated"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO cpe_dictionary (cpe_uri, vendor, product, version, title, deprecated, synced_at)
		SELECT cpe_uri, vendor, product, version, title, deprecated, now()
		FROM cpe_staging
		ON CONFLICT (cpe_uri) DO UPDATE
		SET vendor     = EXCLUDED.vendor,
		    product    = EXCLUDED.product,
		    version    = EXCLUDED.version,
		    title      = EXCLUDED.title,
		    deprecated = EXCLUDED.deprecated,
		    synced_at  = now()
	`)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	return tx.Commit(ctx)
}
