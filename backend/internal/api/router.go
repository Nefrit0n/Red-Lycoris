package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/audit"
	"redlycoris/internal/auth"
	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

type routerConfig struct {
	env          string
	version      string
	startTime    time.Time
	scheduler    *enrichment.Scheduler
	auditRepo    *storage.AuditLogRepo
	auditWriter  *audit.Writer
	trustProxy   bool
	cookieSecure bool
	sessionDur   time.Duration
}

type RouterOption func(*routerConfig)

func WithScheduler(s *enrichment.Scheduler) RouterOption {
	return func(c *routerConfig) { c.scheduler = s }
}

func WithAuditRepo(repo *storage.AuditLogRepo) RouterOption {
	return func(c *routerConfig) { c.auditRepo = repo }
}

func WithAuditWriter(writer *audit.Writer) RouterOption {
	return func(c *routerConfig) { c.auditWriter = writer }
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
	closureReasonsRepo := storage.NewClosureReasonsRepo(pool)
	findingEventsRepo := storage.NewFindingEventsRepo(pool)
	projectsRepo := storage.NewProjectsRepo(pool)
	workspaceRepo := storage.NewWorkspaceRepo(pool)
	dashboardRepo := storage.NewDashboardRepo(pool)
	usersRepo := storage.NewUsersRepo(pool)
	sessionsRepo := storage.NewSessionsRepo(pool)
	userProjectRolesRepo := storage.NewUserProjectRolesRepo(pool)
	savedViewsRepo := storage.NewSavedViewsRepo(pool)
	apiTokensRepo := storage.NewAPITokensRepo(pool)
	scansRepo := storage.NewScansRepo(pool)
	auditLogRepo := cfg.auditRepo
	if auditLogRepo == nil {
		auditLogRepo = storage.NewAuditLogRepo(pool)
	}
	auditWriter := cfg.auditWriter
	if auditWriter == nil {
		auditWriter = audit.NewWriter(auditLogRepo)
	}
	authService := auth.NewService(usersRepo, sessionsRepo, cfg.sessionDur)
	setAuthRuntimeConfig(cfg.trustProxy, cfg.cookieSecure, cfg.sessionDur)

	r := chi.NewRouter()

	// Middleware
	r.Use(RecoveryMiddleware)
	r.Use(RequestIDMiddleware)
	r.Use(RequestLoggerMiddleware)
	r.Use(CORSMiddleware(corsOrigins))
	r.Use(LoadSessionMiddleware(authService, apiTokensRepo))
	r.Use(AuditMiddleware(auditWriter))

	// Health check
	r.Get("/health", healthHandler(pool, rdb, cfg.version, cfg.startTime))

	if cfg.env == "dev" {
		r.Get("/api/docs", docsHandler(cfg.env))
		r.Get("/api/openapi.yaml", openAPIHandler(cfg.env))
	}

	// Auth routes
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.With(LoginRateLimit(rdb)).Post("/login", handleLogin(authService, rdb))
		r.Post("/logout", handleLogout(authService))
		r.Post("/refresh", handleRefresh(authService))
		r.Get("/me", handleMe())
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(RequireAuth)

		r.Route("/api/v1/findings", func(r chi.Router) {
			r.Get("/", handleListFindings(findingsRepo, userProjectRolesRepo))
			r.Get("/facets", handleFindingsFacets(findingsRepo, userProjectRolesRepo))
			exporter := newExportHandlers(findingsRepo, userProjectRolesRepo, projectsRepo, auditWriter, rdb, cfg.version)
			r.Get("/export.csv", exporter.handleCSV())
			r.Get("/export.json", exporter.handleNDJSON())
			r.Get("/export.xlsx", exporter.handleXLSX())

			r.Route("/{id}", func(r chi.Router) {
				vMw := RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromFinding(findingsRepo, "id"))
				aMw := RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromFinding(findingsRepo, "id"))

				r.With(vMw).Get("/", handleGetFinding(findingsRepo, scansRepo, pool))
				r.With(vMw).Get("/enrichments", handleGetFindingEnrichments(pool))
				r.With(vMw).Get("/score", handleGetFindingScore(pool))
				r.With(vMw).Get("/events", handleListFindingEvents(findingEventsRepo))
				r.Route("/comments", func(r chi.Router) {
					r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromFinding(findingsRepo, "id"))).
						Get("/", handleListComments(findingEventsRepo))
					r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleTriager, ProjectIDFromFinding(findingsRepo, "id"))).
						Post("/", handleCreateComment(findingEventsRepo))
				})
				r.Group(func(r chi.Router) {
					r.Use(RequireProjectRole(userProjectRolesRepo, domain.RoleTriager, ProjectIDFromFinding(findingsRepo, "id")))
					r.Patch("/status", handleUpdateStatus(findingsRepo))
					r.Post("/close", handleCloseFinding(findingsRepo))
					r.Post("/reopen", handleReopenFinding(findingsRepo))
					r.Post("/assign", handleAssignFinding(findingsRepo, usersRepo, userProjectRolesRepo))
					r.Delete("/assign", handleUnassignFinding(findingsRepo))
					r.Post("/enrich", handleEnrichFinding(pool, rdb))
				})
				r.With(aMw).Delete("/", handleDeleteFinding(findingsRepo))
			})

			r.Patch("/bulk/status", handleBulkUpdateStatus(findingsRepo, userProjectRolesRepo))
			r.Post("/bulk/close", handleBulkClose(findingsRepo, userProjectRolesRepo))
			r.Post("/bulk/assign", handleBulkAssign(findingsRepo, usersRepo, userProjectRolesRepo))
			r.Post("/bulk/unassign", handleBulkUnassign(findingsRepo, userProjectRolesRepo))
		})
		r.Route("/api/v1/finding-comments/{event_id}", func(r chi.Router) {
			r.Use(RequireAuth)
			r.Patch("/", handleEditComment(findingEventsRepo))
			r.Delete("/", handleDeleteComment(findingEventsRepo, findingsRepo, userProjectRolesRepo))
		})

		r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleTriager, ProjectIDFromQuery("project_id"))).
			Post("/api/v1/import", handleImport(findingsRepo, findingEventsRepo, userProjectRolesRepo, rdb))
		r.With(RequireScope("scans:write")).
			Post("/api/v1/scans", handleCreateScan(scansRepo, findingsRepo))
		r.Get("/api/v1/scans/{id}", handleGetScan(scansRepo, userProjectRolesRepo))

		r.Route("/api/v1/workspace", func(r chi.Router) {
			r.Get("/project-templates", handleGetProjectTemplates())
			r.Get("/members", handleGetWorkspaceMembers(workspaceRepo))
			r.Get("/teams", handleGetWorkspaceTeams(workspaceRepo))
			r.Post("/teams", handleCreateWorkspaceTeam(workspaceRepo))
			r.Get("/tags", handleGetWorkspaceTags(workspaceRepo))
		})

		r.Route("/api/v1/projects", func(r chi.Router) {
			r.Get("/", handleListProjects(projectsRepo, userProjectRolesRepo))
			r.Post("/", handleCreateProject(pool, projectsRepo, userProjectRolesRepo))
			// check-slug must be registered before /{id} to avoid routing conflict
			r.Get("/check-slug", handleCheckProjectSlug(workspaceRepo))

			r.Route("/{id}", func(r chi.Router) {
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/", handleGetProject(projectsRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/trend", handleGetProjectTrend(projectsRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/quick-peek", handleGetProjectQuickPeek(projectsRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id"))).
					Put("/", handleUpdateProject(projectsRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id"))).
					Patch("/pinned", handlePatchProjectPinned(projectsRepo))
				r.With(RequireGlobalAdmin).Delete("/", handleDeleteProject(projectsRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id"))).
					Post("/ingest-token", handleGetIngestToken())
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/api-tokens", handleListAPITokens(apiTokensRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id"))).
					Post("/api-tokens", handleCreateAPIToken(apiTokensRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id"))).
					Delete("/api-tokens/{tokenID}", handleRevokeAPIToken(apiTokensRepo))
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/scans", handleListScans(scansRepo))

				r.Route("/members", func(r chi.Router) {
					r.Use(RequireProjectRole(userProjectRolesRepo, domain.RoleProjectAdmin, ProjectIDFromURL("id")))
					r.Get("/", handleListMembers(userProjectRolesRepo))
					r.Post("/", handleAddMember(userProjectRolesRepo))
					r.Put("/{user_id}", handleUpdateMember(userProjectRolesRepo))
					r.Delete("/{user_id}", handleRemoveMember(userProjectRolesRepo))
				})
				r.With(RequireProjectRole(userProjectRolesRepo, domain.RoleViewer, ProjectIDFromURL("id"))).
					Get("/assignable-users", handleAssignableUsers(pool))
			})
		})

		r.Get("/api/v1/closure-reasons", handleListClosureReasons(closureReasonsRepo))

		r.Get("/api/v1/dashboard/stats", handleDashboardStats(dashboardRepo, userProjectRolesRepo, rdb))

		r.Route("/api/v1/enrichment", func(r chi.Router) {
			r.Get("/status", handleEnrichmentStatus(pool, rdb))
			r.Get("/epss/history", handleGetEPSSHistory(pool))
			r.With(RequireGlobalAdmin).Post("/enrich-all", handleEnrichAll(pool))
			if cfg.scheduler != nil {
				r.With(RequireGlobalAdmin).Post("/sync/{source}", handleManualSync(pool, cfg.scheduler))
			}
		})

		r.Route("/api/v1/saved-views", func(r chi.Router) {
			r.Get("/", handleListSavedViews(savedViewsRepo))
			r.Post("/", handleCreateSavedView(savedViewsRepo))
			r.Patch("/{id}", handleUpdateSavedView(savedViewsRepo))
			r.Delete("/{id}", handleDeleteSavedView(savedViewsRepo))
		})

		r.Get("/api/v1/users/search", handleSearchUsers(usersRepo))

		r.Route("/api/v1/admin", func(r chi.Router) {
			r.Use(RequireGlobalAdmin)
			r.Get("/users", handleListUsers(usersRepo))
			r.Post("/users", handleCreateUser(usersRepo))
			r.Patch("/users/{id}", handleUpdateUser(usersRepo))
			r.Patch("/users/{id}/role", handleChangeUserRole(usersRepo, sessionsRepo))
			r.Post("/users/{id}/reset-password", handleResetUserPassword(usersRepo, sessionsRepo))
			r.Post("/users/{id}/deactivate", handleDeactivateUser(usersRepo, sessionsRepo))
			r.Post("/users/{id}/activate", handleActivateUser(usersRepo))
			r.Delete("/users/{id}", handleDeleteUser(usersRepo, sessionsRepo))
			r.Get("/users/{id}/roles", handleGetUserRoles(userProjectRolesRepo))
			r.Get("/audit", handleListAuditLog(auditLogRepo))
			r.Get("/audit/stats", handleAuditStats(auditLogRepo))
			r.Get("/audit/stream", handleAuditStream(auditLogRepo))
			r.Get("/audit/export", handleAuditExport(auditLogRepo))
			r.Get("/audit/{id}", handleGetAuditEvent(auditLogRepo))
			r.Get("/audit/{id}/diff", handleGetAuditDiff(auditLogRepo))
			r.Get("/audit/{id}/related", handleGetRelatedAuditEvents(auditLogRepo))
		})
	})

	return r
}
