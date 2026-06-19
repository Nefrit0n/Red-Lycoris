package nvd

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
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

	defaultNoKeyDelay = 6 * time.Second
	defaultKeyDelay   = 600 * time.Millisecond

	maxRetries    = 5
	windowOverlap = 5 * time.Minute
	maxDateRange  = 120 * 24 * time.Hour
)

type NVDSyncer struct {
	pool   *pgxpool.Pool
	apiKey string
	client *http.Client

	// 50 req/30s с ключом (600ms), 5 req/30s без ключа (6s).
	requestInterval time.Duration
}

type syncState struct {
	LastSuccessAt *time.Time
}

type syncResult struct {
	Watermark time.Time
	Upserted  int
}

type timeParams struct {
	lastModStartDate string
	lastModEndDate   string
}

func NewSyncer(pool *pgxpool.Pool, apiKey string) *NVDSyncer {
	interval := defaultNoKeyDelay
	if apiKey != "" {
		interval = defaultKeyDelay
	}

	return &NVDSyncer{
		pool:   pool,
		apiKey: apiKey,
		client: &http.Client{
			Timeout: 90 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        20,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		requestInterval: interval,
	}
}

func (s *NVDSyncer) Name() string { return "nvd" }

func (s *NVDSyncer) PreserveSyncWatermark() bool { return true }

func (s *NVDSyncer) Sync(ctx context.Context) error {
	return s.runSync(ctx, false)
}

func (s *NVDSyncer) FullSync(ctx context.Context) error {
	return s.runSync(ctx, true)
}

func (s *NVDSyncer) runSync(ctx context.Context, forceFull bool) error {
	runStartedAt := time.Now().UTC()

	if err := s.markSyncRunning(ctx); err != nil {
		return fmt.Errorf("nvd.Sync: mark running: %w", err)
	}

	var result syncResult
	var err error

	switch {
	case forceFull:
		slog.Info("NVD sync: forced full sync started")
		result, err = s.fullSync(ctx)

	default:
		result, err = s.syncFromState(ctx, runStartedAt)
	}

	if err != nil {
		_ = s.markSyncFailed(ctx, err.Error(), secondsSince(runStartedAt))
		return err
	}

	if err := s.markSyncSuccess(ctx, result.Watermark, result.Upserted, secondsSince(runStartedAt)); err != nil {
		return fmt.Errorf("nvd.Sync: mark success: %w", err)
	}

	slog.Info("NVD sync: finished",
		"watermark", result.Watermark,
		"upserted", result.Upserted,
		"duration_seconds", secondsSince(runStartedAt),
	)

	return nil
}

func (s *NVDSyncer) syncFromState(ctx context.Context, runStartedAt time.Time) (syncResult, error) {
	hasData, err := s.hasAnyData(ctx)
	if err != nil {
		return syncResult{}, fmt.Errorf("nvd.Sync: check existing data: %w", err)
	}

	state, err := s.loadSyncState(ctx)
	if err != nil {
		return syncResult{}, fmt.Errorf("nvd.Sync: load sync state: %w", err)
	}

	if !hasData {
		slog.Info("NVD sync: no local data, forcing full sync")
		return s.fullSync(ctx)
	}

	if state.LastSuccessAt == nil {
		// Без watermark нельзя безопасно определить начало incremental-окна.
		slog.Warn("NVD sync: local data exists but watermark is missing, forcing full sync")
		return s.fullSync(ctx)
	}

	slog.Info("NVD sync: incremental sync started", "last_success_at", *state.LastSuccessAt)
	return s.incrementalSync(ctx, *state.LastSuccessAt, runStartedAt)
}

func (s *NVDSyncer) fullSync(ctx context.Context) (syncResult, error) {
	// Берём watermark ДО старта полной загрузки.
	// Следующий incremental доберёт всё, что изменилось во время full sync.
	fullSyncStartedAt := time.Now().UTC()

	upserted, err := s.fetchAndStore(ctx, nil)
	if err != nil {
		return syncResult{}, fmt.Errorf("nvd.fullSync: %w", err)
	}

	slog.Info("NVD sync: bootstrap full sync completed",
		"watermark", fullSyncStartedAt,
		"upserted", upserted,
	)

	return syncResult{
		Watermark: fullSyncStartedAt,
		Upserted:  upserted,
	}, nil
}

func (s *NVDSyncer) incrementalSync(ctx context.Context, lastSuccessAt time.Time, runStartedAt time.Time) (syncResult, error) {
	now := time.Now().UTC()

	from := lastSuccessAt.Add(-windowOverlap)
	if from.After(now) {
		from = now.Add(-windowOverlap)
	}

	totalUpserted := 0
	windowStart := from

	for windowStart.Before(now) {
		windowEnd := minTime(windowStart.Add(maxDateRange), now)

		params := &timeParams{
			lastModStartDate: formatNVDTime(windowStart),
			lastModEndDate:   formatNVDTime(windowEnd),
		}

		slog.Info("NVD sync: incremental window",
			"from", params.lastModStartDate,
			"to", params.lastModEndDate,
		)

		upserted, err := s.fetchAndStore(ctx, params)
		if err != nil {
			return syncResult{}, fmt.Errorf(
				"nvd.incrementalSync: window %s..%s: %w",
				params.lastModStartDate,
				params.lastModEndDate,
				err,
			)
		}

		totalUpserted += upserted

		// Чекпоинтим watermark после каждого успешного окна.
		// Это важно, если gap > 120 дней и процесс упадёт на середине.
		if err := s.markSyncWindowCheckpoint(ctx, windowEnd, totalUpserted, secondsSince(runStartedAt)); err != nil {
			return syncResult{}, fmt.Errorf("nvd.incrementalSync: checkpoint: %w", err)
		}

		if windowEnd.Equal(now) {
			break
		}

		windowStart = windowEnd
	}

	slog.Info("NVD sync: incremental sync completed",
		"watermark", now,
		"upserted", totalUpserted,
	)

	return syncResult{
		Watermark: now,
		Upserted:  totalUpserted,
	}, nil
}

// fetchAndStore скачивает CVE постранично и сохраняет в БД.
func (s *NVDSyncer) fetchAndStore(ctx context.Context, params *timeParams) (int, error) {
	startIndex := 0
	totalResults := -1
	totalUpserted := 0
	requestNo := 0

	for {
		// Первый запрос идёт сразу.
		if requestNo > 0 {
			select {
			case <-ctx.Done():
				return totalUpserted, ctx.Err()
			case <-time.After(s.requestInterval):
			}
		}
		requestNo++

		resp, err := s.fetchPage(ctx, startIndex, params)
		if err != nil {
			return totalUpserted, fmt.Errorf("nvd.fetchAndStore: fetch page at startIndex=%d: %w", startIndex, err)
		}

		if totalResults < 0 {
			totalResults = resp.TotalResults
			slog.Info("NVD sync: total results", "total", totalResults)
		}

		if resp.ResultsPerPage <= 0 && totalResults > 0 {
			return totalUpserted, fmt.Errorf("nvd.fetchAndStore: invalid resultsPerPage=%d", resp.ResultsPerPage)
		}

		records := parseResponse(resp)
		if len(records) > 0 {
			if err := s.upsertBatch(ctx, records); err != nil {
				return totalUpserted, fmt.Errorf("nvd.fetchAndStore: upsert at startIndex=%d: %w", startIndex, err)
			}
			totalUpserted += len(records)
		}

		fetched := resp.StartIndex + len(resp.Vulnerabilities)
		if fetched > totalResults {
			fetched = totalResults
		}

		if totalResults > 0 {
			pct := float64(fetched) / float64(totalResults) * 100
			if pct > 100 {
				pct = 100
			}

			slog.Info("NVD sync: progress",
				"fetched", fetched,
				"total", totalResults,
				"percent", fmt.Sprintf("%.1f%%", pct),
				"upserted", totalUpserted,
			)
		}

		if fetched >= totalResults {
			break
		}

		startIndex = resp.StartIndex + resp.ResultsPerPage
	}

	slog.Info("NVD sync: completed batch", "total_upserted", totalUpserted)
	return totalUpserted, nil
}

// fetchPage делает один запрос к NVD API с retry/backoff.
func (s *NVDSyncer) fetchPage(ctx context.Context, startIndex int, params *timeParams) (*nvdResponse, error) {
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, retryAfter, retryable, err := s.doRequest(ctx, startIndex, params)
		if err == nil {
			return resp, nil
		}

		lastErr = err
		if !retryable || attempt == maxRetries-1 {
			break
		}

		backoff := retryAfter
		if backoff <= 0 {
			backoff = time.Duration(1<<attempt) * time.Second // 1s, 2s, 4s, 8s, 16s
		}

		slog.Warn("NVD API request failed, retrying",
			"attempt", attempt+1,
			"startIndex", startIndex,
			"backoff", backoff,
			"error", err,
		)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}
	}

	return nil, lastErr
}

