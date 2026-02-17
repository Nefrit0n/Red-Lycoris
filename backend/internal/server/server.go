package server

import (
	"context"
	"database/sql"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/authz"
	"red-lycoris/backend/internal/config"
	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/handlers"
	"red-lycoris/backend/internal/metrics"
	"red-lycoris/backend/internal/middleware"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/objectstore"
	"red-lycoris/backend/internal/policies"
	"red-lycoris/backend/internal/sla"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/google/uuid"
)

func NewApp(cfg config.Config, db *sql.DB, publisher *events.Publisher, store objectstore.Store) *fiber.App {
	minArchiveBytes := int64(104857600)
	maxArchiveBytes := parseInt64WithDefault(cfg.AnalysisMaxArchiveBytes, 209715200)
	if maxArchiveBytes <= 0 {
		maxArchiveBytes = minArchiveBytes
	}
	if maxArchiveBytes < minArchiveBytes {
		maxArchiveBytes = minArchiveBytes
	}
	if maxArchiveBytes > int64(math.MaxInt) {
		maxArchiveBytes = int64(math.MaxInt)
	}
	app := fiber.New(fiber.Config{
		BodyLimit: int(maxArchiveBytes),
	})
	app.Use(requestid.New())
	app.Use(middleware.RequestLogger(slog.New(slog.NewJSONHandler(os.Stdout, nil))))
	setupRoutes(app, cfg, db, publisher, store)
	return app
}

