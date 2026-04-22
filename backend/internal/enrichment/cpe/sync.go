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
	resultsPerPage = 10000
)

type CPESyncer struct {
	pool            *pgxpool.Pool
	apiKey          string
	client          *http.Client
	requestInterval time.Duration
}

func NewSyncer(pool *pgxpool.Pool, apiKey string) *CPESyncer {
	key := strings.TrimSpace(apiKey)

	// Консервативный темп. Без ключа держим 6с, с ключом — 3с.
	// Если NVD всё ещё душит 429, можно поднять и для ключа до 6с.
	interval := 6 * time.Second
	if key != "" {
		interval = 3 * time.Second
	}

	return &CPESyncer{
		pool:            pool,
		apiKey:          key,
		client:          &http.Client{Timeout: 60 * time.Second},
		requestInterval: interval,
	}
}

func (s *CPESyncer) Name() string { return "cpe" }

func (s *CPESyncer) Sync(ctx context.Context) error {
	slog.Info("CPE sync: starting",
		"has_api_key", s.apiKey != "",
		"request_interval_ms", s.requestInterval.Milliseconds(),
		"results_per_page", resultsPerPage,
	)

	var count int
	err := s.pool.QueryRow(ctx, "SELECT count(*) FROM cpe_dictionary").Scan(&count)
	if err != nil {
		return fmt.Errorf("cpe.Sync: count existing: %w", err)
	}

	if count == 0 {
		slog.Info("CPE sync: no existing data, starting full sync")
		return s.fetchAndStore(ctx, nil)
	}

	params, err := s.buildIncrementalParams(ctx)
	if err != nil {
		return fmt.Errorf("cpe.Sync: build incremental params: %w", err)
	}

	slog.Info("CPE sync: existing data found, starting incremental sync",
		"existing_records", count,
		"last_mod_start", params.lastModStartDate,
		"last_mod_end", params.lastModEndDate,
	)

	return s.fetchAndStore(ctx, params)
}

type timeParams struct {
	lastModStartDate string
	lastModEndDate   string
}

