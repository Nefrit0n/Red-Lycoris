package api

import (
	"net/http"

	"github.com/redis/go-redis/v9"

	"redlycoris/internal/storage"
)

func handleDashboardStats(repo *storage.DashboardRepo, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Пробуем Redis-кэш
		var cached storage.DashboardStats
		if storage.CacheGet(ctx, rdb, storage.CacheDashboardStats, &cached) {
			respondJSON(w, http.StatusOK, map[string]any{"data": cached})
			return
		}

		stats, err := repo.GetStats(ctx)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch dashboard stats")
			return
		}

		// Сохраняем в кэш на 60 секунд
		storage.CacheSet(ctx, rdb, storage.CacheDashboardStats, stats, storage.TTLDashboardStats)

		respondJSON(w, http.StatusOK, map[string]any{"data": stats})
	}
}
