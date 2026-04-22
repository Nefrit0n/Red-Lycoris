package api

import (
	"context"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

var cveRegex = regexp.MustCompile(`^CVE-\d{4}-\d{4,}$`)

func handleEnrichmentStatus(pool *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		statuses, err := enrichment.GetAllSyncStatuses(ctx, pool)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get sync statuses")
			return
		}
		if statuses == nil {
			statuses = []enrichment.SyncStatus{}
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": statuses})
	}
}

func handleGetFindingEnrichments(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		enrichmentsData, err := enrichment.GetFindingEnrichments(r.Context(), pool, id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get finding enrichments")
			return
		}
		if enrichmentsData == nil {
			enrichmentsData = []domain.FindingEnrichment{}
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": enrichmentsData})
	}
}

func handleGetFindingScore(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		score, err := enrichment.GetFindingScore(r.Context(), pool, id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get finding score")
			return
		}
		if score == nil {
			respondJSON(w, http.StatusOK, map[string]any{"data": nil})
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": score})
	}
}

func handleManualSync(pool *pgxpool.Pool, scheduler *enrichment.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		source := chi.URLParam(r, "source")
		if source == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "source is required")
			return
		}

		syncer := scheduler.GetSyncer(source)
		if syncer == nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "unknown source: "+source)
			return
		}

		go func(source string) {
			if err := scheduler.TriggerSync(context.Background(), source); err != nil {
				slog.Error("manual sync failed", "source", source, "error", err)
			}
		}(source)

		respondJSON(w, http.StatusAccepted, map[string]any{
			"data": map[string]string{
				"source":  source,
				"message": "sync started",
			},
		})
	}
}

// handleEnrichFinding запускает обогащение одного finding.
func handleEnrichFinding(pool *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		// Инвалидируем кэш enrichment для этого finding
		storage.CacheInvalidateEnrichment(r.Context(), rdb, id.String())

		// Публикуем в Redis Stream для обработки воркером
		if err := enrichment.PublishEnrichment(r.Context(), rdb, id); err != nil {
			slog.Error("failed to publish enrichment", "finding_id", id, "error", err)

			// Fallback: обогащаем синхронно
			if err := enrichment.EnrichFinding(r.Context(), pool, id); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "enrichment failed")
				return
			}

			respondJSON(w, http.StatusOK, map[string]any{
				"data": map[string]any{
					"finding_id": id,
					"status":     "enriched_sync",
				},
			})
			return
		}

		respondJSON(w, http.StatusAccepted, map[string]any{
			"data": map[string]any{
				"finding_id": id,
				"status":     "queued",
			},
		})
	}
}

// handleEnrichAll запускает обогащение всех необогащённых findings (batch по 100).
func handleEnrichAll(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Запускаем в фоне чтобы не блокировать ответ
		go func() {
			ctx := context.Background()
			var totalEnriched, totalFailed int

			for {
				// Находим необогащённые findings (без записи в finding_scores)
				rows, err := pool.Query(ctx, `
					SELECT f.id
					FROM findings f
					LEFT JOIN finding_scores fs ON fs.finding_id = f.id
					WHERE fs.finding_id IS NULL
					LIMIT 100
				`)
				if err != nil {
					slog.Error("enrich-all: query failed", "error", err)
					return
				}

				var ids []uuid.UUID
				for rows.Next() {
					var id uuid.UUID
					if err := rows.Scan(&id); err != nil {
						continue
					}
					ids = append(ids, id)
				}
				rows.Close()

				if len(ids) == 0 {
					break
				}

				enriched, failed := enrichment.EnrichBatch(ctx, pool, ids)
				totalEnriched += enriched
				totalFailed += failed

				slog.Info(
					"enrich-all: batch completed",
					"batch_enriched", enriched,
					"batch_failed", failed,
					"total_enriched", totalEnriched,
					"total_failed", totalFailed,
				)
			}

			slog.Info("enrich-all: completed", "enriched", totalEnriched, "failed", totalFailed)
		}()

		respondJSON(w, http.StatusAccepted, map[string]any{
			"data": map[string]string{
				"status": "enrich-all started",
			},
		})
	}
}

func handleGetEPSSHistory(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cveID := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("cve")))
		if !cveRegex.MatchString(cveID) {
			respondError(w, r, http.StatusBadRequest, "INVALID_CVE", "invalid CVE identifier")
			return
		}

		days := 90
		if d := r.URL.Query().Get("days"); d != "" {
			if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 && parsed <= 365 {
				days = parsed
			}
		}

		rows, err := pool.Query(r.Context(), `
			SELECT score_date, epss_score, percentile
			FROM epss_history
			WHERE cve_id = $1
			  AND score_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
			ORDER BY score_date ASC
		`, cveID, days)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "DB_ERROR", err.Error())
			return
		}
		defer rows.Close()

		type point struct {
			Date       time.Time `json:"date"`
			Score      float64   `json:"score"`
			Percentile float64   `json:"percentile"`
		}

		var points []point
		for rows.Next() {
			var p point
			var score, pct float32
			if err := rows.Scan(&p.Date, &score, &pct); err == nil {
				p.Score = float64(score)
				p.Percentile = float64(pct)
				points = append(points, p)
			}
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{
				"cve_id": cveID,
				"days":   days,
				"points": points,
			},
		})
	}
}
