package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"vulnscope/internal/storage"
)

func NewRouter(pool *pgxpool.Pool, rdb *redis.Client, corsOrigins string) http.Handler {
	findingsRepo := storage.NewFindingsRepo(pool)
	projectsRepo := storage.NewProjectsRepo(pool)

	r := chi.NewRouter()

	// Middleware
	r.Use(RecoveryMiddleware)
	r.Use(RequestLoggerMiddleware)
	r.Use(CORSMiddleware(corsOrigins))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "connected"
		if err := pool.Ping(r.Context()); err != nil {
			dbStatus = "disconnected"
		}

		redisStatus := "connected"
		if err := rdb.Ping(r.Context()).Err(); err != nil {
			redisStatus = "disconnected"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"db":     dbStatus,
			"redis":  redisStatus,
		})
	})

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Projects
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", handleListProjects(projectsRepo))
			r.Post("/", handleCreateProject(projectsRepo))
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handleGetProject(projectsRepo))
				r.Put("/", handleUpdateProject(projectsRepo))
				r.Delete("/", handleDeleteProject(projectsRepo))
			})
		})

		// Findings
		r.Route("/findings", func(r chi.Router) {
			r.Get("/", handleListFindings(findingsRepo))
			r.Get("/{id}", handleGetFinding(findingsRepo))
			r.Patch("/{id}/status", handleUpdateStatus(findingsRepo))
			r.Patch("/bulk/status", handleBulkUpdateStatus(findingsRepo))
			r.Delete("/{id}", handleDeleteFinding(findingsRepo))
		})

		// Import
		r.Post("/import", handleImport(findingsRepo))
	})

	return r
}
