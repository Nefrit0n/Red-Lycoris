package storage

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"

	"lotus-warden/backend/internal/policies"
)

type PolicyRepository struct {
	db *sql.DB
}

func NewPolicyRepository(db *sql.DB) *PolicyRepository {
	return &PolicyRepository{db: db}
}

func (r *PolicyRepository) GetAssignments(ctx context.Context, scope policies.AssignmentScope) ([]policies.PolicyAssignment, error) {
	var (
		query string
		args  []any
	)

	if scope.ScopeID == nil {
		query = `SELECT pa.id, pa.policy_id, pa.policy_rule_id, pa.scope, pa.scope_id, pa.priority
			FROM policy_assignments pa
			JOIN policies p ON p.id = pa.policy_id
			WHERE pa.scope = $1 AND pa.scope_id IS NULL AND p.status = 'enabled'
			ORDER BY pa.priority DESC, pa.created_at ASC`
		args = []any{scope.Scope}
	} else {
		query = `SELECT pa.id, pa.policy_id, pa.policy_rule_id, pa.scope, pa.scope_id, pa.priority
			FROM policy_assignments pa
			JOIN policies p ON p.id = pa.policy_id
			WHERE pa.scope = $1 AND pa.scope_id = $2 AND p.status = 'enabled'
			ORDER BY pa.priority DESC, pa.created_at ASC`
		args = []any{scope.Scope, *scope.ScopeID}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []policies.PolicyAssignment
	for rows.Next() {
		var assignment policies.PolicyAssignment
		var ruleID sql.NullString
		var scopeID sql.NullString
		if err := rows.Scan(
			&assignment.ID,
			&assignment.PolicyID,
			&ruleID,
			&assignment.Scope,
			&scopeID,
			&assignment.Priority,
		); err != nil {
			return nil, err
		}
		if ruleID.Valid {
			id, err := uuid.Parse(ruleID.String)
			if err != nil {
				return nil, err
			}
			assignment.PolicyRuleID = &id
		}
		if scopeID.Valid {
			id, err := uuid.Parse(scopeID.String)
			if err != nil {
				return nil, err
			}
			assignment.ScopeID = &id
		}
		assignments = append(assignments, assignment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return assignments, nil
}

func (r *PolicyRepository) GetRuleContent(ctx context.Context, policyRuleID uuid.UUID) (policies.PolicyRule, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, policy_id, version, format, content, sha256, entrypoint
		 FROM policy_rules
		 WHERE id = $1`,
		policyRuleID,
	)

	var rule policies.PolicyRule
	var entrypoint sql.NullString
	if err := row.Scan(
		&rule.ID,
		&rule.PolicyID,
		&rule.Version,
		&rule.Format,
		&rule.Content,
		&rule.Sha256,
		&entrypoint,
	); err != nil {
		return policies.PolicyRule{}, err
	}
	if entrypoint.Valid {
		value := entrypoint.String
		rule.Entrypoint = &value
	}
	return rule, nil
}

func (r *PolicyRepository) WritePolicyResult(ctx context.Context, result policies.PolicyResult) error {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id FROM policy_results
		 WHERE policy_id = $1
		 AND policy_rule_id IS NOT DISTINCT FROM $2
		 AND subject_type = $3
		 AND subject_id = $4
		 AND input_hash = $5
		 LIMIT 1`,
		result.PolicyID,
		result.PolicyRuleID,
		result.SubjectType,
		result.SubjectID,
		result.InputHash,
	)
	var existingID uuid.UUID
	if err := row.Scan(&existingID); err == nil {
		return nil
	} else if err != sql.ErrNoRows {
		return err
	}

	violationsJSON, err := json.Marshal(result.Violations)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO policy_results (policy_id, policy_rule_id, subject_type, subject_id, decision, violations, input_hash, evaluated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		result.PolicyID,
		result.PolicyRuleID,
		result.SubjectType,
		result.SubjectID,
		result.Decision,
		anyRawJSON(violationsJSON),
		result.InputHash,
		result.EvaluatedAt,
	)
	return err
}
