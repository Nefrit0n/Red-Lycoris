package epss

import (
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

	var resp *http.Response
	var usedURL string
	for _, date := range dates {
		url := fmt.Sprintf(urlTemplate, date)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return fmt.Errorf("epss.Sync: create request: %w", err)
		}

		r, err := s.client.Do(req)
		if err != nil {
			return fmt.Errorf("epss.Sync: download: %w", err)
		}

		if r.StatusCode == http.StatusOK {
			resp = r
			usedURL = url
			break
		}
		r.Body.Close()
		slog.Debug("EPSS file not available", "url", url, "status", r.StatusCode)
	}

	if resp == nil {
		return fmt.Errorf("epss.Sync: no EPSS file available for dates %v", dates)
	}
	defer resp.Body.Close()
	slog.Debug("EPSS downloading", "url", usedURL)

	gz, err := gzip.NewReader(resp.Body)
	if err != nil {
		return fmt.Errorf("epss.Sync: gzip reader: %w", err)
	}
	defer gz.Close()

	records, scoreDate, err := parseCSV(gz)
	if err != nil {
		return fmt.Errorf("epss.Sync: parse CSV: %w", err)
	}

	if err := s.upsert(ctx, records, scoreDate); err != nil {
		return fmt.Errorf("epss.Sync: upsert: %w", err)
	}

	slog.Info("EPSS sync: imported records", "count", len(records))
	return nil
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

		// Первая строка — комментарий с метаданными (#model_version:...,score_date:YYYY-MM-DD)
		if len(row) > 0 && strings.HasPrefix(row[0], "#") {
			for _, part := range strings.Split(row[0], ",") {
				part = strings.TrimSpace(part)
				if strings.HasPrefix(part, "score_date:") {
					dateStr := strings.TrimPrefix(part, "score_date:")
					scoreDate, _ = time.Parse("2006-01-02", dateStr)
				}
			}
			continue
		}

		// Заголовок CSV: cve,epss,percentile
		if !headerFound {
			if len(row) >= 3 && strings.ToLower(strings.TrimSpace(row[0])) == "cve" {
				headerFound = true
			}
			continue
		}

		if len(row) < 3 {
			continue
		}

		cveID := strings.TrimSpace(row[0])
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

	if scoreDate.IsZero() {
		scoreDate = time.Now().UTC()
	}

	return records, scoreDate, nil
}

func (s *EPSSSyncer) upsert(ctx context.Context, records []epssRecord, scoreDate time.Time) error {
	// Создаём временную таблицу, COPY в неё, затем upsert
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

	// CopyFrom для максимальной скорости загрузки
	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{rec.CVEID, float32(rec.EPSSScore), float32(rec.Percentile)}
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

	// Upsert из staging в основную таблицу
	tag, err := tx.Exec(ctx, `
		INSERT INTO epss_scores (cve_id, epss_score, percentile, score_date, synced_at)
		SELECT cve_id, epss_score, percentile, $1, now()
		FROM epss_staging
		ON CONFLICT (cve_id) DO UPDATE
		SET epss_score  = EXCLUDED.epss_score,
		    percentile  = EXCLUDED.percentile,
		    score_date  = EXCLUDED.score_date,
		    synced_at   = now()
	`, scoreDate)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	slog.Debug("EPSS upsert completed", "rows_affected", tag.RowsAffected())

	return tx.Commit(ctx)
}
