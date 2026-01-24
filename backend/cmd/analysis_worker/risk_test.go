package main

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

func TestHandleRiskMessageCommitsBeforeAck(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	findingID := uuid.New()
	tenantID := uuid.New()
	firstSeen := time.Now().Add(-48 * time.Hour)
	lastSeen := time.Now().Add(-2 * time.Hour)

	findingRows := sqlmock.NewRows([]string{
		"id",
		"tenant_id",
		"severity",
		"status",
		"category",
		"product_id",
		"first_seen_at",
		"last_seen_at",
		"asset_criticality",
	}).AddRow(
		findingID,
		tenantID,
		"high",
		"new",
		"SAST",
		nil,
		firstSeen,
		lastSeen,
		"high",
	)

	mock.ExpectQuery("SELECT f.id, f.tenant_id").WithArgs(findingID).WillReturnRows(findingRows)
	mock.ExpectQuery("SELECT fvi.finding_id").WithArgs(sqlmock.AnyArg()).WillReturnRows(sqlmock.NewRows([]string{"finding_id", "identifiers", "cvss_score", "cvss_version", "epss_score", "epss_percentile", "kev", "last_refreshed_at"}))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO finding_risk").WithArgs(
		findingID,
		tenantID,
		"v1",
		sqlmock.AnyArg(),
		"high",
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		sqlmock.AnyArg(),
		"import",
	).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	payload, err := json.Marshal(riskRecomputeMessage{
		FindingID: findingID.String(),
		Source:    "import",
	})
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	err = handleRiskMessage(context.Background(), &nats.Msg{Data: payload}, db)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestHandleRiskMessageReturnsErrorOnUpsertFailure(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	findingID := uuid.New()
	findingRows := sqlmock.NewRows([]string{
		"id",
		"tenant_id",
		"severity",
		"status",
		"category",
		"product_id",
		"first_seen_at",
		"last_seen_at",
		"asset_criticality",
	}).AddRow(
		findingID,
		nil,
		"medium",
		"new",
		"SAST",
		nil,
		time.Now().Add(-24*time.Hour),
		time.Now().Add(-1*time.Hour),
		"medium",
	)

	mock.ExpectQuery("SELECT f.id, f.tenant_id").WithArgs(findingID).WillReturnRows(findingRows)
	mock.ExpectQuery("SELECT fvi.finding_id").WithArgs(sqlmock.AnyArg()).WillReturnRows(sqlmock.NewRows([]string{"finding_id", "identifiers", "cvss_score", "cvss_version", "epss_score", "epss_percentile", "kev", "last_refreshed_at"}))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO finding_risk").WillReturnError(errors.New("write failed"))
	mock.ExpectRollback()

	payload, err := json.Marshal(riskRecomputeMessage{
		FindingID: findingID.String(),
		Source:    "import",
	})
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	err = handleRiskMessage(context.Background(), &nats.Msg{Data: payload}, db)
	if err == nil {
		t.Fatalf("expected error")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