// doRequest выполняет один HTTP-запрос.
// Возвращает: (response, retryAfter, retryable, error).
func (s *NVDSyncer) doRequest(ctx context.Context, startIndex int, params *timeParams) (*nvdResponse, time.Duration, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return nil, 0, false, fmt.Errorf("create request: %w", err)
	}

	q := req.URL.Query()
	q.Set("startIndex", strconv.Itoa(startIndex))
	q.Set("resultsPerPage", strconv.Itoa(resultsPerPage))
	if params != nil {
		q.Set("lastModStartDate", params.lastModStartDate)
		q.Set("lastModEndDate", params.lastModEndDate)
	}
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "red-lycoris-nvd-sync/1.0")
	if s.apiKey != "" {
		req.Header.Set("apiKey", s.apiKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, true, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		var nvdResp nvdResponse
		dec := json.NewDecoder(resp.Body)
		if err := dec.Decode(&nvdResp); err != nil {
			return nil, 0, true, fmt.Errorf("decode body: %w", err)
		}
		return &nvdResp, 0, false, nil

	case http.StatusTooManyRequests, http.StatusForbidden:
		msg := responseMessage(resp)
		retryAfter := parseRetryAfter(resp)
		if msg == "" {
			msg = resp.Status
		}
		return nil, retryAfter, true, fmt.Errorf("rate limited: status=%d message=%q", resp.StatusCode, msg)

	default:
		msg := responseMessage(resp)
		if msg == "" {
			msg = resp.Status
		}
		return nil, 0, false, fmt.Errorf("unexpected status=%d message=%q", resp.StatusCode, msg)
	}
}

