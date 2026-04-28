package enrichment

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/observability"
)

// Syncer — интерфейс для источника обогащения.
type Syncer interface {
	Sync(ctx context.Context) error
	Name() string
}

// SyncStatus отражает строку из таблицы sync_status.
type SyncStatus struct {
	Source          string     `json:"source"`
	LastSyncAt      *time.Time `json:"last_sync_at"`
	RecordsCount    int        `json:"records_count"`
	Status          string     `json:"status"`
	ErrorMessage    string     `json:"error_message,omitempty"`
	DurationSeconds int        `json:"duration_seconds"`
}

// RunSync запускает синхронизатор и обновляет sync_status в БД.
func RunSync(ctx context.Context, syncer Syncer, pool *pgxpool.Pool) error {
	name := syncer.Name()
	slog.Info("starting sync", "source", name)

	// Ставим статус "running"
	_, err := pool.Exec(ctx, `
		INSERT INTO sync_status (source, status, last_sync_at, updated_at)
		VALUES ($1, 'running', now(), now())
		ON CONFLICT (source) DO UPDATE
		SET status = 'running', error_message = NULL, updated_at = now()
	`, name)
	if err != nil {
		return fmt.Errorf("enrichment.RunSync: update status to running: %w", err)
	}

	start := time.Now()
	jobID := uuid.New()
	_, _ = pool.Exec(ctx, `
		INSERT INTO enrichment_jobs (job_id, source_code, started_at, status, retry_count, max_retries, occurred_at)
		VALUES ($1, $2, now(), 'running', 0, 5, now())
	`, jobID, name)
	syncErr := syncer.Sync(ctx)
	duration := int(time.Since(start).Seconds())

	if syncErr != nil {
		slog.Error("sync failed", "source", name, "error", syncErr, "duration_seconds", duration)
		_, dbErr := pool.Exec(ctx, `
			UPDATE sync_status
			SET status = 'error', error_message = $2, duration_seconds = $3, updated_at = now()
			WHERE source = $1
		`, name, syncErr.Error(), duration)
		_, _ = pool.Exec(ctx, `
			UPDATE enrichment_jobs
			SET status = 'failed', message = $2, finished_at = now(), occurred_at = now(), retry_count = 1, max_retries = 5, next_retry_at = now() + interval '2 minutes'
			WHERE job_id = $1
		`, jobID, syncErr.Error())
		if dbErr != nil {
			slog.Error("failed to update sync_status after error", "source", name, "error", dbErr)
		}
		return fmt.Errorf("enrichment.RunSync: %s: %w", name, syncErr)
	}

	// Подсчитаем records_count из соответствующей таблицы
	count := countRecords(ctx, pool, name)

	_, err = pool.Exec(ctx, `
		UPDATE sync_status
		SET status = 'success', last_sync_at = now(), records_count = $2,
		    duration_seconds = $3, error_message = NULL, updated_at = now()
		WHERE source = $1
	`, name, count, duration)
	_, _ = pool.Exec(ctx, `
		UPDATE enrichment_jobs
		SET status = 'success', finished_at = now(), occurred_at = now()
		WHERE job_id = $1
	`, jobID)
	_, _ = pool.Exec(ctx, `
		INSERT INTO enrichment_source_stats (source_code, snapshot_at, record_count)
		VALUES ($1, now(), $2)
		ON CONFLICT (source_code, snapshot_at) DO NOTHING
	`, name, count)
	if err != nil {
		slog.Error("failed to update sync_status after success", "source", name, "error", err)
	}

	slog.Info("sync completed", "source", name, "records", count, "duration_seconds", duration)
	return nil
}

func countRecords(ctx context.Context, pool *pgxpool.Pool, source string) int {
	var table string
	switch source {
	case "epss":
		table = "epss_scores"
	case "kev":
		table = "kev_catalog"
	case "nvd":
		table = "nvd_cves"
	case "bdu":
		table = "bdu_fstec"
	case "osv":
		table = "osv_vulnerabilities"
	case "cwe":
		table = "cwe_catalog"
	case "cpe":
		table = "cpe_dictionary"
	default:
		return 0
	}

	var count int
	// Таблицы перечислены явно выше, SQL-инъекции нет
	err := pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count)
	if err != nil {
		slog.Error("failed to count records", "table", table, "error", err)
		return 0
	}
	return count
}

// GetAllSyncStatuses возвращает статусы всех синхронизаций.
func GetAllSyncStatuses(ctx context.Context, pool *pgxpool.Pool) ([]SyncStatus, error) {
	rows, err := pool.Query(ctx, `
		SELECT source, last_sync_at, records_count, status,
		       COALESCE(error_message, ''), COALESCE(duration_seconds, 0)
		FROM sync_status
		ORDER BY source
	`)
	if err != nil {
		return nil, fmt.Errorf("enrichment.GetAllSyncStatuses: %w", err)
	}
	defer rows.Close()

	var statuses []SyncStatus
	for rows.Next() {
		var s SyncStatus
		if err := rows.Scan(&s.Source, &s.LastSyncAt, &s.RecordsCount, &s.Status, &s.ErrorMessage, &s.DurationSeconds); err != nil {
			return nil, fmt.Errorf("enrichment.GetAllSyncStatuses: scan: %w", err)
		}
		statuses = append(statuses, s)
	}
	return statuses, rows.Err()
}

func StartMetricsCollector(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client, obs *observability.Observability) {
	if obs == nil {
		return
	}

	collect := func() {
		obs.EnrichmentStreamLag.Set(map[string]string{"source": "nvd"}, readStreamLag(ctx, rdb))
		obs.EnrichmentLastSyncAge.Set(map[string]string{"source": "nvd"}, readSyncAge(ctx, pool, "nvd"))
	}

	collect()
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				collect()
			}
		}
	}()
}

func readStreamLag(ctx context.Context, rdb *redis.Client) float64 {
	groups, err := rdb.XInfoGroups(ctx, StreamName).Result()
	if err != nil {
		slog.Warn("enrichment metrics: xinfo groups failed", "error", err)
		return fallbackLagFromBaseline(ctx, rdb)
	}
	for _, group := range groups {
		if group.Name == ConsumerGroup {
			if group.Lag < 0 {
				return 0
			}
			return float64(group.Lag)
		}
	}
	return fallbackLagFromBaseline(ctx, rdb)
}

func readSyncAge(ctx context.Context, pool *pgxpool.Pool, source string) float64 {
	var lastSyncAt *time.Time
	if err := pool.QueryRow(ctx, "SELECT last_sync_at FROM sync_status WHERE source = $1", source).Scan(&lastSyncAt); err != nil {
		slog.Warn("enrichment metrics: failed to fetch last_sync_at", "source", source, "error", err)
		return 0
	}
	if lastSyncAt == nil {
		return 0
	}
	return time.Since(*lastSyncAt).Seconds()
}

func fallbackLagFromBaseline(ctx context.Context, rdb *redis.Client) float64 {
	xlen, err := rdb.XLen(ctx, StreamName).Result()
	if err != nil {
		return 0
	}
	lag := xlen - streamLagBaseline()
	if lag < 0 {
		return 0
	}
	return float64(lag)
}
