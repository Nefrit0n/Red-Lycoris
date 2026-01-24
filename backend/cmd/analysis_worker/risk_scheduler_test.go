package main

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestRiskRecomputeMsgIDDeterministic(t *testing.T) {
	findingID := uuid.New()
	causeAt := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)

	first := riskRecomputeMsgID(findingID, "intel_epss", "", causeAt)
	second := riskRecomputeMsgID(findingID, "intel_epss", "", causeAt)
	if first != second {
		t.Fatalf("expected deterministic msg id, got %s and %s", first, second)
	}

	third := riskRecomputeMsgID(findingID, "asset_context", "", causeAt)
	if first == third {
		t.Fatalf("expected different msg id for different source")
	}
}

func TestRunRiskModelRescoreResumesFromCursor(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	tenantID := uuid.New()
	jobID := uuid.New()
	cursorID := uuid.New()
	modelVersion := "v2"
	findingID := uuid.New()

	jobRows := sqlmock.NewRows([]string{
		"job_id",
		"tenant_id",
		"model_version",
		"status",
		"cursor_last_finding_id",
		"started_at",
		"finished_at",
		"stats",
		"created_at",
		"updated_at",
	}).AddRow(
		jobID,
		tenantID,
		modelVersion,
		"running",
		cursorID,
		time.Now().Add(-time.Minute),
		nil,
		[]byte(`{\"processed\":1,\"enqueued\":1,\"errors\":0}`),
		time.Now().Add(-time.Minute),
		time.Now().Add(-time.Minute),
	)

	mock.ExpectQuery("SELECT job_id, tenant_id").WithArgs(tenantID, modelVersion).WillReturnRows(jobRows)
	mock.ExpectQuery("SELECT f.id").WithArgs(tenantID, cursorID, 1000).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(findingID))
	mock.ExpectExec("UPDATE risk_rescore_jobs").
		WithArgs(findingID, sqlmock.AnyArg(), jobID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("UPDATE risk_rescore_jobs").
		WithArgs("done", sqlmock.AnyArg(), sqlmock.AnyArg(), jobID).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := runRiskModelRescore(context.Background(), db, nil, tenantID, modelVersion, time.Now()); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
