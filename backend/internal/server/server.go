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
	authHandler := handlers.NewAuthHandler(db, cfg.JWTSecret, cfg.RootEmail, cfg.RootPassword)
	api.Post("/auth/login", authHandler.Login)
	api.Post("/auth/logout", authHandler.Logout)

	secured := api.Group("", middleware.RequireJWT(cfg.JWTSecret))
	secured.Post("/auth/change_password", authHandler.ChangePassword)

	scanHandler := handlers.NewScanUploadHandler(db)
	secured.Post("/scans/upload", middleware.AuthorizeRole("analyst", "admin"), scanHandler.Handle)

	findingsHandler := handlers.NewFindingsHandler(db)
	secured.Get("/findings", findingsHandler.List)
	secured.Get("/findings/:id", findingsHandler.Get)
	secured.Post("/findings", middleware.AuthorizeRole("analyst", "admin"), findingsHandler.Create)
	secured.Put("/findings/:id", findingsHandler.Update)
	secured.Delete("/findings/:id", middleware.AuthorizeRole("admin"), findingsHandler.Delete)
}
