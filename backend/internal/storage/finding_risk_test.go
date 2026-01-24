package storage

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestUpsertFindingRiskIdempotentByHash(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	findingID := uuid.New()
	tenantID := uuid.New()
	factors, _ := json.Marshal(map[string]any{"impact": map[string]any{"value": 0.7}})
	computedAt := time.Now().UTC()

	mock.ExpectExec("INSERT INTO finding_risk").WithArgs(
		findingID,
		tenantID,
		"v1",
		42.0,
		"high",
		factors,
		computedAt,
		"hash-1",
		"import",
	).WillReturnResult(sqlmock.NewResult(1, 1))

	updated, err := UpsertFindingRisk(context.Background(), db, FindingRiskUpsert{
		FindingID:    findingID,
		TenantID:     &tenantID,
		ModelVersion: "v1",
		RiskScore:    42.0,
		RiskBand:     "high",
		Factors:      factors,
		ComputedAt:   computedAt,
		InputHash:    "hash-1",
		Source:       "import",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !updated {
		t.Fatalf("expected update on first insert")
	}

	mock.ExpectExec("INSERT INTO finding_risk").WithArgs(
		findingID,
		tenantID,
		"v1",
		42.0,
		"high",
		factors,
		computedAt,
		"hash-1",
		"import",
	).WillReturnResult(sqlmock.NewResult(1, 0))

	updated, err = UpsertFindingRisk(context.Background(), db, FindingRiskUpsert{
		FindingID:    findingID,
		TenantID:     &tenantID,
		ModelVersion: "v1",
		RiskScore:    42.0,
		RiskBand:     "high",
		Factors:      factors,
		ComputedAt:   computedAt,
		InputHash:    "hash-1",
		Source:       "import",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if updated {
		t.Fatalf("expected no update when input hash matches")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
