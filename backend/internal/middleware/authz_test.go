package middleware

import (
	"net/http/httptest"
	"testing"

	"red-lycoris/backend/internal/authz"
	"red-lycoris/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestRequirePermissionMatrix(t *testing.T) {
	app := fiber.New()
	e := authz.NewEvaluator(nil)
	tenantID := uuid.New()
	userID := uuid.New()

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		c.Locals("user_id", userID)
		c.Locals("org_role", string(models.OrgRoleSecurityManager))
		return c.Next()
	})
	app.Get("/", RequirePermission(e, authz.PermAdminTeamsWrite), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestRequirePermissionAllowsAdmin(t *testing.T) {
	app := fiber.New()
	e := authz.NewEvaluator(nil)

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", uuid.New())
		c.Locals("user_id", uuid.New())
		c.Locals("org_role", string(models.OrgRoleAdmin))
		return c.Next()
	})
	app.Get("/", RequirePermission(e, authz.PermAdminTeamsWrite), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
