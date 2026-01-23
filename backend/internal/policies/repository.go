package policies

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AssignmentScope struct {
	Scope   string
	ScopeID *uuid.UUID
}

type PolicyAssignment struct {
	ID           uuid.UUID
	PolicyID     uuid.UUID
	PolicyRuleID *uuid.UUID
	Scope        string
	ScopeID      *uuid.UUID
	Priority     int
}

type PolicyRule struct {
	ID         uuid.UUID
	PolicyID   uuid.UUID
	Version    string
	Format     string
	Content    string
	Sha256     string
	Entrypoint *string
}

type PolicyResult struct {
	PolicyID     uuid.UUID
	PolicyRuleID *uuid.UUID
	SubjectType  string
	SubjectID    uuid.UUID
	Decision     string
	Violations   []Violation
	InputHash    string
	EvaluatedAt  time.Time
}

type Repository interface {
	GetAssignments(ctx context.Context, scope AssignmentScope) ([]PolicyAssignment, error)
	GetRuleContent(ctx context.Context, policyRuleID uuid.UUID) (PolicyRule, error)
	WritePolicyResult(ctx context.Context, result PolicyResult) error
}
