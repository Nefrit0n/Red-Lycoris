package server

import (
	"database/sql"
	"net/http"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/handlers"
	"lotus-warden/backend/internal/metrics"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/policies"
	"lotus-warden/backend/internal/sla"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func NewApp(cfg config.Config, db *sql.DB, publisher *events.Publisher, store objectstore.Store) *fiber.App {
	app := fiber.New(fiber.Config{
		BodyLimit: 12 << 20,
	})
	app.Use(requestid.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${latency} ${method} ${path} request_id=${locals:requestid}\n",
	}))
	setupRoutes(app, cfg, db, publisher, store)
	return app
}

func setupRoutes(app *fiber.App, cfg config.Config, db *sql.DB, publisher *events.Publisher, store objectstore.Store) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
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
	secured.Post("/products", middleware.AuthorizeRole("admin", "analyst"), productsHandler.Create)

	assetContextHandler := handlers.NewAssetContextHandler(db, publisher)
	secured.Get("/products/:id/asset-context", middleware.AuthorizeRole("admin", "analyst"), assetContextHandler.GetProductAssetContext)
	secured.Put("/products/:id/asset-context", middleware.AuthorizeRole("admin", "analyst"), assetContextHandler.UpsertProductAssetContext)

	sbomHandler := handlers.NewSbomHandler(db, store, publisher)
	secured.Post("/sbom/upload", middleware.AuthorizeRole("analyst", "admin"), sbomHandler.Upload)
	secured.Get("/sbom", sbomHandler.List)
	secured.Get("/sbom/diff", sbomHandler.DiffByVersion)
	secured.Get("/sbom/:id/download", sbomHandler.Download)

	sbomComponentsHandler := handlers.NewSbomComponentsHandler(db)
	sbomTransitiveHandler := handlers.NewSbomTransitiveHandler(db)
	secured.Get("/sbom/:id/components", sbomComponentsHandler.ListBySbom)
	secured.Get("/sbom/:id/status", sbomComponentsHandler.Status)
	secured.Get("/sbom/:id/transitive", sbomTransitiveHandler.ListVulnerable)
	secured.Get("/sbom/:id/path", sbomTransitiveHandler.Path)
	secured.Get("/products/:id/components", sbomComponentsHandler.ListByProduct)

	intelHandler := handlers.NewIntelHandler(db, publisher)
	secured.Post("/intel/refresh", middleware.AuthorizeRole("admin"), intelHandler.Refresh)

	admin := secured.Group("/admin", middleware.AuthorizeRole("admin"))
	auditLogHandler := handlers.NewAuditLogHandler(db)
	admin.Get("/audit-log", auditLogHandler.List)

	policiesHandler := handlers.NewPoliciesHandler(db)
	admin.Get("/policies", policiesHandler.List)
	admin.Post("/policies", policiesHandler.Create)
	admin.Get("/policies/:id", policiesHandler.Get)
	admin.Patch("/policies/:id", policiesHandler.Update)
	admin.Post("/policies/:id/versions", policiesHandler.AddVersion)
	admin.Put("/policies/:id/assignments", policiesHandler.UpdateAssignments)
	admin.Delete("/policies/:id", policiesHandler.Delete)

	riskModelsHandler := handlers.NewRiskModelsHandler(db, publisher)
	admin.Post("/risk-models/:id/activate", riskModelsHandler.Activate)

	policyResultsHandler := handlers.NewPolicyResultsHandler(db)
	secured.Get("/policy-results", policyResultsHandler.List)
	secured.Get("/policy-results/:id", policyResultsHandler.Get)
	secured.Get("/policy-results/export", middleware.AuthorizeRole("admin", "superuser"), policyResultsHandler.Export)

	riskMetricsHandler := handlers.NewRiskMetricsHandler(db)
	secured.Get("/metrics/risk", riskMetricsHandler.Get)

	dashboardHandler := handlers.NewDashboardHandler(db)
	secured.Get("/dashboard", dashboardHandler.Get)
}
