package api

import (
	"net/http"

	"vulnscope/internal/storage"
)

func handleDashboardStats(repo *storage.DashboardRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := repo.GetStats(r.Context())
		if err != nil {
			respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch dashboard stats")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{
			"data": stats,
		})
	}
}
