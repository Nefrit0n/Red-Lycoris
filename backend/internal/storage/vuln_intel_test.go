package storage

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestUpsertVulnIntelSuccess(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	record := VulnIntelRecord{
		Identifier:      "CVE-2024-0001",
		SourceVersion:   "v1",
		References:      []IntelReference{{URL: "https://example.com/advisory"}},
		CVSSScore:       floatPtr(9.8),
		CVSSVersion:     stringPtr("3.1"),
		EPSSScore:       floatPtr(0.42),
		EPSSPercentile:  floatPtr(0.88),
		KEV:             true,
		FailCount:       0,
		LastRefreshedAt: &now,
	}

	query := regexp.QuoteMeta("INSERT INTO vuln_intel (")
	mock.ExpectExec(query).
		WithArgs(
			record.Identifier,
			record.SourceVersion,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			*record.CVSSScore,
			*record.CVSSVersion,
			*record.EPSSScore,
			*record.EPSSPercentile,
			record.KEV,
			record.FailCount,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := UpsertVulnIntel(context.Background(), db, record); err != nil {
		t.Fatalf("expected upsert to succeed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateVulnIntelError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	nextRetry := time.Now().UTC().Add(30 * time.Minute)
	query := regexp.QuoteMeta("INSERT INTO vuln_intel (identifier, source_version, last_error, next_retry_at, fail_count, updated_at)")
	mock.ExpectExec(query).
		WithArgs(
			"CVE-2024-0002",
			"v1",
			"timeout",
			nextRetry,
			3,
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := UpdateVulnIntelError(context.Background(), db, "CVE-2024-0002", "v1", "timeout", nextRetry, 3); err != nil {
		t.Fatalf("expected update error to succeed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func floatPtr(v float64) *float64 {
	return &v
}

func stringPtr(v string) *string {
	return &v
}
