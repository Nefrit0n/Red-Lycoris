package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type PolicyRecord struct {
	ID          uuid.UUID
	TenantID    uuid.NullUUID
	Name        string
	Kind        string
	Status      string
	Description sql.NullString
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type PolicyListItem struct {
	PolicyRecord
	LatestVersion    sql.NullString
	LatestRuleID     uuid.NullUUID
	AssignmentsCount int
}

type PolicyRuleRecord struct {
	ID         uuid.UUID
	PolicyID   uuid.UUID
	Version    string
	Format     string
	Content    string
	Sha256     string
	Entrypoint sql.NullString
	CreatedAt  time.Time
}

type PolicyAssignmentRecord struct {
	ID           uuid.UUID
	PolicyID     uuid.UUID
	PolicyRuleID uuid.NullUUID
	Scope        string
	ScopeID      uuid.NullUUID
	Priority     int
	CreatedAt    time.Time
}

type PolicyFilters struct {
	Limit    int
	Offset   int
	Query    string
	Status   string
	Kind     string
	TenantID *uuid.UUID
}

type UpdatePolicyParams struct {
	Name        *string
	Description *string
	Status      *string
}

func ListPolicies(ctx context.Context, db *sql.DB, filters PolicyFilters) ([]PolicyListItem, int, error) {
	if filters.Limit <= 0 {
		filters.Limit = 50
	}
	if filters.Limit > 200 {
		filters.Limit = 200
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	where := []string{"1=1"}
	args := []interface{}{}

	if filters.Query != "" {
		args = append(args, "%"+filters.Query+"%")
		where = append(where, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d)", len(args), len(args)))
	}
	if filters.Status != "" {
		args = append(args, filters.Status)
		where = append(where, fmt.Sprintf("p.status = $%d", len(args)))
	}
	if filters.Kind != "" {
		args = append(args, filters.Kind)
		where = append(where, fmt.Sprintf("p.kind = $%d", len(args)))
	}
	if filters.TenantID != nil {
		args = append(args, *filters.TenantID)
		where = append(where, fmt.Sprintf("p.tenant_id = $%d", len(args)))
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM policies p " + whereClause
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	listQuery := fmt.Sprintf(`
        SELECT
            p.id, p.tenant_id, p.name, p.kind, p.status, p.description, p.created_at, p.updated_at,
            lr.version, lr.id,
            COALESCE(pa.assignments_count, 0)
        FROM policies p
        LEFT JOIN LATERAL (
            SELECT pr.id, pr.version
            FROM policy_rules pr
            WHERE pr.policy_id = p.id
            ORDER BY pr.created_at DESC
            LIMIT 1
        ) lr ON true
        LEFT JOIN (
            SELECT policy_id, COUNT(*) AS assignments_count
            FROM policy_assignments
            GROUP BY policy_id
        ) pa ON pa.policy_id = p.id
        %s
        ORDER BY p.updated_at DESC
        LIMIT $%d OFFSET $%d`,
		whereClause,
		len(args)-1,
		len(args),
	)

	rows, err := db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []PolicyListItem{}
	for rows.Next() {
		var item PolicyListItem
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.Name,
			&item.Kind,
			&item.Status,
			&item.Description,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.LatestVersion,
			&item.LatestRuleID,
			&item.AssignmentsCount,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func GetPolicyByID(ctx context.Context, db *sql.DB, id uuid.UUID, tenantID *uuid.UUID) (*PolicyRecord, error) {
	args := []interface{}{id}
	tenantClause := ""
	if tenantID != nil {
		args = append(args, *tenantID)
		tenantClause = fmt.Sprintf(" AND tenant_id = $%d", len(args))
	}
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, name, kind, status, description, created_at, updated_at
         FROM policies
         WHERE id = $1`+tenantClause,
		args...,
	)

	var policy PolicyRecord
	if err := row.Scan(
		&policy.ID,
		&policy.TenantID,
		&policy.Name,
		&policy.Kind,
		&policy.Status,
		&policy.Description,
		&policy.CreatedAt,
		&policy.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &policy, nil
}

func ListPolicyRules(ctx context.Context, db *sql.DB, policyID uuid.UUID, tenantID *uuid.UUID) ([]PolicyRuleRecord, error) {
	args := []interface{}{policyID}
	tenantClause := ""
	if tenantID != nil {
		args = append(args, *tenantID)
		tenantClause = fmt.Sprintf(" AND p.tenant_id = $%d", len(args))
	}
	rows, err := db.QueryContext(
		ctx,
		`SELECT pr.id, pr.policy_id, pr.version, pr.format, pr.content, pr.sha256, pr.entrypoint, pr.created_at
         FROM policy_rules pr
         JOIN policies p ON p.id = pr.policy_id
         WHERE pr.policy_id = $1`+tenantClause+`
         ORDER BY pr.created_at DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []PolicyRuleRecord{}
	for rows.Next() {
		var rule PolicyRuleRecord
		if err := rows.Scan(
			&rule.ID,
			&rule.PolicyID,
			&rule.Version,
			&rule.Format,
			&rule.Content,
			&rule.Sha256,
			&rule.Entrypoint,
			&rule.CreatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return rules, nil
}

func ListPolicyAssignments(ctx context.Context, db *sql.DB, policyID uuid.UUID, tenantID *uuid.UUID) ([]PolicyAssignmentRecord, error) {
	args := []interface{}{policyID}
	tenantClause := ""
	if tenantID != nil {
		args = append(args, *tenantID)
		tenantClause = fmt.Sprintf(" AND p.tenant_id = $%d", len(args))
	}
	rows, err := db.QueryContext(
		ctx,
		`SELECT pa.id, pa.policy_id, pa.policy_rule_id, pa.scope, pa.scope_id, pa.priority, pa.created_at
         FROM policy_assignments pa
         JOIN policies p ON p.id = pa.policy_id
         WHERE pa.policy_id = $1`+tenantClause+`
         ORDER BY pa.priority DESC, pa.created_at ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assignments := []PolicyAssignmentRecord{}
	for rows.Next() {
		var assignment PolicyAssignmentRecord
		if err := rows.Scan(
			&assignment.ID,
			&assignment.PolicyID,
			&assignment.PolicyRuleID,
			&assignment.Scope,
			&assignment.ScopeID,
			&assignment.Priority,
			&assignment.CreatedAt,
		); err != nil {
			return nil, err
		}
		assignments = append(assignments, assignment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return assignments, nil
}

func UpdatePolicy(ctx context.Context, db *sql.DB, id uuid.UUID, params UpdatePolicyParams) (*PolicyRecord, error) {
	setClauses := []string{}
	args := []interface{}{}

	if params.Name != nil {
		args = append(args, *params.Name)
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", len(args)))
	}
	if params.Description != nil {
		args = append(args, *params.Description)
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", len(args)))
	}
	if params.Status != nil {
		args = append(args, *params.Status)
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", len(args)))
	}

	if len(setClauses) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	args = append(args, time.Now().UTC())
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", len(args)))

	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE policies
         SET %s
         WHERE id = $%d
         RETURNING id, tenant_id, name, kind, status, description, created_at, updated_at`,
		strings.Join(setClauses, ", "),
		len(args),
	)

	row := db.QueryRowContext(ctx, query, args...)

	var policy PolicyRecord
	if err := row.Scan(
		&policy.ID,
		&policy.TenantID,
		&policy.Name,
		&policy.Kind,
		&policy.Status,
		&policy.Description,
		&policy.CreatedAt,
		&policy.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &policy, nil
}

func DeletePolicy(ctx context.Context, db *sql.DB, id uuid.UUID) error {
	_, err := db.ExecContext(
		ctx,
		`DELETE FROM policies WHERE id = $1`,
		id,
	)
	return err
}

func GetPolicyRuleIDByVersion(ctx context.Context, db *sql.DB, policyID uuid.UUID, version string) (*uuid.UUID, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id FROM policy_rules WHERE policy_id = $1 AND version = $2`,
		policyID,
		version,
	)
	var id uuid.UUID
	if err := row.Scan(&id); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}
