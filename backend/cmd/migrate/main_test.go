package main

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestWithAdvisoryLock(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock new: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectExec("SELECT pg_advisory_lock\\(\\$1\\)").
		WithArgs(migrationsLockKey).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("SELECT pg_advisory_unlock\\(\\$1\\)").
		WithArgs(migrationsLockKey).
		WillReturnResult(sqlmock.NewResult(1, 1))

	called := false
	if err := withAdvisoryLock(context.Background(), db, migrationsLockKey, func() error {
		called = true
		return nil
	}); err != nil {
		t.Fatalf("withAdvisoryLock: %v", err)
	}
	if !called {
		t.Fatal("expected callback to be executed")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
