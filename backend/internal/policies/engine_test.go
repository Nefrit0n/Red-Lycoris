package policies

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/google/uuid"
)

type inMemoryRepo struct {
	assignments map[string][]PolicyAssignment
	rules       map[uuid.UUID]PolicyRule
	results     map[string]PolicyResult
}

func newInMemoryRepo() *inMemoryRepo {
	return &inMemoryRepo{
		assignments: make(map[string][]PolicyAssignment),
		rules:       make(map[uuid.UUID]PolicyRule),
		results:     make(map[string]PolicyResult),
	}
}

func (r *inMemoryRepo) GetAssignments(_ context.Context, scope AssignmentScope) ([]PolicyAssignment, error) {
	key := scope.Scope
	if scope.ScopeID != nil {
		key = key + ":" + scope.ScopeID.String()
	}
	return append([]PolicyAssignment(nil), r.assignments[key]...), nil
}

func (r *inMemoryRepo) GetRuleContent(_ context.Context, policyRuleID uuid.UUID) (PolicyRule, error) {
	return r.rules[policyRuleID], nil
}

func (r *inMemoryRepo) WritePolicyResult(_ context.Context, result PolicyResult) error {
	key := result.PolicyID.String()
	if result.PolicyRuleID != nil {
		key += ":" + result.PolicyRuleID.String()
	}
	key += ":" + result.SubjectID.String() + ":" + result.InputHash
	if _, exists := r.results[key]; exists {
		return nil
	}
	r.results[key] = result
	return nil
}

func TestEvaluateAggregatesDecisions(t *testing.T) {
	repo := newInMemoryRepo()
	engine := NewEngine(repo)

	policyID := uuid.New()
	gateRuleID := uuid.New()
	autoRuleID := uuid.New()

	gateRego := `package lotus.policies.gate_fail

default decision := {"outcome": "pass", "actions": [], "violations": []}

decision := {
	"outcome": "fail",
	"actions": [{"type": "gate_fail"}],
	"violations": [{"code": "GATE_CRITICAL_FIX", "message": "Fix available", "severity": "critical"}],
} if {
	input.finding.severity == "CRITICAL"
	input.finding.fixedVersion != ""
}`

	autoAssignRego := `package lotus.policies.auto_assign

default decision := {"outcome": "pass", "actions": [], "violations": []}

decision := {
	"outcome": "pass",
	"actions": [{"type": "auto_assign"}],
	"violations": [],
} if {
	input.finding.category == "SCA"
}`

	repo.rules[gateRuleID] = PolicyRule{
		ID:         gateRuleID,
		PolicyID:   policyID,
		Version:    "1.0.0",
		Format:     "rego",
		Content:    gateRego,
		Sha256:     sha256Hex(gateRego),
		Entrypoint: stringPtr("data.lotus.policies.gate_fail.decision"),
	}
	repo.rules[autoRuleID] = PolicyRule{
		ID:         autoRuleID,
		PolicyID:   policyID,
		Version:    "1.0.0",
		Format:     "rego",
		Content:    autoAssignRego,
		Sha256:     sha256Hex(autoAssignRego),
		Entrypoint: stringPtr("data.lotus.policies.auto_assign.decision"),
	}

	repo.assignments["global"] = []PolicyAssignment{
		{
			ID:           uuid.New(),
			PolicyID:     policyID,
			PolicyRuleID: &gateRuleID,
			Scope:        "global",
			Priority:     100,
		},
		{
			ID:           uuid.New(),
			PolicyID:     policyID,
			PolicyRuleID: &autoRuleID,
			Scope:        "global",
			Priority:     50,
		},
	}

	fixedVersion := "1.2.3"
	category := "SCA"
	ctx := Context{
		Subject: Subject{Type: "finding", ID: uuid.New().String()},
		Event:   Event{Type: "import"},
		Finding: &Finding{
			Severity:     "CRITICAL",
			Category:     &category,
			FixedVersion: &fixedVersion,
		},
	}

	decision, err := engine.Evaluate(ctx)
	if err != nil {
		t.Fatalf("evaluate: %v", err)
	}

	if decision.Outcome != OutcomeFail {
		t.Fatalf("expected outcome fail, got %s", decision.Outcome)
	}
	if len(decision.Actions) != 2 {
		t.Fatalf("expected 2 actions, got %d", len(decision.Actions))
	}
	if len(decision.Violations) != 1 {
		t.Fatalf("expected 1 violation, got %d", len(decision.Violations))
	}
	if decision.Policy == nil || decision.Policy.PolicyID != policyID.String() {
		t.Fatalf("expected policy metadata for gate policy")
	}
}

func TestEvaluateIsIdempotentByInputHash(t *testing.T) {
	repo := newInMemoryRepo()
	engine := NewEngine(repo)

	policyID := uuid.New()
	ruleID := uuid.New()

	regoModule := `package lotus.policies.auto_assign

default decision := {"outcome": "pass", "actions": [], "violations": []}

decision := {
	"outcome": "pass",
	"actions": [{"type": "auto_assign"}],
	"violations": [],
} if {
	input.finding.category == "SCA"
}`

	repo.rules[ruleID] = PolicyRule{
		ID:         ruleID,
		PolicyID:   policyID,
		Version:    "1.0.0",
		Format:     "rego",
		Content:    regoModule,
		Sha256:     sha256Hex(regoModule),
		Entrypoint: stringPtr("data.lotus.policies.auto_assign.decision"),
	}

	repo.assignments["global"] = []PolicyAssignment{
		{
			ID:           uuid.New(),
			PolicyID:     policyID,
			PolicyRuleID: &ruleID,
			Scope:        "global",
			Priority:     10,
		},
	}

	category := "SCA"
	ctx := Context{
		Subject: Subject{Type: "finding", ID: uuid.New().String()},
		Event:   Event{Type: "import"},
		Finding: &Finding{
			Severity: "HIGH",
			Category: &category,
		},
	}

	if _, err := engine.Evaluate(ctx); err != nil {
		t.Fatalf("evaluate first: %v", err)
	}
	if _, err := engine.Evaluate(ctx); err != nil {
		t.Fatalf("evaluate second: %v", err)
	}

	if len(repo.results) != 1 {
		t.Fatalf("expected 1 policy result, got %d", len(repo.results))
	}
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func stringPtr(value string) *string {
	return &value
}
