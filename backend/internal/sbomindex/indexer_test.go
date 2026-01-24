package sbomindex

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestEnsureComponentIdempotent(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock init failed: %v", err)
	}
	defer db.Close()

	comp := ComponentInput{
		Purl:      "pkg:npm/lodash@4.17.21",
		Name:      "lodash",
		Ecosystem: "npm",
	}
	id := uuid.New()

	mock.ExpectBegin()
	rows := sqlmock.NewRows([]string{"id"}).AddRow(id)
	mock.ExpectQuery("INSERT INTO sca_components").
		WithArgs(comp.Purl, comp.Ecosystem, comp.Name).
		WillReturnRows(rows)
	rows2 := sqlmock.NewRows([]string{"id"}).AddRow(id)
	mock.ExpectQuery("INSERT INTO sca_components").
		WithArgs(comp.Purl, comp.Ecosystem, comp.Name).
		WillReturnRows(rows2)
	mock.ExpectCommit()

	tx, err := db.Begin()
	if err != nil {
		t.Fatalf("begin failed: %v", err)
	}

	ctx := context.Background()
	first, err := ensureComponent(ctx, tx, comp)
	if err != nil {
		t.Fatalf("first ensure failed: %v", err)
	}
	second, err := ensureComponent(ctx, tx, comp)
	if err != nil {
		t.Fatalf("second ensure failed: %v", err)
	}
	if first != second {
		t.Fatalf("expected same component id, got %s and %s", first, second)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("commit failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