func (s *CPESyncer) buildIncrementalParams(ctx context.Context) (*timeParams, error) {
	now := time.Now().UTC()
	start := now.Add(-24 * time.Hour)

	var lastSyncAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT last_sync_at
		FROM sync_status
		WHERE source = 'cpe'
		  AND status = 'success'
		  AND last_sync_at IS NOT NULL
	`).Scan(&lastSyncAt)

	if err == nil {
		overlap := 2 * time.Hour
		start = lastSyncAt.UTC().Add(-overlap)
		if start.After(now) {
			start = now.Add(-1 * time.Hour)
		}
	} else if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	// У NVD для lastMod* максимальное окно 120 дней.
	maxWindow := 119 * 24 * time.Hour
	if now.Sub(start) > maxWindow {
		start = now.Add(-maxWindow)
	}

	return &timeParams{
		lastModStartDate: formatNVDTime(start),
		lastModEndDate:   formatNVDTime(now),
	}, nil
}

func formatNVDTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z07:00")
}

func (s *CPESyncer) fetchAndStore(ctx context.Context, params *timeParams) error {
	ticker := time.NewTicker(s.requestInterval)
	defer ticker.Stop()

	startIndex := 0
	totalResults := -1
	totalUpserted := 0
	firstRequest := true

	for {
		if !firstRequest {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-ticker.C:
			}
		}
		firstRequest = false

		resp, err := s.fetchPage(ctx, startIndex, params)
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

		pageCount := len(resp.Products)
		if pageCount == 0 {
			break
		}

		startIndex += pageCount

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

// fetchPage с retry и backoff при 403/429/временных сетевых сбоях.
func (s *CPESyncer) fetchPage(ctx context.Context, startIndex int, params *timeParams) (*cpeResponse, error) {
	const maxRetries = 5

	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, retryable, retryAfter, err := s.doRequest(ctx, startIndex, params)
		if err == nil {
			return resp, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := retryAfter
		if backoff <= 0 {
			backoff = s.defaultBackoff(attempt)
		}

		slog.Warn("CPE API request failed, retrying",
			"attempt", attempt+1,
			"backoff", backoff,
			"start_index", startIndex,
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

func (s *CPESyncer) defaultBackoff(attempt int) time.Duration {
	steps := []time.Duration{
		10 * time.Second,
		20 * time.Second,
		40 * time.Second,
		60 * time.Second,
		90 * time.Second,
	}
	if attempt < len(steps) {
		return steps[attempt]
	}
	return 90 * time.Second
}

func (s *CPESyncer) doRequest(ctx context.Context, startIndex int, params *timeParams) (*cpeResponse, bool, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return nil, false, 0, fmt.Errorf("create request: %w", err)
	}

	q := req.URL.Query()
	q.Set("startIndex", strconv.Itoa(startIndex))
	q.Set("resultsPerPage", strconv.Itoa(resultsPerPage))
	if params != nil {
		q.Set("lastModStartDate", params.lastModStartDate)
		q.Set("lastModEndDate", params.lastModEndDate)
	}
	req.URL.RawQuery = q.Encode()

	if s.apiKey != "" {
		req.Header.Set("apiKey", s.apiKey)
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

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		retryAfter := parseRetryAfter(resp.Header.Get("Retry-After"))
		return nil, true, retryAfter, fmt.Errorf(
			"rate limited: status %d, retry_after=%s, body=%q",
			resp.StatusCode,
			retryAfter,
			bodyPreview(body, 512),
		)
	}

	if resp.StatusCode == http.StatusBadGateway ||
		resp.StatusCode == http.StatusServiceUnavailable ||
		resp.StatusCode == http.StatusGatewayTimeout {
		retryAfter := parseRetryAfter(resp.Header.Get("Retry-After"))
		return nil, true, retryAfter, fmt.Errorf(
			"transient status %d, retry_after=%s, body=%q",
			resp.StatusCode,
			retryAfter,
			bodyPreview(body, 512),
		)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, false, 0, fmt.Errorf(
			"unexpected status %d, body=%q",
			resp.StatusCode,
			bodyPreview(body, 512),
		)
	}

	var cpeResp cpeResponse
	if err := json.Unmarshal(body, &cpeResp); err != nil {
		return nil, false, 0, fmt.Errorf("unmarshal: %w", err)
	}

	return &cpeResp, false, 0, nil
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
	CPEName    string     `json:"cpeName"`
	Deprecated bool       `json:"deprecated"`
	Titles     []cpeTitle `json:"titles"`
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
		cpeURI := strings.TrimSpace(p.CPE.CPEName)
		if cpeURI == "" {
			continue
		}

		rec := cpeRecord{
			CPEURI:     cpeURI,
			Deprecated: p.CPE.Deprecated,
		}

		// title — сначала en, иначе первый непустой
		for _, t := range p.CPE.Titles {
			if strings.EqualFold(strings.TrimSpace(t.Lang), "en") && strings.TrimSpace(t.Title) != "" {
				rec.Title = strings.TrimSpace(t.Title)
				break
			}
		}
		if rec.Title == "" {
			for _, t := range p.CPE.Titles {
				if strings.TrimSpace(t.Title) != "" {
					rec.Title = strings.TrimSpace(t.Title)
					break
				}
			}
		}

		rec.Vendor, rec.Product, rec.Version = parseCPEURI(cpeURI)

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

	vendor = normalizeCPEComponent(unescapeCPE(parts[3]))
	product = normalizeCPEComponent(unescapeCPE(parts[4]))
	version = normalizeCPEComponent(unescapeCPE(parts[5]))

	return vendor, product, version
}

func normalizeCPEComponent(s string) string {
	s = strings.TrimSpace(s)
	switch s {
	case "*", "-":
		return ""
	default:
		return s
	}
}

// unescapeCPE снимает backslash-escaping в компонентах CPE 2.3.
func unescapeCPE(s string) string {
	if s == "" || !strings.Contains(s, `\`) {
		return s
	}

	var b strings.Builder
	b.Grow(len(s))

	escaped := false
	for _, r := range s {
		if escaped {
			b.WriteRune(r)
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		b.WriteRune(r)
	}

	// если строка закончилась обратным слешом — сохраняем его как есть
	if escaped {
		b.WriteRune('\\')
	}

	return b.String()
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
