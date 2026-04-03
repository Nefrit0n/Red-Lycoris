package nvd

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
	baseURL        = "https://services.nvd.nist.gov/rest/json/cves/2.0"
	resultsPerPage = 2000
)

// NVDSyncer синхронизирует CVE из NVD API 2.0.
type NVDSyncer struct {
	pool   *pgxpool.Pool
	apiKey string
	client *http.Client

	// requestInterval — минимальный интервал между запросами к NVD API.
	// 50 req/30s с ключом (600ms), 5 req/30s без ключа (6s).
	requestInterval time.Duration
}

func NewSyncer(pool *pgxpool.Pool, apiKey string) *NVDSyncer {
	interval := 6 * time.Second // без ключа: 5 req/30s
	if apiKey != "" {
		interval = 600 * time.Millisecond // с ключом: 50 req/30s
	}

	return &NVDSyncer{
		pool:            pool,
		apiKey:          apiKey,
		client:          &http.Client{Timeout: 60 * time.Second},
		requestInterval: interval,
	}
}

func (s *NVDSyncer) Name() string { return "nvd" }

func (s *NVDSyncer) Sync(ctx context.Context) error {
	// Проверяем, есть ли уже данные — если да, incremental sync
	var count int
	err := s.pool.QueryRow(ctx, "SELECT count(*) FROM nvd_cves").Scan(&count)
	if err != nil {
		return fmt.Errorf("nvd.Sync: count existing: %w", err)
	}

	if count == 0 {
		slog.Info("NVD sync: no existing data, starting full sync")
		return s.fullSync(ctx)
	}

	slog.Info("NVD sync: existing data found, starting incremental sync", "existing_records", count)
	return s.incrementalSync(ctx)
}

func (s *NVDSyncer) fullSync(ctx context.Context) error {
	return s.fetchAndStore(ctx, nil)
}

func (s *NVDSyncer) incrementalSync(ctx context.Context) error {
	now := time.Now().UTC()
	start := now.Add(-24 * time.Hour)
	params := &timeParams{
		lastModStartDate: start.Format("2006-01-02T15:04:05.000"),
		lastModEndDate:   now.Format("2006-01-02T15:04:05.000"),
	}
	return s.fetchAndStore(ctx, params)
}

type timeParams struct {
	lastModStartDate string
	lastModEndDate   string
}

