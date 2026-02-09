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

	"red-lycoris/backend/internal/handlers"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/policies"
	"red-lycoris/backend/internal/sla"
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

	// GetFindingDetailByID returns 38 columns
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "scan_result_id", "product_id", "import_job_id", "fingerprint",
		"category", "title", "description", "severity", "status", "duplicate_id", "assignee_id",
		"first_seen_at", "last_seen_at", "repeat_count", "created_at", "updated_at", "deleted_at", "last_activity",
		"sla_due_at", "sla_breached", "sla_breached_at", "sla_profile", "sla_source",
		"evidence", "raw_data",
		"source_type", "source_version", "endpoint_method", "endpoint_path",
		"risk_score", "risk_band", "factors", "computed_at", "model_version",
		"product_name", "scanner", "scan_created_at",
	}).AddRow(
		findingID,             // id
		nil,                   // tenant_id
		nil,                   // scan_result_id
		nil,                   // product_id
		nil,                   // import_job_id
		"fp",                  // fingerprint
		models.CategorySAST,   // category
		"Test",                // title
		nil,                   // description
		"high",                // severity
		models.StatusNew,      // status
		nil,                   // duplicate_id
		nil,                   // assignee_id
		now,                   // first_seen_at
		now,                   // last_seen_at
		0,                     // repeat_count
		now,                   // created_at
		now,                   // updated_at
		nil,                   // deleted_at
		now,                   // last_activity
		nil,                   // sla_due_at
		false,                 // sla_breached
		nil,                   // sla_breached_at
		nil,                   // sla_profile
		nil,                   // sla_source
		json.RawMessage("{}"), // evidence
		json.RawMessage("{}"), // raw_data
		nil,                   // source_type
		nil,                   // source_version
		nil,                   // endpoint_method
		nil,                   // endpoint_path
		nil,                   // risk_score
		nil,                   // risk_band
		nil,                   // factors
		nil,                   // computed_at
		nil,                   // model_version
		"Product",             // product_name
		nil,                   // scanner
		nil,                   // scan_created_at
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

	handler := handlers.NewFindingsHandler(db, evaluator, sla.DefaultMatrix())
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
