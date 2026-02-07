package handlers_test

import (
	"bytes"
	"encoding/json"
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

type snapshotResponseEnvelope struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Error   string                 `json:"error"`
}

func TestCreateProductSourceSnapshotIdempotencyReturnsExisting(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret"}
	store := &mockObjectStore{}
	app := server.NewApp(cfg, db, nil, store)

	productID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()
	snapshotID := uuid.New()
	idempotencyKey := uuid.NewString()

	mock.ExpectQuery("SELECT EXISTS").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectQuery("FROM product_source_snapshots").WithArgs(tenantID, idempotencyKey).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"tenant_id",
			"product_id",
			"object_key",
			"archive_size",
			"sha256",
			"idempotency_key",
			"created_by",
			"created_at",
			"deleted_at",
		}).AddRow(
			snapshotID,
			tenantID,
			productID,
			"products/source-snapshots/archive.zip",
			int64(42),
			nil,
			idempotencyKey,
			userID,
			time.Now().UTC(),
			nil,
		))

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/products/"+productID.String()+"/source-snapshots", bytes.NewReader(nil))
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Idempotency-Key", idempotencyKey)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		var body bytes.Buffer
		_, _ = body.ReadFrom(resp.Body)
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, body.String())
	}

	var response snapshotResponseEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response")
	}
	if response.Data["id"] != snapshotID.String() {
		t.Fatalf("expected snapshot id %s, got %v", snapshotID.String(), response.Data["id"])
	}
	if len(store.putCalls) != 0 {
		t.Fatalf("expected no object upload on idempotent request")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
