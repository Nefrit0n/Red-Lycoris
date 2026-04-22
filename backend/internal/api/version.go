package api

import (
	"net/http"
	"runtime"
	"time"

	buildversion "redlycoris/internal/version"
)

func handleVersion() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setPublicCacheHeaders(w, 5*time.Minute)
		respondJSON(w, http.StatusOK, map[string]any{
			"version":    buildversion.Version,
			"commit":     buildversion.Commit,
			"build_date": buildversion.Date,
			"go_version": runtime.Version(),
		})
	}
}
