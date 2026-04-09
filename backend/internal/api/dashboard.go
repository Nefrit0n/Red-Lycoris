package api

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func handleDashboardStats(repo *storage.DashboardRepo, rolesRepo *storage.UserProjectRolesRepo, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		user, _ := UserFromContext(ctx)

		var accessible []uuid.UUID
		if !user.IsAdmin() {
			ids, err := rolesRepo.ListProjectIDsForUser(ctx, user.ID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch dashboard stats")
				return
			}
			accessible = ids
			if len(accessible) == 0 {
				respondJSON(w, http.StatusOK, map[string]any{"data": &storage.DashboardStats{
					BySeverity:  []storage.SeverityCount{},
					ByStatus:    []storage.StatusCount{},
					TopFindings: []domain.Finding{},
				}})
				return
			}
		}

		// Пробуем Redis-кэш только для админа (глобальная статистика).
		if user.IsAdmin() {
			var cached storage.DashboardStats
			if storage.CacheGet(ctx, rdb, storage.CacheDashboardStats, &cached) {
				respondJSON(w, http.StatusOK, map[string]any{"data": cached})
				return
			}
		}

		stats, err := repo.GetStats(ctx, storage.DashboardFilter{AccessibleProjectIDs: accessible})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch dashboard stats")
			return
		}

		if user.IsAdmin() {
			// Сохраняем в кэш на 60 секунд
			storage.CacheSet(ctx, rdb, storage.CacheDashboardStats, stats, storage.TTLDashboardStats)
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": stats})
	}
}
