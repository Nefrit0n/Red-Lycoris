package storage

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

func TestGetProductAssetContextReturnsRecord(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	productID := uuid.New()
	tenantID := uuid.New()
	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := time.Now().UTC()
	metadata := []byte(`{"owner":"secops"}`)

	rows := sqlmock.NewRows([]string{
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
		pq.Array([]string{"pci", "pii"}),
		metadata,
		createdAt,
		updatedAt,
	)

	mock.ExpectQuery("SELECT product_id, tenant_id").WithArgs(productID, tenantID).WillReturnRows(rows)

	record, err := GetProductAssetContext(context.Background(), db, &tenantID, productID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if record == nil {
		t.Fatalf("expected record, got nil")
	}
	if record.ProductID != productID {
		t.Fatalf("expected product id %s, got %s", productID, record.ProductID)
	}
	if record.TenantID == nil || *record.TenantID != tenantID {
		t.Fatalf("expected tenant id %s, got %v", tenantID, record.TenantID)
	}
	if record.Environment != "prod" {
		t.Fatalf("expected environment prod, got %s", record.Environment)
	}
	if !record.InternetExposed {
		t.Fatalf("expected internet exposed true")
	}
	if record.DataClassification != "confidential" {
		t.Fatalf("expected data classification confidential, got %s", record.DataClassification)
	}
	if record.BusinessImpact == nil || *record.BusinessImpact != "high" {
		t.Fatalf("expected business impact high")
	}
	if len(record.Tags) != 2 {
		t.Fatalf("expected tags length 2, got %d", len(record.Tags))
	}
	var meta map[string]string
	if err := json.Unmarshal(record.Metadata, &meta); err != nil {
		t.Fatalf("expected metadata json, got %v", err)
	}
	if meta["owner"] != "secops" {
		t.Fatalf("expected metadata owner secops, got %s", meta["owner"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestGetProductAssetContextReturnsNilWhenMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	productID := uuid.New()

	rows := sqlmock.NewRows([]string{
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
	})

	mock.ExpectQuery("SELECT product_id, tenant_id").WithArgs(productID).WillReturnRows(rows)

	record, err := GetProductAssetContext(context.Background(), db, nil, productID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if record != nil {
		t.Fatalf("expected nil record")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestUpsertProductAssetContext(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	productID := uuid.New()
	tenantID := uuid.New()
	createdAt := time.Now().UTC().Add(-time.Minute)
	updatedAt := time.Now().UTC()

	rows := sqlmock.NewRows([]string{
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
		"internal",
		"high",
		pq.Array([]string{"pci"}),
		[]byte(`{"owner":"secops"}`),
		createdAt,
		updatedAt,
	)

	mock.ExpectQuery("INSERT INTO product_asset_context").
		WithArgs(
			tenantID,
			productID,
			"prod",
			true,
			"internal",
			"high",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnRows(rows)

	businessImpact := "high"
	result, err := UpsertProductAssetContext(context.Background(), db, ProductAssetContextUpsert{
		ProductID:          productID,
		TenantID:           &tenantID,
		Environment:        "prod",
		InternetExposed:    true,
		DataClassification: "internal",
		BusinessImpact:     &businessImpact,
		Tags:               []string{"pci"},
		Metadata:           json.RawMessage(`{"owner":"secops"}`),
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result == nil {
		t.Fatalf("expected result")
	}
	if result.ProductID != productID {
		t.Fatalf("expected product id %s, got %s", productID, result.ProductID)
	}
	if result.TenantID == nil || *result.TenantID != tenantID {
		t.Fatalf("expected tenant id %s", tenantID)
	}
	if result.Environment != "prod" {
		t.Fatalf("expected environment prod")
	}
	if !result.InternetExposed {
		t.Fatalf("expected internet exposed true")
	}
	if result.DataClassification != "internal" {
		t.Fatalf("expected data classification internal")
	}
	if result.BusinessImpact == nil || *result.BusinessImpact != "high" {
		t.Fatalf("expected business impact high")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
