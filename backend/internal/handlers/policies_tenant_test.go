package handlers_test

import (
	"io"
	"net/http/httptest"
	"testing"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/server"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestPoliciesListFiltersByTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	tenantID := uuid.New()

	// ListPolicies COUNT query pattern: WHERE ($1::text IS NULL OR...) AND ... AND ($4::uuid IS NULL OR p.tenant_id = $4)
	mock.ExpectQuery("(?s)SELECT COUNT\\(\\*\\)\\s+FROM policies p\\s+WHERE").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	// ListPolicies SELECT query pattern
	mock.ExpectQuery("(?s)SELECT\\s+.*FROM policies p.*WHERE").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), tenantID, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"tenant_id",
			"name",
			"kind",
			"status",
			"description",
			"created_at",
			"updated_at",
			"version",
			"id",
			"assignments_count",
		}))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   uuid.New().String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/admin/policies", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, string(body))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
