package server

import (
	"database/sql"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/handlers"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/policies"
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

	scanHandler := handlers.NewScanUploadHandler(db, publisher, policyEngine)
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

	findingsHandler := handlers.NewFindingsHandler(db, policyEngine)
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

	importJobsHandler := handlers.NewImportJobsHandler(db)
	secured.Get("/import-jobs", importJobsHandler.List)
	secured.Get("/import-jobs/:id", importJobsHandler.Get)

	productsHandler := handlers.NewProductsHandler(db)
	secured.Get("/products", productsHandler.List)
	secured.Get("/products/:id", productsHandler.Get)
	secured.Post("/products", middleware.AuthorizeRole("admin", "analyst"), productsHandler.Create)

	sbomHandler := handlers.NewSbomHandler(db, store)
	secured.Post("/sbom/upload", middleware.AuthorizeRole("analyst", "admin"), sbomHandler.Upload)
	secured.Get("/sbom", sbomHandler.List)
	secured.Get("/sbom/:id/download", sbomHandler.Download)

	intelHandler := handlers.NewIntelHandler(db, publisher)
	secured.Post("/intel/refresh", middleware.AuthorizeRole("admin"), intelHandler.Refresh)

	admin := secured.Group("/admin", middleware.AuthorizeRole("admin"))
	auditLogHandler := handlers.NewAuditLogHandler(db)
	admin.Get("/audit-log", auditLogHandler.List)
}
