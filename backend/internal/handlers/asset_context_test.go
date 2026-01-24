package handlers_test

import (
	"bytes"
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
	"github.com/lib/pq"
)

type assetContextResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
}

func TestGetProductAssetContextEmptyReturnsNotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	productID := uuid.New()
	tenantID := uuid.New()

	mock.ExpectQuery("SELECT EXISTS").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT product_id, tenant_id").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"product_id", "tenant_id", "environment", "internet_exposed", "data_classification", "business_impact", "tags", "metadata", "created_at", "updated_at"}))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   uuid.New().String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/v1/products/"+productID.String()+"/asset-context", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 404 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 404 status, got %d: %s", resp.StatusCode, string(body))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestPutProductAssetContextValid(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	productID := uuid.New()
	tenantID := uuid.New()

	mock.ExpectQuery("SELECT EXISTS").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("SELECT product_id, tenant_id").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"product_id", "tenant_id", "environment", "internet_exposed", "data_classification", "business_impact", "tags", "metadata", "created_at", "updated_at"}))
	mock.ExpectQuery("INSERT INTO product_asset_context").
		WithArgs(tenantID, productID, "prod", true, "confidential", "high", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{
			"product_id",
			"tenant_id",
			"environment",
			"internet_exposed",
			"data_classification",
			"business_impact",
			"tags",
			"metadata",
			"created_at",
			"updated_at",
		}).AddRow(
			productID,
			tenantID,
			"prod",
			true,
			"confidential",
			"high",
			pq.Array([]string{"pci"}),
			[]byte(`{"owner":"secops"}`),
			time.Now().UTC(),
			time.Now().UTC(),
		))
	mock.ExpectExec("INSERT INTO audit_log").WithArgs(
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	payload := map[string]interface{}{
		"environment":        "prod",
		"internetExposed":    true,
		"dataClassification": "confidential",
		"businessImpact":     "high",
		"tags":               []string{"pci"},
		"metadata": map[string]interface{}{
			"owner": "secops",
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   uuid.New().String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("PUT", "/api/v1/products/"+productID.String()+"/asset-context", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, string(body))
	}

	var response assetContextResponse
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

func TestPutProductAssetContextInvalidEnum(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	app := server.NewApp(cfg, db, nil, nil)

	productID := uuid.New()
	tenantID := uuid.New()

	payload := map[string]interface{}{
		"environment":        "edge",
		"internetExposed":    true,
		"dataClassification": "confidential",
		"businessImpact":     "high",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   uuid.New().String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("PUT", "/api/v1/products/"+productID.String()+"/asset-context", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 400 status, got %d: %s", resp.StatusCode, string(body))
	}
}
