package importing

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/policies"
)

type stubEvaluator struct {
	decision policies.Decision
	err      error
}

func (s stubEvaluator) Evaluate(_ policies.Context) (policies.Decision, error) {
	return s.decision, s.err
}

func TestApplyFindingPoliciesAutoStatusCreatesEvents(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock setup failed: %v", err)
	}
	defer db.Close()

	findingID := uuid.New()
	now := time.Now().UTC()
	finding := &models.Finding{
		ID:          findingID,
		Title:       "Test",
		Severity:    "high",
		Status:      models.StatusNew,
		Category:    models.CategorySAST,
		FirstSeenAt: now,
		LastSeenAt:  now,
	}

	autoStatus := models.StatusConfirmed
	decision := policies.Decision{
		Outcome: policies.OutcomePass,
		Actions: []policies.Action{{Type: "auto_status", Status: &autoStatus}},
		Policy: &policies.PolicyMeta{
			PolicyID:      "policy-1",
			PolicyVersion: "1.0.0",
		},
	}

	mock.ExpectQuery("SELECT id FROM finding_events").
		WithArgs(findingID, "policy_evaluated", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), findingID, sqlmock.AnyArg(), "policy_evaluated", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// UpdateFinding RETURNING clause has 24 columns:
	// id, scan_result_id, product_id, import_job_id, fingerprint, title, description, severity, status,
	// duplicate_id, repeat_count, first_seen_at, last_seen_at, created_at, updated_at, evidence,
	// source_type, category, sla_due_at, sla_breached, sla_breached_at, sla_profile, sla_source, assignee_id
	rows := sqlmock.NewRows([]string{
		"id", "scan_result_id", "product_id", "import_job_id", "fingerprint", "title", "description",
		"severity", "status", "duplicate_id", "repeat_count", "first_seen_at", "last_seen_at",
		"created_at", "updated_at", "evidence", "source_type", "category",
		"sla_due_at", "sla_breached", "sla_breached_at", "sla_profile", "sla_source", "assignee_id",
	}).AddRow(
		findingID,             // id
		nil,                   // scan_result_id
		nil,                   // product_id
		nil,                   // import_job_id
		"fp",                  // fingerprint
		"Test",                // title
		nil,                   // description
		"high",                // severity
		autoStatus,            // status
		nil,                   // duplicate_id
		0,                     // repeat_count
		now,                   // first_seen_at
		now,                   // last_seen_at
		now,                   // created_at
		now,                   // updated_at
		json.RawMessage("{}"), // evidence
		nil,                   // source_type
		models.CategorySAST,   // category
		nil,                   // sla_due_at
		false,                 // sla_breached
		nil,                   // sla_breached_at
		nil,                   // sla_profile
		nil,                   // sla_source
		nil,                   // assignee_id
	)

	mock.ExpectQuery("UPDATE findings").
		WillReturnRows(rows)

	mock.ExpectQuery("SELECT id FROM finding_events").
		WithArgs(findingID, "status_changed_by_policy", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec("INSERT INTO finding_events").
		WithArgs(sqlmock.AnyArg(), findingID, sqlmock.AnyArg(), "status_changed_by_policy", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	params := policyFindingParams{
		DecisionEngine: stubEvaluator{decision: decision},
		Finding:        finding,
		ParserFinding:  parser.Finding{Severity: "HIGH"},
		Scanner:        "trivy",
		SourceType:     stringPtr("scanner"),
		ActorID:        nil,
		CorrelationID:  nil,
	}

	if err := applyFindingPolicies(context.Background(), db, params); err != nil {
		t.Fatalf("applyFindingPolicies: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func stringPtr(value string) *string {
	return &value
}
