package storage

import (
	"context"
	"database/sql"
	"errors"
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

	q := likePatternOrNil(filters.Query)

	var tenant any
	if filters.TenantID != nil {
		tenant = *filters.TenantID
	}

	var total int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM policies p
		 WHERE ($1::text IS NULL OR (p.name ILIKE $1 OR p.description ILIKE $1))
		   AND ($2::text IS NULL OR p.status = $2)
		   AND ($3::text IS NULL OR p.kind = $3)
		   AND ($4::uuid IS NULL OR p.tenant_id = $4)`,
		q,
		nilIfEmpty(filters.Status),
		nilIfEmpty(filters.Kind),
		tenant,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT
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
		WHERE ($1::text IS NULL OR (p.name ILIKE $1 OR p.description ILIKE $1))
		  AND ($2::text IS NULL OR p.status = $2)
		  AND ($3::text IS NULL OR p.kind = $3)
		  AND ($4::uuid IS NULL OR p.tenant_id = $4)
		ORDER BY p.updated_at DESC
		LIMIT $5 OFFSET $6`,
		q,
		nilIfEmpty(filters.Status),
		nilIfEmpty(filters.Kind),
		tenant,
		filters.Limit,
		filters.Offset,
	)
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
	var tenant any
	if tenantID != nil {
		tenant = *tenantID
	}

	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, name, kind, status, description, created_at, updated_at
		 FROM policies
		 WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)`,
		id,
		tenant,
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
	var tenant any
	if tenantID != nil {
		tenant = *tenantID
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT pr.id, pr.policy_id, pr.version, pr.format, pr.content, pr.sha256, pr.entrypoint, pr.created_at
		 FROM policy_rules pr
		 INNER JOIN policies p ON p.id = pr.policy_id
		 WHERE pr.policy_id = $1 AND ($2::uuid IS NULL OR p.tenant_id = $2)
		 ORDER BY pr.created_at DESC`,
		policyID,
		tenant,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []PolicyRuleRecord{}
	for rows.Next() {
		var r PolicyRuleRecord
		if err := rows.Scan(&r.ID, &r.PolicyID, &r.Version, &r.Format, &r.Content, &r.Sha256, &r.Entrypoint, &r.CreatedAt); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func ListPolicyAssignments(ctx context.Context, db *sql.DB, policyID uuid.UUID, tenantID *uuid.UUID) ([]PolicyAssignmentRecord, error) {
	var tenant any
	if tenantID != nil {
		tenant = *tenantID
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT pa.id, pa.policy_id, pa.policy_rule_id, pa.scope, pa.scope_id, pa.priority, pa.created_at
		 FROM policy_assignments pa
		 INNER JOIN policies p ON p.id = pa.policy_id
		 WHERE pa.policy_id = $1 AND ($2::uuid IS NULL OR p.tenant_id = $2)
		 ORDER BY pa.priority ASC, pa.created_at DESC`,
		policyID,
		tenant,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assignments := []PolicyAssignmentRecord{}
	for rows.Next() {
		var a PolicyAssignmentRecord
		if err := rows.Scan(&a.ID, &a.PolicyID, &a.PolicyRuleID, &a.Scope, &a.ScopeID, &a.Priority, &a.CreatedAt); err != nil {
			return nil, err
		}
		assignments = append(assignments, a)
	}
	return assignments, rows.Err()
}

func UpdatePolicy(ctx context.Context, db *sql.DB, policyID uuid.UUID, params UpdatePolicyParams) error {
	if params.Name == nil && params.Description == nil && params.Status == nil {
		return errors.New("no fields to update")
	}

	updatedAt := time.Now().UTC()
	_, err := db.ExecContext(
		ctx,
		`UPDATE policies
		 SET name = COALESCE($1, name),
		     description = COALESCE($2, description),
		     status = COALESCE($3, status),
		     updated_at = $4
		 WHERE id = $5`,
		params.Name,
		params.Description,
		params.Status,
		updatedAt,
		policyID,
	)
	return err
}

func CreatePolicyAssignment(ctx context.Context, db *sql.DB, policyID uuid.UUID, policyRuleID *uuid.UUID, scope string, scopeID *uuid.UUID, priority int) (*uuid.UUID, error) {
	row := db.QueryRowContext(
		ctx,
		`INSERT INTO policy_assignments (policy_id, policy_rule_id, scope, scope_id, priority)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		policyID,
		anyUUIDPtr(policyRuleID),
		scope,
		anyUUIDPtr(scopeID),
		priority,
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