func (s *NVDSyncer) hasAnyData(ctx context.Context) (bool, error) {
	var exists bool

	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM nvd_cves
			LIMIT 1
		)
	`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check nvd_cves existence: %w", err)
	}

	return exists, nil
}

func (s *NVDSyncer) loadSyncState(ctx context.Context) (syncState, error) {
	var st syncState
	var lastSync sql.NullTime

	err := s.pool.QueryRow(ctx, `
		SELECT last_sync_at
		FROM sync_status
		WHERE source = $1
	`, s.Name()).Scan(&lastSync)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return syncState{}, nil
		}
		return syncState{}, err
	}

	if lastSync.Valid {
		t := lastSync.Time.UTC()
		st.LastSuccessAt = &t
	}

	return st, nil
}

func (s *NVDSyncer) markSyncRunning(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sync_status (
			source,
			status,
			error_message,
			updated_at
		)
		VALUES ($1, 'running', NULL, now())
		ON CONFLICT (source) DO UPDATE
		SET status        = 'running',
		    error_message = NULL,
		    updated_at    = now()
	`, s.Name())
	return err
}

func (s *NVDSyncer) markSyncWindowCheckpoint(
	ctx context.Context,
	watermark time.Time,
	recordsCount int,
	durationSeconds int,
) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sync_status (
			source,
			last_sync_at,
			records_count,
			status,
			error_message,
			duration_seconds,
			updated_at
		)
		VALUES ($1, $2, $3, 'running', NULL, $4, now())
		ON CONFLICT (source) DO UPDATE
		SET last_sync_at     = $2,
		    records_count    = $3,
		    status           = 'running',
		    error_message    = NULL,
		    duration_seconds = $4,
		    updated_at       = now()
	`, s.Name(), watermark, recordsCount, durationSeconds)

	return err
}

func (s *NVDSyncer) markSyncSuccess(
	ctx context.Context,
	watermark time.Time,
	recordsCount int,
	durationSeconds int,
) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sync_status (
			source,
			last_sync_at,
			records_count,
			status,
			error_message,
			duration_seconds,
			updated_at
		)
		VALUES ($1, $2, $3, 'success', NULL, $4, now())
		ON CONFLICT (source) DO UPDATE
		SET last_sync_at     = $2,
		    records_count    = $3,
		    status           = 'success',
		    error_message    = NULL,
		    duration_seconds = $4,
		    updated_at       = now()
	`, s.Name(), watermark, recordsCount, durationSeconds)

	return err
}

