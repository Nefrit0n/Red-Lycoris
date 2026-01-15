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

	scanHandler := handlers.NewScanUploadHandler(db)
	api := app.Group("/api/v1", middleware.RequireJWT(cfg.JWTSecret, handlers.ScanUploadScope()))
	api.Post("/scans/upload", scanHandler.Handle)
}
