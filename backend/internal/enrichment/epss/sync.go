package epss

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/csv"
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

const urlTemplate = "https://epss.cyentia.com/epss_scores-%s.csv.gz"

type EPSSSyncer struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewSyncer(pool *pgxpool.Pool) *EPSSSyncer {
	return &EPSSSyncer{
		pool:   pool,
		client: &http.Client{Timeout: 5 * time.Minute},
	}
}

func (s *EPSSSyncer) Name() string { return "epss" }

func (s *EPSSSyncer) Sync(ctx context.Context) error {
	// Пробуем сегодня и вчера — файл публикуется с задержкой
	now := time.Now().UTC()
	dates := []string{
		now.Format("2006-01-02"),
		now.AddDate(0, 0, -1).Format("2006-01-02"),
	}

	var gzBody []byte
	var usedURL string

	for _, date := range dates {
		url := fmt.Sprintf(urlTemplate, date)

		body, err := s.downloadWithRetry(ctx, url)
		if err != nil {
			slog.Warn("EPSS download failed for date candidate", "url", url, "error", err)
			continue
		}
		if len(body) == 0 {
			slog.Warn("EPSS download returned empty body", "url", url)
			continue
		}

		gzBody = body
		usedURL = url
		break
	}

	if len(gzBody) == 0 {
		return fmt.Errorf("epss.Sync: no EPSS file available for dates %v", dates)
	}

	slog.Info("EPSS downloading completed", "url", usedURL, "bytes", len(gzBody))

	gz, err := gzip.NewReader(bytes.NewReader(gzBody))
	if err != nil {
		return fmt.Errorf("epss.Sync: gzip reader: %w", err)
	}
	defer gz.Close()

	records, scoreDate, err := parseCSV(gz)
	if err != nil {
		return fmt.Errorf("epss.Sync: parse CSV: %w", err)
	}

	if len(records) == 0 {
		return fmt.Errorf("epss.Sync: parsed zero records from %s", usedURL)
	}

	if err := s.upsert(ctx, records, scoreDate); err != nil {
		return fmt.Errorf("epss.Sync: upsert: %w", err)
	}

	slog.Info("EPSS sync: imported records", "count", len(records), "score_date", scoreDate.Format("2006-01-02"))
	return nil
}

func (s *EPSSSyncer) downloadWithRetry(ctx context.Context, url string) ([]byte, error) {
	const maxRetries = 4

	for attempt := 0; attempt < maxRetries; attempt++ {
		body, retryable, err := s.downloadOnce(ctx, url)
		if err == nil {
			return body, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := time.Duration(2<<attempt) * time.Second // 2s, 4s, 8s, 16s
		slog.Warn("EPSS download failed, retrying",
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

func (s *EPSSSyncer) downloadOnce(ctx context.Context, url string) ([]byte, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, false, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Accept", "*/*")
	req.Header.Set("User-Agent", "vulnscope/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, true, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, false, fmt.Errorf("file not found: status %d", resp.StatusCode)
	}

	if resp.StatusCode == http.StatusTooManyRequests ||
		resp.StatusCode == http.StatusBadGateway ||
		resp.StatusCode == http.StatusServiceUnavailable ||
		resp.StatusCode == http.StatusGatewayTimeout {
		return nil, true, fmt.Errorf("transient status %d", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		preview, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, false, fmt.Errorf("unexpected status %d, body=%q", resp.StatusCode, strings.TrimSpace(string(preview)))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, true, fmt.Errorf("read body: %w", err)
	}

	return body, true, nil
}

type epssRecord struct {
	CVEID      string
	EPSSScore  float64
	Percentile float64
}

func parseCSV(r io.Reader) ([]epssRecord, time.Time, error) {
	reader := csv.NewReader(r)
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	var records []epssRecord
	var scoreDate time.Time
	headerFound := false

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, time.Time{}, fmt.Errorf("read row: %w", err)
		}
		if len(row) == 0 {
			continue
		}

		// Первая строка — комментарий с метаданными:
		// #model_version:...,score_date:YYYY-MM-DD
		if strings.HasPrefix(strings.TrimSpace(row[0]), "#") {
			for i, cell := range row {
				part := strings.TrimSpace(cell)
				if i == 0 {
					part = strings.TrimPrefix(part, "#")
				}
				if strings.HasPrefix(part, "score_date:") {
					dateStr := strings.TrimSpace(strings.TrimPrefix(part, "score_date:"))
					if parsed, err := time.Parse("2006-01-02", dateStr); err == nil {
						scoreDate = parsed
					}
				}
			}
			continue
		}

		// Заголовок CSV: cve,epss,percentile
		if !headerFound {
			if len(row) >= 3 && strings.EqualFold(strings.TrimSpace(row[0]), "cve") {
				headerFound = true
			}
			continue
		}

		if len(row) < 3 {
			continue
		}

		cveID := strings.ToUpper(strings.TrimSpace(row[0]))
		if !strings.HasPrefix(cveID, "CVE-") {
			continue
		}

		epssScore, err := strconv.ParseFloat(strings.TrimSpace(row[1]), 64)
		if err != nil {
			continue
		}

		percentile, err := strconv.ParseFloat(strings.TrimSpace(row[2]), 64)
		if err != nil {
			continue
		}

		records = append(records, epssRecord{
			CVEID:      cveID,
			EPSSScore:  epssScore,
			Percentile: percentile,
		})
	}

	if !headerFound {
		return nil, time.Time{}, fmt.Errorf("header not found")
	}

	if scoreDate.IsZero() {
		scoreDate = time.Now().UTC()
	}

	return records, scoreDate, nil
}

func (s *EPSSSyncer) upsert(ctx context.Context, records []epssRecord, scoreDate time.Time) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE epss_staging (
			cve_id     TEXT NOT NULL,
			epss_score REAL NOT NULL,
			percentile REAL NOT NULL
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging table: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.CVEID,
			float32(rec.EPSSScore),
			float32(rec.Percentile),
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"epss_staging"},
		[]string{"cve_id", "epss_score", "percentile"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO epss_scores (cve_id, epss_score, percentile, score_date, synced_at)
		SELECT cve_id, epss_score, percentile, $1, now()
		FROM epss_staging
		ON CONFLICT (cve_id) DO UPDATE
		SET epss_score = EXCLUDED.epss_score,
		    percentile = EXCLUDED.percentile,
		    score_date = EXCLUDED.score_date,
		    synced_at  = now()
	`, scoreDate)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	slog.Debug("EPSS upsert completed", "rows_affected", tag.RowsAffected())

	return tx.Commit(ctx)
}
