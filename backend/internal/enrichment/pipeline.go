package enrichment

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
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
	syncErr := syncer.Sync(ctx)
	duration := int(time.Since(start).Seconds())

	if syncErr != nil {
		slog.Error("sync failed", "source", name, "error", syncErr, "duration_seconds", duration)
		_, dbErr := pool.Exec(ctx, `
			UPDATE sync_status
			SET status = 'error', error_message = $2, duration_seconds = $3, updated_at = now()
			WHERE source = $1
		`, name, syncErr.Error(), duration)
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
