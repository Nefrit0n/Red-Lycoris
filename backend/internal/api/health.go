package api

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type healthComponent struct {
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
	Error     string `json:"error,omitempty"`
}

type enrichmentSyncStatus struct {
	Source   string     `json:"source"`
	LastSync *time.Time `json:"last_sync"`
	Status   string     `json:"status"`
}

type healthComponents struct {
	Database   healthComponent        `json:"database"`
	Redis      healthComponent        `json:"redis"`
	Enrichment []enrichmentSyncStatus `json:"enrichment"`
}

func healthHandler(pool *pgxpool.Pool, rdb *redis.Client, version string, startTime time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		healthStatus := "ok"

		database := healthComponent{Status: "ok"}
		dbStart := time.Now()
		var one int
		if err := pool.QueryRow(r.Context(), "SELECT 1").Scan(&one); err != nil {
			database.Status = "error"
			database.Error = err.Error()
			healthStatus = "error"
		} else {
			database.LatencyMS = time.Since(dbStart).Milliseconds()
		}

		redis := healthComponent{Status: "ok"}
		redisStart := time.Now()
		if err := rdb.Ping(r.Context()).Err(); err != nil {
			redis.Status = "error"
			redis.Error = err.Error()
			healthStatus = "error"
		} else {
			redis.LatencyMS = time.Since(redisStart).Milliseconds()
		}

		enrichmentStatuses := make([]enrichmentSyncStatus, 0)
		rows, err := pool.Query(r.Context(), `
			SELECT source, last_sync_at, status
			FROM sync_status
			ORDER BY source
		`)
		if err != nil {
			healthStatus = "error"
			enrichmentStatuses = []enrichmentSyncStatus{{
				Source: "sync_status",
				Status: "error",
			}}
		} else {
			defer rows.Close()
			for rows.Next() {
				var item enrichmentSyncStatus
				if scanErr := rows.Scan(&item.Source, &item.LastSync, &item.Status); scanErr != nil {
					healthStatus = "error"
					continue
				}
				enrichmentStatuses = append(enrichmentStatuses, item)
			}
			if rows.Err() != nil {
				healthStatus = "error"
			}
		}

		statusCode := http.StatusOK
		if healthStatus == "error" {
			statusCode = http.StatusServiceUnavailable
		}

		respondJSON(w, statusCode, map[string]any{
			"status":         healthStatus,
			"version":        version,
			"uptime_seconds": int(time.Since(startTime).Seconds()),
			"components": healthComponents{
				Database:   database,
				Redis:      redis,
				Enrichment: enrichmentStatuses,
			},
		})
	}
}
