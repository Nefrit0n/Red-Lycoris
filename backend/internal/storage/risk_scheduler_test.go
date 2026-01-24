package storage

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestListAffectedFindingsByIntel(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	tenantID := uuid.New()
	afterID := uuid.New()
	since := time.Now().Add(-2 * time.Hour)
	until := time.Now().Add(-1 * time.Hour)

	rows := sqlmock.NewRows([]string{"id"}).
		AddRow(uuid.New()).
		AddRow(uuid.New())

	mock.ExpectQuery("SELECT DISTINCT f.id").
		WithArgs(tenantID, since, until, afterID, 5000).
		WillReturnRows(rows)

	ids, err := ListAffectedFindingsByIntel(context.Background(), db, tenantID, since, until, afterID, 5000)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("expected 2 ids, got %d", len(ids))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet db expectations: %v", err)
	}
}
