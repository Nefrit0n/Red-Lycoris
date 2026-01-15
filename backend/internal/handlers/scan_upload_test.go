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
		{Title: "SQL Injection", Severity: "high", Location: "/login"},
		{Title: "XSS", Severity: "medium", Location: "/search"},
	}
	report := map[string]any{"findings": findings}
	body, err := json.Marshal(map[string]any{
		"scanner_type": "sast",
		"report":       report,
	})
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	fingerprintOne := dedup.ComputeFingerprint("sast", findings[0])
	fingerprintTwo := dedup.ComputeFingerprint("sast", findings[1])
	duplicateID := uuid.New()

	mock.ExpectExec("INSERT INTO scan_results").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), "sast", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectQuery("SELECT id FROM findings WHERE fingerprint = \\$1 LIMIT 1").
		WithArgs(fingerprintOne).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), fingerprintOne, "SQL Injection", sqlmock.AnyArg(), "high", "new", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectQuery("SELECT id FROM findings WHERE fingerprint = \\$1 LIMIT 1").
		WithArgs(fingerprintTwo).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(duplicateID))

	mock.ExpectExec("INSERT INTO findings").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), fingerprintTwo, "XSS", sqlmock.AnyArg(), "medium", "duplicate", duplicateID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID: "user-123",
		Scope:  "scan:upload",
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
		FindingsProcessed int `json:"findings_processed"`
		Duplicates        int `json:"duplicates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if response.FindingsProcessed != 2 {
		t.Fatalf("expected 2 findings processed, got %d", response.FindingsProcessed)
	}
	if response.Duplicates != 1 {
		t.Fatalf("expected 1 duplicate, got %d", response.Duplicates)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
