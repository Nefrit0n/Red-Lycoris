package server

import (
	"database/sql"
	"net/http/httptest"
	"testing"

	"lotus-warden/backend/internal/config"

	"github.com/gofiber/fiber/v2"
)

func TestHealthEndpoint(t *testing.T) {
	app := fiber.New()
	setupRoutes(app, config.Config{JWTSecret: "test"}, (*sql.DB)(nil))

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 status, got %d", resp.StatusCode)
	}
}

func TestPingEndpoint(t *testing.T) {
	app := fiber.New()
	setupRoutes(app, config.Config{JWTSecret: "test"}, (*sql.DB)(nil))

	req := httptest.NewRequest("GET", "/api/ping", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 status, got %d", resp.StatusCode)
	}
}
