package storage

import (
	"context"
	"encoding/json"
	"testing"

	"red-lycoris/backend/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestCreateAuditLog_EmptyDiffUsesNullAndJSONDefaults(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	entry := &models.AuditLog{
		TenantID:   uuid.New(),
		Action:     "finding.updated",
		TargetType: "finding",
		Scope:      "product",
		DiffJSON:   json.RawMessage{},
	}

	mock.ExpectExec("INSERT INTO audit_log").
		WithArgs(
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
			nil,
			nil,
			nil,
			"finding.updated",
			"finding",
			nil,
			"product",
			nil,
			nil,
			nil,
			nil,
			nil,
			nil,
			[]byte("{}"),
			[]byte("{}"),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := CreateAuditLog(context.Background(), db, entry); err != nil {
		t.Fatalf("CreateAuditLog returned error: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