func (s *NVDSyncer) markSyncFailed(ctx context.Context, errText string, durationSeconds int) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sync_status (
			source,
			status,
			error_message,
			duration_seconds,
			updated_at
		)
		VALUES ($1, 'error', $2, $3, now())
		ON CONFLICT (source) DO UPDATE
		SET status           = 'error',
		    error_message    = $2,
		    duration_seconds = $3,
		    updated_at       = now()
	`, s.Name(), truncateError(errText, 4000), durationSeconds)
	return err
}

func formatNVDTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000") + "Z"
}

func responseMessage(resp *http.Response) string {
	return strings.TrimSpace(resp.Header.Get("message"))
}

func parseRetryAfter(resp *http.Response) time.Duration {
	raw := strings.TrimSpace(resp.Header.Get("Retry-After"))
	if raw == "" {
		return 0
	}

	if secs, err := strconv.Atoi(raw); err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}

	if ts, err := http.ParseTime(raw); err == nil {
		d := time.Until(ts)
		if d > 0 {
			return d
		}
	}

	return 0
}

func secondsSince(t time.Time) int {
	return int(time.Since(t).Seconds())
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func truncateError(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	return s[:limit]
}

// --- NVD API 2.0 response structures ---

type nvdResponse struct {
	ResultsPerPage  int             `json:"resultsPerPage"`
	StartIndex      int             `json:"startIndex"`
	TotalResults    int             `json:"totalResults"`
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
	CvssMetricV2  []cvssMetric `json:"cvssMetricV2"`
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
	V2Score     *float32
	V2Vector    *string
	CWEIDs      []int32
	CPEMatches  []byte
	References  []byte
	PublishedAt *time.Time
	ModifiedAt  *time.Time
	RawData     []byte
}

func parseResponse(resp *nvdResponse) []nvdRecord {
	records := make([]nvdRecord, 0, len(resp.Vulnerabilities))

	for i := range resp.Vulnerabilities {
		cve := &resp.Vulnerabilities[i].CVE
		rec := nvdRecord{CVEID: cve.ID}

		for _, d := range cve.Descriptions {
			if d.Lang == "en" {
				rec.Description = d.Value
				break
			}
		}

		if len(cve.Metrics.CvssMetricV31) > 0 {
			score := float32(cve.Metrics.CvssMetricV31[0].CvssData.BaseScore)
			vec := cve.Metrics.CvssMetricV31[0].CvssData.VectorString
			rec.V31Score = &score
			rec.V31Vector = &vec
		}

		if len(cve.Metrics.CvssMetricV40) > 0 {
			score := float32(cve.Metrics.CvssMetricV40[0].CvssData.BaseScore)
			vec := cve.Metrics.CvssMetricV40[0].CvssData.VectorString
			rec.V40Score = &score
			rec.V40Vector = &vec
		}

		if len(cve.Metrics.CvssMetricV2) > 0 {
			score := float32(cve.Metrics.CvssMetricV2[0].CvssData.BaseScore)
			vec := cve.Metrics.CvssMetricV2[0].CvssData.VectorString
			rec.V2Score = &score
			rec.V2Vector = &vec
		}

		for _, w := range cve.Weaknesses {
			for _, d := range w.Description {
				id := parseCWEID(d.Value)
				if id > 0 && id <= math.MaxInt32 {
					rec.CWEIDs = append(rec.CWEIDs, int32(id))
				}
			}
		}
		rec.CWEIDs = dedup32(rec.CWEIDs)

		if len(cve.Configurations) > 0 {
			rec.CPEMatches = cve.Configurations
		}

		if len(cve.References) > 0 {
			rec.References = cve.References
		}

		rec.PublishedAt = parseNVDTime(cve.Published)
		rec.ModifiedAt = parseNVDTime(cve.LastModified)

		raw, _ := json.Marshal(cve)
		rec.RawData = raw

		records = append(records, rec)
	}

	return records
}

// parseCWEID извлекает числовой ID из "CWE-79" -> 79.
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

	for _, layout := range []string{
		"2006-01-02T15:04:05.000",
		"2006-01-02T15:04:05.000Z",
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
			cvss_v2_score   REAL,
			cvss_v2_vector  TEXT,
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
			rec.V2Score,
			rec.V2Vector,
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
		[]string{
			"cve_id",
			"description",
			"cvss_v31_score",
			"cvss_v31_vector",
			"cvss_v40_score",
			"cvss_v40_vector",
			"cvss_v2_score",
			"cvss_v2_vector",
			"cwe_ids",
			"cpe_matches",
			"refs",
			"published_at",
			"modified_at",
			"raw_data",
		},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO nvd_cves (
			cve_id,
			description,
			cvss_v31_score,
			cvss_v31_vector,
			cvss_v40_score,
			cvss_v40_vector,
			cvss_v2_score,
			cvss_v2_vector,
			cwe_ids,
			cpe_matches,
			"references",
			published_at,
			modified_at,
			raw_data,
			synced_at
		)
		SELECT
			cve_id,
			description,
			cvss_v31_score,
			cvss_v31_vector,
			cvss_v40_score,
			cvss_v40_vector,
			cvss_v2_score,
			cvss_v2_vector,
			cwe_ids,
			cpe_matches,
			refs,
			published_at,
			modified_at,
			raw_data,
			now()
		FROM nvd_staging
		ON CONFLICT (cve_id) DO UPDATE
		SET description     = EXCLUDED.description,
		    cvss_v31_score  = EXCLUDED.cvss_v31_score,
		    cvss_v31_vector = EXCLUDED.cvss_v31_vector,
		    cvss_v40_score  = EXCLUDED.cvss_v40_score,
		    cvss_v40_vector = EXCLUDED.cvss_v40_vector,
		    cvss_v2_score   = EXCLUDED.cvss_v2_score,
		    cvss_v2_vector  = EXCLUDED.cvss_v2_vector,
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

// jsonbOrNull конвертирует []byte в значение для JSONB-столбца (nil -> NULL).
func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}
