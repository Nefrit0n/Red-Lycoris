package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/dedup"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/server"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestScanUploadEndpoint(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db)

	findings := []parser.Finding{
		{Title: "SQL Injection", Severity: "high", Location: "app", RuleID: "CVE-2024-0001"},
		{Title: "XSS", Severity: "medium", Location: "app", RuleID: "CVE-2024-0002"},
	}
	report := map[string]any{
		"ArtifactName": "billing-api",
		"Results": []any{
			map[string]any{
				"Target": "app",
				"Vulnerabilities": []any{
					map[string]any{
						"VulnerabilityID": "CVE-2024-0001",
						"Title":           "SQL Injection",
						"Description":     "SQLi found",
						"Severity":        "HIGH",
						"PkgName":         "lib-sql",
					},
					map[string]any{
						"VulnerabilityID": "CVE-2024-0002",
						"Title":           "XSS",
						"Description":     "XSS found",
						"Severity":        "MEDIUM",
						"PkgName":         "lib-web",
					},
				},
			},
		},
	}
	body, err := json.Marshal(map[string]any{
		"scanner_type":       "trivy",
		"report":             report,
		"product_name":       "Billing API",
		"product_version":    "1.0.0",
		"product_identifier": "billing-api",
	})
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	fingerprintOne := dedup.ComputeFingerprint("trivy", findings[0])
	fingerprintTwo := dedup.ComputeFingerprint("trivy", findings[1])
	duplicateID := uuid.New()

	mock.ExpectQuery("SELECT id, name, slug, description, identifier, version, created_at, updated_at FROM products WHERE identifier = \\$1 LIMIT 1").
		WithArgs("billing-api").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "description", "identifier", "version", "created_at", "updated_at"}))

	mock.ExpectQuery("SELECT id, name, slug, description, identifier, version, created_at, updated_at FROM products WHERE slug = \\$1 LIMIT 1").
		WithArgs("billing-api-1-0-0").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "slug", "description", "identifier", "version", "created_at", "updated_at"}))

	mock.ExpectExec("INSERT INTO products").
		WithArgs(sqlmock.AnyArg(), "Billing API", "billing-api-1-0-0", sqlmock.AnyArg(), "billing-api", "1.0.0", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("INSERT INTO scan_results").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), "trivy", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectQuery("SELECT id FROM findings WHERE fingerprint = \\$1 LIMIT 1").
		WithArgs(fingerprintOne).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), fingerprintOne, "SQL Injection", sqlmock.AnyArg(), "high", "new", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectQuery("SELECT id FROM findings WHERE fingerprint = \\$1 LIMIT 1").
		WithArgs(fingerprintTwo).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(duplicateID))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), fingerprintTwo, "XSS", sqlmock.AnyArg(), "medium", "duplicate", duplicateID, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: uuid.New().String(),
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/scans/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenString)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 status, got %d", resp.StatusCode)
	}

	var response struct {
		CreatedFindings int `json:"createdFindings"`
		Duplicates      int `json:"duplicates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if response.CreatedFindings != 2 {
		t.Fatalf("expected 2 findings processed, got %d", response.CreatedFindings)
	}
	if response.Duplicates != 1 {
		t.Fatalf("expected 1 duplicate, got %d", response.Duplicates)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
