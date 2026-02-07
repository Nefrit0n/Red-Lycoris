package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/server"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type mockObjectStore struct {
	putCalls    []string
	deleteCalls []string
}

func (m *mockObjectStore) PutObject(_ context.Context, key string, _ io.Reader, _ int64, _ string) error {
	m.putCalls = append(m.putCalls, key)
	return nil
}

func (m *mockObjectStore) GetObject(_ context.Context, _ string) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("ok")), nil
}

func (m *mockObjectStore) DeleteObject(_ context.Context, key string) error {
	m.deleteCalls = append(m.deleteCalls, key)
	return nil
}

type snapshotResponse struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Error   string                 `json:"error"`
}

func TestCreateProductSourceSnapshotOK(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	cfg := config.Config{JWTSecret: "test-secret", AnalysisMaxArchiveBytes: "1024"}
	store := &mockObjectStore{}
	app := server.NewApp(cfg, db, nil, store)

	productID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()

	mock.ExpectQuery("SELECT EXISTS").WithArgs(productID, tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectExec("INSERT INTO product_source_snapshots").
		WithArgs(
			sqlmock.AnyArg(),
			tenantID,
			productID,
			sqlmock.AnyArg(),
			int64(7),
			nil,
			userID,
			sqlmock.AnyArg(),
			nil,
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("archive", "source.zip")
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}
	if _, err := part.Write([]byte("content")); err != nil {
		t.Fatalf("write form file failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/products/"+productID.String()+"/source-snapshots", body)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 201 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var response snapshotResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response")
	}

	if len(store.putCalls) != 1 {
		t.Fatalf("expected put object call, got %d", len(store.putCalls))
	}
	if snapshotID, ok := response.Data["id"].(string); ok {
		if !strings.Contains(store.putCalls[0], snapshotID) {
			t.Fatalf("expected object key to contain snapshot id")
		}
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestCreateAnalysisJobFromSnapshotOK(t *testing.T) {
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

	mock.ExpectQuery("FROM product_source_snapshots").
		WithArgs(snapshotID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"tenant_id",
			"product_id",
			"object_key",
			"archive_size",
			"sha256",
			"created_by",
			"created_at",
			"deleted_at",
		}).AddRow(
			snapshotID,
			tenantID,
			productID,
			"products/source-snapshots/archive.zip",
			int64(12),
			nil,
			userID,
			time.Now().UTC(),
			nil,
		))

	mock.ExpectExec("INSERT INTO analysis_jobs").
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			productID,
			nil,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			0,
			0,
			0,
			sqlmock.AnyArg(),
			int64(12),
			snapshotID,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			nil,
			nil,
			nil,
			nil,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("product_id", productID.String()); err != nil {
		t.Fatalf("write product_id failed: %v", err)
	}
	if err := writer.WriteField("source_snapshot_id", snapshotID.String()); err != nil {
		t.Fatalf("write source_snapshot_id failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/analysis-jobs", body)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 202 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 202 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if len(store.putCalls) != 0 {
		t.Fatalf("expected no archive upload when using snapshot")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestCreateAnalysisJobWithArchiveAndSnapshotReturnsBadRequest(t *testing.T) {
	db, _, err := sqlmock.New()
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

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("product_id", productID.String()); err != nil {
		t.Fatalf("write product_id failed: %v", err)
	}
	if err := writer.WriteField("source_snapshot_id", snapshotID.String()); err != nil {
		t.Fatalf("write source_snapshot_id failed: %v", err)
	}
	part, err := writer.CreateFormFile("archive", "source.zip")
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}
	if _, err := part.Write([]byte("content")); err != nil {
		t.Fatalf("write form file failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/analysis-jobs", body)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 400 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}
}

func TestCreateAnalysisJobWithoutArchiveOrSnapshotReturnsBadRequest(t *testing.T) {
	db, _, err := sqlmock.New()
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

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("product_id", productID.String()); err != nil {
		t.Fatalf("write product_id failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/analysis-jobs", body)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 400 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}
}

func TestCreateAnalysisJobIdempotencyReturnsExisting(t *testing.T) {
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
	jobID := uuid.New()
	idempotencyKey := uuid.NewString()

	mock.ExpectQuery("FROM analysis_jobs").WithArgs(idempotencyKey).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"tenant_id",
			"product_id",
			"name",
			"engagement_id",
			"status",
			"scanners",
			"semgrep_status",
			"trivy_status",
			"findings_total",
			"findings_new",
			"duplicates_total",
			"created_at",
			"started_at",
			"finished_at",
			"archive_key",
			"archive_size",
			"source_snapshot_id",
			"artifact_semgrep_key",
			"artifact_trivy_key",
			"semgrep_import_job_id",
			"trivy_import_job_id",
			"error_message",
			"created_by",
			"idempotency_key",
		}).AddRow(
			jobID,
			tenantID,
			productID,
			"Product A",
			nil,
			"queued",
			"{semgrep}",
			"pending",
			"pending",
			0,
			0,
			0,
			time.Now().UTC(),
			nil,
			nil,
			nil,
			int64(0),
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			userID,
			idempotencyKey,
		))

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("product_id", productID.String()); err != nil {
		t.Fatalf("write product_id failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, middleware.JWTClaims{
		UserID:   userID.String(),
		TenantID: tenantID.String(),
		Roles:    []string{"admin"},
	})
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("sign token failed: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/analysis-jobs", body)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	req.Header.Set("Idempotency-Key", idempotencyKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200 status, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if len(store.putCalls) != 0 {
		t.Fatalf("expected no archive upload on idempotent request")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
