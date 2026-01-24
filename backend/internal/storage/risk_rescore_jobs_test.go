package storage

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestListFindingsForRescoreRespectsCursor(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	tenantID := uuid.New()
	cursorID := uuid.New()

	rows := sqlmock.NewRows([]string{"id"}).AddRow(uuid.New())
	mock.ExpectQuery("SELECT f.id").
		WithArgs(tenantID, cursorID, 5000).
		WillReturnRows(rows)

	ids, err := ListFindingsForRescore(context.Background(), db, tenantID, cursorID, 5000)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(ids) != 1 {
		t.Fatalf("expected 1 id, got %d", len(ids))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}

func TestTryRiskRescoreLock(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT pg_try_advisory_lock").WithArgs("tenant:model").
		WillReturnRows(sqlmock.NewRows([]string{"pg_try_advisory_lock"}).AddRow(false))

	locked, err := TryRiskRescoreLock(context.Background(), db, "tenant:model")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if locked {
		t.Fatalf("expected lock to be false")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