// fetchAndStore скачивает CVE постранично и сохраняет в БД.
func (s *NVDSyncer) fetchAndStore(ctx context.Context, params *timeParams) error {
	ticker := time.NewTicker(s.requestInterval)
	defer ticker.Stop()

	startIndex := 0
	totalResults := -1 // неизвестно пока
	totalUpserted := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}

		resp, err := s.fetchPage(ctx, startIndex, params)
		if err != nil {
			return fmt.Errorf("nvd.Sync: fetch page at startIndex=%d: %w", startIndex, err)
		}

		if totalResults < 0 {
			totalResults = resp.TotalResults
			slog.Info("NVD sync: total results", "total", totalResults)
		}

		records := parseResponse(resp)
		if len(records) > 0 {
			if err := s.upsertBatch(ctx, records); err != nil {
				return fmt.Errorf("nvd.Sync: upsert at startIndex=%d: %w", startIndex, err)
			}
			totalUpserted += len(records)
		}

		startIndex += resp.ResultsPerPage

		if totalResults > 0 {
			pct := float64(startIndex) / float64(totalResults) * 100
			if pct > 100 {
				pct = 100
			}
			slog.Info("NVD sync: progress",
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

	slog.Info("NVD sync: completed", "total_upserted", totalUpserted)
	return nil
}

// fetchPage делает один запрос к NVD API с retry и exponential backoff при 403/429.
func (s *NVDSyncer) fetchPage(ctx context.Context, startIndex int, params *timeParams) (*nvdResponse, error) {
	const maxRetries = 3

	for attempt := range maxRetries {
		resp, retryable, err := s.doRequest(ctx, startIndex, params)
		if err == nil {
			return resp, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := time.Duration(1<<uint(attempt+1)) * time.Second // 2s, 4s, 8s
		slog.Warn("NVD API request failed, retrying",
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

// doRequest выполняет один HTTP-запрос. Возвращает (response, retryable, error).
func (s *NVDSyncer) doRequest(ctx context.Context, startIndex int, params *timeParams) (*nvdResponse, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return nil, false, fmt.Errorf("create request: %w", err)
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

	var nvdResp nvdResponse
	if err := json.Unmarshal(body, &nvdResp); err != nil {
		return nil, false, fmt.Errorf("unmarshal: %w", err)
	}

	return &nvdResp, false, nil
}

// --- NVD API 2.0 response structures ---

type nvdResponse struct {
	ResultsPerPage int              `json:"resultsPerPage"`
	StartIndex     int              `json:"startIndex"`
	TotalResults   int              `json:"totalResults"`
	Vulnerabilities []vulnerability `json:"vulnerabilities"`
}

type vulnerability struct {
	CVE cveItem `json:"cve"`
}

type cveItem struct {
	ID             string          `json:"id"`
	Descriptions   []langString    `json:"descriptions"`
	Metrics        metrics         `json:"metrics"`
	Weaknesses     []weakness      `json:"weaknesses"`
	Configurations json.RawMessage `json:"configurations"`
	References     json.RawMessage `json:"references"`
	Published      string          `json:"published"`
	LastModified   string          `json:"lastModified"`
}

type langString struct {
	Lang  string `json:"lang"`
	Value string `json:"value"`
}

type metrics struct {
	CvssMetricV31 []cvssMetric `json:"cvssMetricV31"`
	CvssMetricV40 []cvssMetric `json:"cvssMetricV40"`
}

type cvssMetric struct {
	CvssData cvssData `json:"cvssData"`
}

type cvssData struct {
	BaseScore    float64 `json:"baseScore"`
	VectorString string  `json:"vectorString"`
}

type weakness struct {
	Description []langString `json:"description"`
}

// --- Parsed record for DB ---

type nvdRecord struct {
	CVEID       string
	Description string
	V31Score    *float32
	V31Vector   *string
	V40Score    *float32
	V40Vector   *string
	CWEIDs      []int32
	CPEMatches  []byte // JSON
	References  []byte // JSON
	PublishedAt *time.Time
	ModifiedAt  *time.Time
	RawData     []byte // JSON
}

func parseResponse(resp *nvdResponse) []nvdRecord {
	records := make([]nvdRecord, 0, len(resp.Vulnerabilities))

	for i := range resp.Vulnerabilities {
		cve := &resp.Vulnerabilities[i].CVE
		rec := nvdRecord{CVEID: cve.ID}

		// description — первый en
		for _, d := range cve.Descriptions {
			if d.Lang == "en" {
				rec.Description = d.Value
				break
			}
		}

		// CVSS v3.1
		if len(cve.Metrics.CvssMetricV31) > 0 {
			score := float32(cve.Metrics.CvssMetricV31[0].CvssData.BaseScore)
			vec := cve.Metrics.CvssMetricV31[0].CvssData.VectorString
			rec.V31Score = &score
			rec.V31Vector = &vec
		}

		// CVSS v4.0
		if len(cve.Metrics.CvssMetricV40) > 0 {
			score := float32(cve.Metrics.CvssMetricV40[0].CvssData.BaseScore)
			vec := cve.Metrics.CvssMetricV40[0].CvssData.VectorString
			rec.V40Score = &score
			rec.V40Vector = &vec
		}

		// CWE IDs
		for _, w := range cve.Weaknesses {
			for _, d := range w.Description {
				id := parseCWEID(d.Value)
				if id > 0 {
					rec.CWEIDs = append(rec.CWEIDs, int32(id))
				}
			}
		}
		// дедупликация cwe_ids
		rec.CWEIDs = dedup32(rec.CWEIDs)

		// configurations → cpe_matches (raw JSON)
		if len(cve.Configurations) > 0 {
			rec.CPEMatches = cve.Configurations
		}

		// references (raw JSON)
		if len(cve.References) > 0 {
			rec.References = cve.References
		}

		// timestamps
		rec.PublishedAt = parseNVDTime(cve.Published)
		rec.ModifiedAt = parseNVDTime(cve.LastModified)

		// raw_data — полный CVE JSON
		raw, _ := json.Marshal(cve)
		rec.RawData = raw

		records = append(records, rec)
	}

	return records
}

// parseCWEID извлекает числовой ID из "CWE-79" → 79.
func parseCWEID(s string) int {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "CWE-") {
		return 0
	}
	n, err := strconv.Atoi(s[4:])
	if err != nil {
		return 0
	}
	return n
}

func parseNVDTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	// NVD формат: "2024-01-15T12:00:00.000"
	for _, layout := range []string{
		"2006-01-02T15:04:05.000",
		"2006-01-02T15:04:05",
		time.RFC3339,
	} {
		t, err := time.Parse(layout, s)
		if err == nil {
			return &t
		}
	}
	return nil
}

func dedup32(s []int32) []int32 {
	if len(s) <= 1 {
		return s
	}
	seen := make(map[int32]struct{}, len(s))
	out := make([]int32, 0, len(s))
	for _, v := range s {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			out = append(out, v)
		}
	}
	return out
}

// upsertBatch вставляет пачку записей через staging table + COPY.
func (s *NVDSyncer) upsertBatch(ctx context.Context, records []nvdRecord) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE nvd_staging (
			cve_id          TEXT NOT NULL,
			description     TEXT,
			cvss_v31_score  REAL,
			cvss_v31_vector TEXT,
			cvss_v40_score  REAL,
			cvss_v40_vector TEXT,
			cwe_ids         INT[],
			cpe_matches     JSONB,
			refs            JSONB,
			published_at    TIMESTAMPTZ,
			modified_at     TIMESTAMPTZ,
			raw_data        JSONB
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.CVEID,
			rec.Description,
			rec.V31Score,
			rec.V31Vector,
			rec.V40Score,
			rec.V40Vector,
			rec.CWEIDs,
			jsonbOrNull(rec.CPEMatches),
			jsonbOrNull(rec.References),
			rec.PublishedAt,
			rec.ModifiedAt,
			jsonbOrNull(rec.RawData),
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"nvd_staging"},
		[]string{"cve_id", "description", "cvss_v31_score", "cvss_v31_vector",
			"cvss_v40_score", "cvss_v40_vector", "cwe_ids", "cpe_matches",
			"refs", "published_at", "modified_at", "raw_data"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO nvd_cves (cve_id, description, cvss_v31_score, cvss_v31_vector,
		                      cvss_v40_score, cvss_v40_vector, cwe_ids, cpe_matches,
		                      "references", published_at, modified_at, raw_data, synced_at)
		SELECT cve_id, description, cvss_v31_score, cvss_v31_vector,
		       cvss_v40_score, cvss_v40_vector, cwe_ids, cpe_matches,
		       refs, published_at, modified_at, raw_data, now()
		FROM nvd_staging
		ON CONFLICT (cve_id) DO UPDATE
		SET description     = EXCLUDED.description,
		    cvss_v31_score  = EXCLUDED.cvss_v31_score,
		    cvss_v31_vector = EXCLUDED.cvss_v31_vector,
		    cvss_v40_score  = EXCLUDED.cvss_v40_score,
		    cvss_v40_vector = EXCLUDED.cvss_v40_vector,
		    cwe_ids         = EXCLUDED.cwe_ids,
		    cpe_matches     = EXCLUDED.cpe_matches,
		    "references"    = EXCLUDED."references",
		    published_at    = EXCLUDED.published_at,
		    modified_at     = EXCLUDED.modified_at,
		    raw_data        = EXCLUDED.raw_data,
		    synced_at       = now()
	`)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	return tx.Commit(ctx)
}

// jsonbOrNull конвертирует []byte в значение для JSONB-столбца (nil → NULL).
func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}
