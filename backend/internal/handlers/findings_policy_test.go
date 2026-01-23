package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"lotus-warden/backend/internal/handlers"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/policies"
)

type stubPolicyEvaluator struct {
	decision policies.Decision
	err      error
}

func (s stubPolicyEvaluator) Evaluate(_ policies.Context) (policies.Decision, error) {
	return s.decision, s.err
}

func TestStatusChangeBlockedByPolicy(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	findingID := uuid.New()
	now := time.Now().UTC()

	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "title", "description", "fingerprint", "severity", "status", "category", "product_id", "name", "assignee_id", "import_job_id", "first_seen_at", "last_seen_at", "repeat_count", "duplicate_id", "source_type", "source_version", "endpoint_method", "endpoint_path", "evidence", "raw_data", "created_at", "updated_at", "deleted_at",
	}).AddRow(
		findingID,
		nil,
		"Test",
		nil,
		"fp",
		"high",
		models.StatusNew,
		models.CategorySAST,
		nil,
		"Product",
		nil,
		nil,
		now,
		now,
		0,
		nil,
		nil,
		nil,
		nil,
		nil,
		json.RawMessage("{}"),
		json.RawMessage("{}"),
		now,
		now,
		nil,
	)

	mock.ExpectQuery("SELECT\\s+f.id").
		WithArgs(findingID).
		WillReturnRows(rows)

	mock.ExpectQuery("SELECT id FROM finding_events").
		WithArgs(findingID, "policy_evaluated", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), findingID, sqlmock.AnyArg(), "policy_evaluated", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mock.ExpectQuery("SELECT id FROM finding_events").
		WithArgs(findingID, "status_change_blocked_by_policy", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), findingID, sqlmock.AnyArg(), "status_change_blocked_by_policy", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	evaluator := stubPolicyEvaluator{decision: policies.Decision{
		Outcome: policies.OutcomeFail,
		Violations: []policies.Violation{
			{Code: "GATE_FAIL", Message: "Blocked", Severity: "high"},
		},
	}}

	handler := handlers.NewFindingsHandler(db, evaluator)
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", uuid.New())
		c.Locals("roles", []string{"admin"})
		return c.Next()
	})
	app.Put("/api/v1/findings/:id", handler.Update)

	body, _ := json.Marshal(map[string]any{"status": models.StatusConfirmed})
	req := httptest.NewRequest("PUT", "/api/v1/findings/"+findingID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected 409 status, got %d", resp.StatusCode)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
