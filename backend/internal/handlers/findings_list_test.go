package handlers_test

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

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

	now := time.Now()
	mock.ExpectQuery("(?s)\\s*SELECT f.id.*duplicate_id IS NULL").
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"tenant_id",
			"import_job_id",
			"fingerprint",
			"title",
			"severity",
			"status",
			"category",
			"product_id",
			"name",
			"duplicate_id",
			"repeat_count",
			"first_seen_at",
			"last_seen_at",
			"sla_due_at",
			"sla_breached",
			"sla_breached_at",
			"sla_profile",
			"sla_source",
			"scanner",
			"assignee_id",
			"username",
			"decision",
			"risk_score",
			"risk_band",
			"computed_at",
			"model_version",
			"created_at",
			"updated_at",
			"source_type",
			"cwe",
			"owasp",
			"sort_key",
		}).AddRow(
			uuid.New(),
			uuid.New(),
			nil,
			"fp-1",
			"Finding",
			"low",
			"new",
			"SAST",
			uuid.New(),
			"Product",
			nil,
			0,
			now,
			now,
			nil,
			nil,
			nil,
			nil,
			nil,
			"scanner",
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			now,
			now,
			nil,
			"{CWE-79}",
			"{A01}",
			now,
		))
	mock.ExpectQuery("(?s)\\s*SELECT\\s+fvi.finding_id").
		WillReturnRows(sqlmock.NewRows([]string{
			"finding_id",
			"identifiers",
			"cvss_score",
			"cvss_version",
			"epss_score",
			"epss_percentile",
			"kev",
			"last_refreshed_at",
		}))

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
		body, _ := io.ReadAll(resp.Body)
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("expected 200 status, got %d: %s (db: %v)", resp.StatusCode, string(body), err)
		}
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, string(body))
	}

	var response map[string]json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if _, ok := response["success"]; !ok {
		t.Fatalf("expected success response")
	}
	if _, ok := response["total"]; ok {
		t.Fatalf("expected total to be omitted when includeMeta is false")
	}
	if _, ok := response["data"]; !ok {
		t.Fatalf("expected success response")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
