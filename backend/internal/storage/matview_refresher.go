package storage

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// StartMatViewRefresher запускает фоновую горутину, которая обновляет
// materialized views каждые interval. Останавливается при отмене контекста.
func StartMatViewRefresher(ctx context.Context, pool *pgxpool.Pool, interval time.Duration) {
	go func() {
		slog.Info("matview refresher started", "interval", interval)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				slog.Info("matview refresher stopped")
				return
			case <-ticker.C:
				refreshMaterializedViews(ctx, pool)
			}
		}
	}()
}

func refreshMaterializedViews(ctx context.Context, pool *pgxpool.Pool) {
	views := []string{"dashboard_stats", "enrichment_coverage"}

	for _, view := range views {
		start := time.Now()
		_, err := pool.Exec(ctx, "REFRESH MATERIALIZED VIEW CONCURRENTLY "+view)
		if err != nil {
			slog.Error("matview refresh failed", "view", view, "error", err)
			continue
		}
		slog.Debug("matview refreshed", "view", view, "duration", time.Since(start))
	}
}
