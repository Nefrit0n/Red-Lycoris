package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/auth"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

type routerConfig struct {
	env          string
	version      string
	startTime    time.Time
	scheduler    *enrichment.Scheduler
	trustProxy   bool
	cookieSecure bool
	sessionDur   time.Duration
}

type RouterOption func(*routerConfig)

func WithScheduler(s *enrichment.Scheduler) RouterOption {
	return func(c *routerConfig) { c.scheduler = s }
}

func WithEnv(env string) RouterOption {
	return func(c *routerConfig) { c.env = env }
}

func WithVersion(version string) RouterOption {
	return func(c *routerConfig) { c.version = version }
}

func WithStartTime(startTime time.Time) RouterOption {
	return func(c *routerConfig) { c.startTime = startTime }
}

func WithTrustProxy(trustProxy bool) RouterOption {
	return func(c *routerConfig) { c.trustProxy = trustProxy }
}

func WithCookieSecure(cookieSecure bool) RouterOption {
	return func(c *routerConfig) { c.cookieSecure = cookieSecure }
}

func WithSessionDuration(d time.Duration) RouterOption {
	return func(c *routerConfig) { c.sessionDur = d }
}

func NewRouter(pool *pgxpool.Pool, rdb *redis.Client, corsOrigins string, opts ...RouterOption) http.Handler {
	var cfg routerConfig
	cfg.env = "dev"
	cfg.version = "dev"
	cfg.startTime = time.Now()
	cfg.sessionDur = 7 * 24 * time.Hour

	for _, opt := range opts {
		opt(&cfg)
	}

	findingsRepo := storage.NewFindingsRepo(pool)
	projectsRepo := storage.NewProjectsRepo(pool)
	dashboardRepo := storage.NewDashboardRepo(pool)
	usersRepo := storage.NewUsersRepo(pool)
	sessionsRepo := storage.NewSessionsRepo(pool)
	authService := auth.NewService(usersRepo, sessionsRepo, cfg.sessionDur)
	setAuthRuntimeConfig(cfg.trustProxy, cfg.cookieSecure, cfg.sessionDur)

	r := chi.NewRouter()

	// Middleware
	r.Use(RequestIDMiddleware)
	r.Use(LoadSessionMiddleware(authService))
	r.Use(RecoveryMiddleware)
	r.Use(RequestLoggerMiddleware)
	r.Use(CORSMiddleware(corsOrigins))

	// Health check
	r.Get("/health", healthHandler(pool, rdb, cfg.version, cfg.startTime))

	r.Get("/api/docs", docsHandler(cfg.env))
	r.Get("/api/openapi.yaml", openAPIHandler(cfg.env))

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
			r.Post("/", handleImport(findingsRepo, rdb))

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

		// ───────────────────── Auth ─────────────────────
		r.Route("/auth", func(r chi.Router) {
			r.With(LoginRateLimit(rdb)).Post("/login", handleLogin(authService, rdb))
			r.Post("/logout", handleLogout(authService))
			r.Post("/refresh", handleRefresh(authService))
			r.Get("/me", handleMe())
		})
	})

	return r
}
