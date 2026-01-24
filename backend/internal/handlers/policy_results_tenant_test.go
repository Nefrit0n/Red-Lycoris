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

func TestPolicyResultsListFiltersByTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	tenantID := uuid.New()

	mock.ExpectQuery("(?s)SELECT COUNT\\(\\*\\) FROM policy_results pr WHERE 1=1 AND .*tenant_id = \\$1").
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("(?s)SELECT\\s+pr\\.id.*FROM policy_results pr.*WHERE 1=1 AND .*tenant_id = \\$1.*LIMIT \\$2 OFFSET \\$3").
		WithArgs(tenantID, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"policy_id",
			"policy_rule_id",
			"subject_type",
			"subject_id",
			"decision",
			"violations",
			"input_hash",
			"evaluated_at",
			"version",
		}))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   uuid.New().String(),
		TenantID: tenantID.String(),
		Roles:    []string{"user"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/policy-results", nil)
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
