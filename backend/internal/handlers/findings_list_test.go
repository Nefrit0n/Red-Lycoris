package handlers_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/server"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestFindingsListDefaultsToCanonical(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM findings.*duplicate_id IS NULL").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT f.id.*duplicate_id IS NULL").
		WillReturnRows(sqlmock.NewRows([]string{"id", "title", "severity", "status", "category", "product_id", "name", "assignee_id", "username", "import_job_id", "created_at", "updated_at", "first_seen_at", "last_seen_at", "repeat_count", "duplicate_id", "scanner", "source_type"}))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: uuid.New().String(),
		Roles:  []string{"user"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/findings", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 status, got %d", resp.StatusCode)
	}

	var response struct {
		Success bool            `json:"success"`
		Data    json.RawMessage `json:"data"`
		Total   int             `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
