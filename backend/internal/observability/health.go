package observability

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type readinessCheck struct {
	Name  string `json:"name"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type readinessResponse struct {
	Status string           `json:"status"`
	Checks []readinessCheck `json:"checks,omitempty"`
}

func (o *Observability) Healthz() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

func (o *Observability) Readyz(pool *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		checks := make([]readinessCheck, 0, 2)

		dbCheck := readinessCheck{Name: "postgres", OK: true}
		dbCtx, dbCancel := context.WithTimeout(r.Context(), 2*time.Second)
		if err := pool.Ping(dbCtx); err != nil {
			dbCheck.OK = false
			dbCheck.Error = err.Error()
		}
		dbCancel()
		checks = append(checks, dbCheck)

		redisCheck := readinessCheck{Name: "redis", OK: true}
		redisCtx, redisCancel := context.WithTimeout(r.Context(), 2*time.Second)
		if err := rdb.Ping(redisCtx).Err(); err != nil {
			redisCheck.OK = false
			redisCheck.Error = err.Error()
		}
		redisCancel()
		checks = append(checks, redisCheck)

		ready := true
		for _, check := range checks {
			if !check.OK {
				ready = false
				break
			}
		}

		statusCode := http.StatusOK
		payload := readinessResponse{Status: "ready"}
		if !ready {
			statusCode = http.StatusServiceUnavailable
			payload = readinessResponse{Status: "not_ready", Checks: checks}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(payload)
	}
}
