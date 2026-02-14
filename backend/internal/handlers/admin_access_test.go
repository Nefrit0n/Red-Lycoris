package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"red-lycoris/backend/internal/authz"
	"red-lycoris/backend/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func setupAdminAccessTest(t *testing.T, role models.OrgRole) (*fiber.App, sqlmock.Sqlmock, uuid.UUID, uuid.UUID) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	app := fiber.New()
	evaluator := authz.NewEvaluator(nil)
	h := NewAdminAccessHandler(db, evaluator)
	tenantID := uuid.New()
	userID := uuid.New()

	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenantID)
		c.Locals("user_id", userID)
		c.Locals("org_role", string(role))
		return c.Next()
	})
	app.Get("/admin/teams/:id/members", h.ListTeamMembers)
	return app, mock, tenantID, userID
}

func TestAdminAccessTenantBoundaryForTeamMembers(t *testing.T) {
	app, mock, tenantID, _ := setupAdminAccessTest(t, models.OrgRoleAdmin)
	teamID := uuid.New()

	rows := sqlmock.NewRows([]string{"tenant_id", "team_id", "user_id", "created_at"})
	mock.ExpectQuery("SELECT tenant_id, team_id, user_id, created_at").
		WithArgs(tenantID, teamID).
		WillReturnRows(rows)

	resp, err := app.Test(httptest.NewRequest("GET", "/admin/teams/"+teamID.String()+"/members", nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestAdminAccessViewerDenied(t *testing.T) {
	app, mock, _, _ := setupAdminAccessTest(t, models.OrgRoleViewer)
	teamID := uuid.New()

	resp, err := app.Test(httptest.NewRequest("GET", "/admin/teams/"+teamID.String()+"/members", nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["error"] != "forbidden" {
		t.Fatalf("unexpected error body: %+v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected db calls: %v", err)
	}
}
