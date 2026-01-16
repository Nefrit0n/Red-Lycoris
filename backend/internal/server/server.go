package server

import (
	"database/sql"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/handlers"
	"lotus-warden/backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func NewApp(cfg config.Config, db *sql.DB) *fiber.App {
	app := fiber.New()
	app.Use(logger.New())
	setupRoutes(app, cfg, db)
	return app
}

func setupRoutes(app *fiber.App, cfg config.Config, db *sql.DB) {
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

	scanHandler := handlers.NewScanUploadHandler(db)
	secured.Post(
		"/scans/upload",
		middleware.AuthorizeRole("analyst", "admin"),
		scanHandler.Handle,
	)

	findingsHandler := handlers.NewFindingsHandler(db)
	secured.Get("/findings", findingsHandler.List)
	secured.Get("/findings/:id", findingsHandler.Get)
	secured.Get("/findings/:id/duplicates", findingsHandler.GetDuplicates)
	secured.Post("/findings", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Create)
	secured.Put("/findings/:id", findingsHandler.Update)
	secured.Patch("/findings/:id", findingsHandler.Update)
	secured.Post("/findings/:id/comments", findingsHandler.AddComment)
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
}
