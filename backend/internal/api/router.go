package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"vulnscope/internal/enrichment"
	"vulnscope/internal/storage"
)

type routerConfig struct {
	scheduler *enrichment.Scheduler
}

type RouterOption func(*routerConfig)

func WithScheduler(s *enrichment.Scheduler) RouterOption {
	return func(c *routerConfig) { c.scheduler = s }
}

func NewRouter(pool *pgxpool.Pool, rdb *redis.Client, corsOrigins string, opts ...RouterOption) http.Handler {
	var cfg routerConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	findingsRepo := storage.NewFindingsRepo(pool)
	projectsRepo := storage.NewProjectsRepo(pool)
	dashboardRepo := storage.NewDashboardRepo(pool)

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

		// ───────────────────── Projects ─────────────────────
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", handleListProjects(projectsRepo))
			r.Post("/", handleCreateProject(projectsRepo))
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handleGetProject(projectsRepo))
				r.Put("/", handleUpdateProject(projectsRepo))
				r.Delete("/", handleDeleteProject(projectsRepo))
			})
		})

		// ───────────────────── Findings ─────────────────────
		r.Route("/findings", func(r chi.Router) {
			r.Get("/", handleListFindings(findingsRepo))

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handleGetFinding(findingsRepo, pool))

				// 🔥 ВАЖНО — то, чего не хватало
				r.Get("/enrichments", handleGetFindingEnrichments(pool))
				r.Get("/score", handleGetFindingScore(pool))

				r.Patch("/status", handleUpdateStatus(findingsRepo))
				r.Post("/enrich", handleEnrichFinding(pool, rdb))
				r.Delete("/", handleDeleteFinding(findingsRepo))
			})

			r.Patch("/bulk/status", handleBulkUpdateStatus(findingsRepo))
		})

		// ───────────────────── Dashboard ─────────────────────
		r.Get("/dashboard/stats", handleDashboardStats(dashboardRepo, rdb))

		// ───────────────────── Import ─────────────────────
		r.Post("/import", handleImport(findingsRepo, rdb))

		// ───────────────────── Enrichment system ─────────────────────
		r.Route("/enrichment", func(r chi.Router) {
			r.Get("/status", handleEnrichmentStatus(pool, rdb))
			r.Post("/enrich-all", handleEnrichAll(pool))

			if cfg.scheduler != nil {
				r.Post("/sync/{source}", handleManualSync(pool, cfg.scheduler))
			}
		})
	})

	return r
}