func parseInt64WithDefault(raw string, fallback int64) int64 {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func setupRoutes(app *fiber.App, cfg config.Config, db *sql.DB, publisher *events.Publisher, store objectstore.Store) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/readyz", func(c *fiber.Ctx) error {
		if err := db.PingContext(context.Background()); err != nil {
			return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"status": "not_ready"})
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})

	app.Get("/api/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Hello World"})
	})

	app.Get("/metrics/sla", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"sla_breach_updated_total":    metrics.SLABreachUpdatedTotal(),
			"sla_breach_last_run_updated": metrics.SLABreachLastRunUpdated(),
			"sla_breach_last_run_unix":    metrics.SLABreachLastRunUnix(),
		})
	})

	app.Get("/metrics/sbom", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"sbom_index_total":                metrics.SbomIndexTotal(),
			"sbom_index_failed_total":         metrics.SbomIndexFailedTotal(),
			"sbom_index_duration_total_ms":    metrics.SbomIndexDurationTotalMs(),
			"sbom_index_last_duration_ms":     metrics.SbomIndexLastDurationMs(),
			"sbom_index_last_component_count": metrics.SbomIndexLastComponentCount(),
		})
	})

	app.Get("/metrics/risk", func(c *fiber.Ctx) error {
		lag, err := storage.CountFindingsMissingCurrentRiskModel(c.Context(), db)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to compute risk lag"})
		}
		return c.JSON(fiber.Map{
			"risk_scheduler_enqueued_total": metrics.RiskSchedulerEnqueuedAll(),
			"risk_compute_processed_total":  metrics.RiskComputeProcessedAll(),
			"risk_model_lag_total":          lag,
		})
	})

	api := app.Group("/api/v1")

	// ✅ НОВЫЙ КОНТРАКТ (без rootPassword)
	authHandler := handlers.NewAuthHandler(
		db,
		cfg.JWTSecret,
		cfg.RootEmail,
	)

	api.Post("/auth/login", authHandler.Login)
	api.Post("/auth/logout", authHandler.Logout)

	secured := api.Group("", middleware.RequireJWT(cfg.JWTSecret))

	authzEvaluator := authz.NewEvaluator(storageAccessReader{db: db})
	secured.Post("/auth/change-password", authHandler.ChangePassword)

	policyRepo := storage.NewPolicyRepository(db)
	policyEngine := policies.NewEngine(policyRepo)

	slaMatrix := sla.MatrixFromConfig(cfg)
	scanHandler := handlers.NewScanUploadHandler(db, publisher, policyEngine, slaMatrix)
	secured.Post(
		"/scans/upload",
		middleware.AuthorizeRole("analyst", "admin"),
		scanHandler.Handle,
	)

	analysisHandler := handlers.NewAnalysisJobsHandler(db, store, publisher, cfg)
	secured.Post(
		"/analysis-jobs",
		middleware.AuthorizeRole("analyst", "admin"),
		analysisHandler.Create,
	)
	secured.Get("/analysis-jobs", analysisHandler.List)
	secured.Get("/analysis-jobs/:id", analysisHandler.Get)
	secured.Get("/analysis-jobs/:id/artifacts/:artifact", analysisHandler.DownloadArtifact)

	findingsHandler := handlers.NewFindingsHandler(db, policyEngine, slaMatrix)
	secured.Get("/findings", findingsHandler.List)
	secured.Get("/findings/:id", findingsHandler.Get)
	secured.Get("/findings/:id/neighbors", findingsHandler.Neighbors)
	secured.Get("/findings/:id/duplicates", findingsHandler.GetDuplicates)
	secured.Post("/findings", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Create)
	secured.Put("/findings/:id", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Update)
	secured.Patch("/findings/:id", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Update)
	secured.Post("/findings/:id/comments", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.AddComment)
	secured.Post("/findings/bulk", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Bulk)
	secured.Post("/findings/:id/make-master", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.MakeMaster)
	secured.Post("/findings/:id/unlink-duplicate", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.UnlinkDuplicate)
	secured.Delete("/findings/:id", middleware.AuthorizeRole("admin"), findingsHandler.Delete)

	gateHandler := handlers.NewGateCheckHandler(db, policyEngine)
	secured.Post("/gates/check", middleware.AuthorizeRole("analyst", "admin"), gateHandler.Check)

	importJobsHandler := handlers.NewImportJobsHandler(db)
	secured.Get("/import-jobs", importJobsHandler.List)
	secured.Get("/import-jobs/:id", importJobsHandler.Get)

	productsHandler := handlers.NewProductsHandler(db)
	secured.Get("/products", productsHandler.List)
	secured.Get("/products/:id", productsHandler.Get)
	secured.Get("/products/:id/stats", productsHandler.Stats)
	secured.Post("/products", middleware.AuthorizeRole("admin", "analyst"), productsHandler.Create)

	assetContextHandler := handlers.NewAssetContextHandler(db, publisher)
	secured.Get("/products/:id/asset-context", middleware.AuthorizeRole("admin", "analyst"), assetContextHandler.GetProductAssetContext)
	secured.Put("/products/:id/asset-context", middleware.AuthorizeRole("admin", "analyst"), assetContextHandler.UpsertProductAssetContext)

	sourceSnapshotsHandler := handlers.NewProductSourceSnapshotsHandler(db, store, publisher, cfg)
	secured.Post("/products/:id/source-snapshots", middleware.AuthorizeRole("admin", "analyst"), sourceSnapshotsHandler.Create)
	secured.Get("/products/:id/source-snapshots", sourceSnapshotsHandler.List)
	secured.Get("/products/:id/source-snapshots/latest", sourceSnapshotsHandler.Latest)

	sbomHandler := handlers.NewSbomHandler(db, store, publisher)
	secured.Post("/sbom/upload", middleware.AuthorizeRole("analyst", "admin"), sbomHandler.Upload)
	secured.Get("/sbom", sbomHandler.List)
	secured.Get("/sbom/diff", sbomHandler.DiffByVersion)
	secured.Get("/sbom/:id/download", sbomHandler.Download)

	sbomComponentsHandler := handlers.NewSbomComponentsHandler(db)
	secured.Get("/sbom/:id/components", sbomComponentsHandler.ListBySbom)
	secured.Get("/sbom/:id/status", sbomComponentsHandler.Status)
	secured.Get("/products/:id/components", sbomComponentsHandler.ListByProduct)

	intelHandler := handlers.NewIntelHandler(db, publisher)
	secured.Post("/intel/refresh", middleware.AuthorizeRole("admin"), intelHandler.Refresh)

	ingestAuth := middleware.NewIntegrationBearerAuth(db)
	apiRate := limiter.New(limiter.Config{Max: 60, Expiration: time.Minute})
	adminRate := limiter.New(limiter.Config{Max: 30, Expiration: time.Minute})
	ingest := api.Group("/ingest", ingestAuth.Require())
	ingestRuns := handlers.NewIngestRunsHandler(db, publisher, store)
	ingest.Post("/runs:init", apiRate, ingestAuth.Require("ingest:run:init", "ingest:artifact:write"), ingestRuns.Init)
	ingest.Post("/runs/:run_id:commit", apiRate, ingestAuth.Require("ingest:run:commit"), ingestRuns.Commit)
	ingest.Get("/runs/:run_id", ingestAuth.Require("ingest:run:init"), ingestRuns.Get)

	admin := secured.Group("/admin", middleware.RequireIdempotency(db))
	adminTokensHandler := handlers.NewAdminIntegrationTokensHandler(db)
	admin.Get("/integration-tokens", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.List)
	admin.Post("/integration-tokens", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.Create)
	admin.Patch("/integration-tokens/:id", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.Patch)
	admin.Post("/integration-tokens/:id/revoke", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.Revoke)
	admin.Post("/integration-tokens/:id/rotate", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.Rotate)
	admin.Get("/integration-tokens/:id/audit", adminRate, middleware.AuthorizeRole("admin", "superuser"), adminTokensHandler.Audit)

	auditLogHandler := handlers.NewAuditLogHandler(db)
	admin.Get("/audit", middleware.RequirePermission(authzEvaluator, authz.PermAdminAuditRead), auditLogHandler.List)
	admin.Get("/audit-log", middleware.RequirePermission(authzEvaluator, authz.PermAdminAuditRead), auditLogHandler.List)
	admin.Get("/audit/export", middleware.RequirePermission(authzEvaluator, authz.PermAdminAuditRead), auditLogHandler.ExportJSONL)

	policiesHandler := handlers.NewPoliciesHandler(db, publisher)
	slaPoliciesHandler := handlers.NewAdminSLAPoliciesHandler(db, authzEvaluator, publisher)
	admin.Get("/policies", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesRead), policiesHandler.List)
	admin.Post("/policies", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), policiesHandler.Create)
	admin.Get("/policies/:id", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesRead), policiesHandler.Get)
	admin.Patch("/policies/:id", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), policiesHandler.Update)
	admin.Post("/policies/:id/versions", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), policiesHandler.AddVersion)
	admin.Put("/policies/:id/assignments", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), policiesHandler.UpdateAssignments)
	admin.Delete("/policies/:id", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), policiesHandler.Delete)
	admin.Get("/policies/sla", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesRead), slaPoliciesHandler.GetOrgSLA)
	admin.Put("/policies/sla", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), slaPoliciesHandler.PutOrgSLA)
	admin.Get("/products/:productId/policies/sla", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsRead), slaPoliciesHandler.GetProductSLA)
	admin.Put("/products/:productId/policies/sla", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), slaPoliciesHandler.PutProductSLA)
	admin.Delete("/products/:productId/policies/sla", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), slaPoliciesHandler.DeleteProductSLA)

	riskModelsHandler := handlers.NewRiskModelsHandler(db, publisher)
	admin.Post("/risk-models/:id/activate", middleware.RequirePermission(authzEvaluator, authz.PermAdminPoliciesWrite), riskModelsHandler.Activate)

	adminUsersHandler := handlers.NewAdminUsersHandler(db, authzEvaluator, publisher)
	admin.Get("/users", middleware.RequirePermission(authzEvaluator, authz.PermAdminUsersRead), adminUsersHandler.List)
	admin.Post("/users/invite", middleware.RequirePermission(authzEvaluator, authz.PermAdminUsersInvite), adminUsersHandler.Invite)
	admin.Patch("/users/:userId", adminUsersHandler.Patch)
	admin.Get("/users/:userId/access", middleware.RequirePermission(authzEvaluator, authz.PermAdminUsersRead), adminUsersHandler.GetAccess)
	admin.Put("/users/:userId/teams", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsWrite), adminUsersHandler.PutTeams)
	admin.Put("/users/:userId/products/:productId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), adminUsersHandler.PutProductRole)
	admin.Delete("/users/:userId/products/:productId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), adminUsersHandler.DeleteProductRole)
	admin.Post("/users/bulk", adminUsersHandler.Bulk)

	teamsProjectsHandler := handlers.NewAdminTeamsProjectsHandler(db, authzEvaluator, publisher)
	admin.Get("/teams", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsRead), teamsProjectsHandler.ListTeams)
	admin.Post("/teams", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsWrite), teamsProjectsHandler.CreateTeam)
	admin.Patch("/teams/:teamId", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsWrite), teamsProjectsHandler.PatchTeam)
	admin.Get("/teams/:teamId", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsRead), teamsProjectsHandler.GetTeam)
	admin.Put("/teams/:teamId/members", middleware.RequirePermission(authzEvaluator, authz.PermAdminTeamsWrite), teamsProjectsHandler.PutTeamMembers)
	admin.Get("/products", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsRead), teamsProjectsHandler.ListAdminProducts)
	admin.Get("/products/:productId/access", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsRead), teamsProjectsHandler.GetProductAccess)
	admin.Put("/products/:productId/teams/:teamId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), teamsProjectsHandler.PutProductTeamRole)
	admin.Delete("/products/:productId/teams/:teamId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), teamsProjectsHandler.DeleteProductTeamRole)
	admin.Put("/products/:productId/users/:userId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), teamsProjectsHandler.PutProductUserRole)
	admin.Delete("/products/:productId/users/:userId/role", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsWrite), teamsProjectsHandler.DeleteProductUserRole)
	admin.Get("/products/:productId/effective-access/:userId", middleware.RequirePermission(authzEvaluator, authz.PermAdminProjectsRead), teamsProjectsHandler.GetEffectiveAccess)

	bduHandler := handlers.NewAdminBDUHandler(db)
	admin.Get("/bdu/sync-status", bduHandler.GetSyncStatus)
	admin.Put("/bdu/sync-interval", bduHandler.UpdateSyncInterval)

	policyResultsHandler := handlers.NewPolicyResultsHandler(db)
	secured.Get("/policy-results", policyResultsHandler.List)
	secured.Get("/policy-results/:id", policyResultsHandler.Get)
	secured.Get("/policy-results/export", middleware.AuthorizeRole("admin", "superuser"), policyResultsHandler.Export)

	riskMetricsHandler := handlers.NewRiskMetricsHandler(db)
	secured.Get("/metrics/risk", riskMetricsHandler.Get)

	dashboardHandler := handlers.NewDashboardHandler(db)
	secured.Get("/dashboard", dashboardHandler.Get)
}

type storageAccessReader struct {
	db *sql.DB
}

func (r storageAccessReader) GetEffectiveProductRole(ctx context.Context, tenantID, userID, productID uuid.UUID) (models.ProjectRole, error) {
	return storage.GetEffectiveProductRole(ctx, r.db, tenantID, userID, productID)
}
