package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/models"
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
	app := server.NewApp(cfg, db, nil, nil)

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

	duplicateID := uuid.New()

	mock.ExpectQuery("SELECT EXISTS \\(SELECT 1 FROM users WHERE id = \\$1\\)").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	mock.ExpectQuery("SELECT id, tenant_id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at FROM products WHERE identifier = \\$1 LIMIT 1").
		WithArgs("billing-api").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "slug", "description", "identifier", "version", "asset_criticality", "created_at", "updated_at"}))

	mock.ExpectQuery("SELECT id, tenant_id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at FROM products WHERE slug = \\$1 LIMIT 1").
		WithArgs("billing-api-1-0-0").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "slug", "description", "identifier", "version", "asset_criticality", "created_at", "updated_at"}))

	mock.ExpectExec("INSERT INTO products").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), "Billing API", "billing-api-1-0-0", sqlmock.AnyArg(), "billing-api", "1.0.0", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("INSERT INTO import_jobs").
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			"trivy",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			"queued",
			0,
			0,
			0,
			sqlmock.AnyArg(),
			nil,
			sqlmock.AnyArg(),
			nil,
			nil,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("UPDATE import_jobs").
		WithArgs("running", sqlmock.AnyArg(), nil, nil, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO audit_log").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("INSERT INTO scan_results").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), "trivy", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id, repeat_count\\s+FROM findings\\s+WHERE fingerprint = \\$1\\s+AND duplicate_id IS NULL\\s+AND deleted_at IS NULL AND product_id = \\$2").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "repeat_count"}))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			models.CategorySCA,
			"SQL Injection",
			sqlmock.AnyArg(),
			"high",
			"new",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			0,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	mock.ExpectExec("INSERT INTO audit_log").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), "finding.imported", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO finding_vuln_identifiers").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id, repeat_count\\s+FROM findings\\s+WHERE fingerprint = \\$1\\s+AND duplicate_id IS NULL\\s+AND deleted_at IS NULL AND product_id = \\$2").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "repeat_count"}).AddRow(duplicateID, 2))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			models.CategorySCA,
			"XSS",
			sqlmock.AnyArg(),
			"medium",
			"duplicate",
			duplicateID,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			0,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("UPDATE findings").
		WithArgs(3, sqlmock.AnyArg(), duplicateID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), duplicateID, sqlmock.AnyArg(), "repeat_detected", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO audit_log").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), duplicateID, sqlmock.AnyArg(), "finding.imported", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO finding_vuln_identifiers").
		WithArgs(duplicateID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("UPDATE import_jobs").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("UPDATE import_jobs").
		WithArgs(2, 1, 1, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectExec("UPDATE import_jobs").
		WithArgs("succeeded", nil, sqlmock.AnyArg(), nil, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO audit_log").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: uuid.New().String(),
		Roles:  []string{"analyst"},
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
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var response struct {
		CreatedFindings int `json:"createdFindings"`
		Duplicates      int `json:"duplicates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if response.CreatedFindings != 1 {
		t.Fatalf("expected 1 finding created, got %d", response.CreatedFindings)
	}
	if response.Duplicates != 1 {
		t.Fatalf("expected 1 duplicate, got %d", response.Duplicates)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestScanUploadRejectsOversizedReport(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	largePayload := strings.Repeat("a", 11*1024*1024)
	body, err := json.Marshal(map[string]any{
		"scanner_type": "trivy",
		"report":       largePayload,
	})
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: uuid.New().String(),
		Roles:  []string{"analyst"},
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
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 status, got %d", resp.StatusCode)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
