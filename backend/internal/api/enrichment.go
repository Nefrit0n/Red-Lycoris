package api

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"vulnscope/internal/enrichment"
)

func handleEnrichmentStatus(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		statuses, err := enrichment.GetAllSyncStatuses(r.Context(), pool)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get sync statuses")
			return
		}
		if statuses == nil {
			statuses = []enrichment.SyncStatus{}
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": statuses})
	}
}

func handleManualSync(pool *pgxpool.Pool, scheduler *enrichment.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		source := chi.URLParam(r, "source")
		if source == "" {
			respondError(w, http.StatusBadRequest, "VALIDATION_ERROR", "source is required")
			return
		}

		syncer := scheduler.GetSyncer(source)
		if syncer == nil {
			respondError(w, http.StatusNotFound, "NOT_FOUND", "unknown source: "+source)
			return
		}

		// Запускаем синхронизацию в горутине, чтобы не блокировать ответ.
		// Используем отдельный контекст — request context отменяется при завершении запроса.
		go enrichment.RunSync(context.Background(), syncer, pool)

		respondJSON(w, http.StatusAccepted, map[string]any{
			"data": map[string]string{
				"source":  source,
				"message": "sync started",
			},
		})
	}
}
