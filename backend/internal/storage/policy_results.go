package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type PolicyResultItem struct {
	ID            uuid.UUID
	PolicyID      uuid.UUID
	PolicyRuleID  uuid.NullUUID
	SubjectType   string
	SubjectID     uuid.UUID
	Decision      string
	Violations    []byte
	InputHash     string
	EvaluatedAt   time.Time
	PolicyVersion sql.NullString
}

type PolicyResultDetail struct {
	PolicyResultItem
	PolicyName     sql.NullString
	PolicyKind     sql.NullString
	RuleFormat     sql.NullString
	RuleEntrypoint sql.NullString
}

type PolicyResultFilters struct {
	Limit       int
	Offset      int
	Decision    string
	PolicyID    *uuid.UUID
	ProductID   *uuid.UUID
	ImportJobID *uuid.UUID
	From        *time.Time
	To          *time.Time
	TenantID    *uuid.UUID
}

type PolicyResultsExportFilters struct {
	Decision    string
	PolicyID    *uuid.UUID
	ProductID   *uuid.UUID
	ImportJobID *uuid.UUID
	From        *time.Time
	To          *time.Time
	Limit       int
	TenantID    *uuid.UUID
}

func ListPolicyResults(ctx context.Context, db *sql.DB, filters PolicyResultFilters) ([]PolicyResultItem, int, error) {
	if filters.Limit <= 0 {
		filters.Limit = 50
	}
	if filters.Limit > 200 {
		filters.Limit = 200
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	decision := nilIfEmpty(filters.Decision)

	var policyID any
	if filters.PolicyID != nil {
		policyID = *filters.PolicyID
	}

	var from any
	if filters.From != nil {
		from = *filters.From
	}

	var to any
	if filters.To != nil {
		to = *filters.To
	}

	var productID any
	if filters.ProductID != nil {
		productID = *filters.ProductID
	}

	var importJobID any
	if filters.ImportJobID != nil {
		importJobID = *filters.ImportJobID
	}

	var tenantID any
	if filters.TenantID != nil {
		tenantID = *filters.TenantID
	}

	// COUNT
	var total int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM policy_results pr
		 WHERE ($1::text IS NULL OR pr.decision = $1)
		   AND ($2::uuid IS NULL OR pr.policy_id = $2)
		   AND ($3::timestamptz IS NULL OR pr.evaluated_at >= $3)
		   AND ($4::timestamptz IS NULL OR pr.evaluated_at <= $4)
		   AND ($5::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.product_id = $5))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.product_id = $5))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.product_id = $5))
			))
		   AND ($6::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.import_job_id = $6))
				OR (pr.subject_type = 'import_job' AND pr.subject_id = $6)
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.import_job_id = $6))
			))
		   AND ($7::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.tenant_id = $7))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.tenant_id = $7))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.tenant_id = $7))
			))`,
		decision,
		policyID,
		from,
		to,
		productID,
		importJobID,
		tenantID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT
			pr.id, pr.policy_id, pr.policy_rule_id, pr.subject_type, pr.subject_id,
			pr.decision, pr.violations, pr.input_hash, pr.evaluated_at,
			prule.version
		 FROM policy_results pr
		 LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
		 WHERE ($1::text IS NULL OR pr.decision = $1)
		   AND ($2::uuid IS NULL OR pr.policy_id = $2)
		   AND ($3::timestamptz IS NULL OR pr.evaluated_at >= $3)
		   AND ($4::timestamptz IS NULL OR pr.evaluated_at <= $4)
		   AND ($5::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.product_id = $5))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.product_id = $5))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.product_id = $5))
			))
		   AND ($6::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.import_job_id = $6))
				OR (pr.subject_type = 'import_job' AND pr.subject_id = $6)
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.import_job_id = $6))
			))
		   AND ($7::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.tenant_id = $7))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.tenant_id = $7))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.tenant_id = $7))
			))
		 ORDER BY pr.evaluated_at DESC
		 LIMIT $8 OFFSET $9`,
		decision,
		policyID,
		from,
		to,
		productID,
		importJobID,
		tenantID,
		filters.Limit,
		filters.Offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []PolicyResultItem{}
	for rows.Next() {
		var item PolicyResultItem
		if err := rows.Scan(
			&item.ID,
			&item.PolicyID,
			&item.PolicyRuleID,
			&item.SubjectType,
			&item.SubjectID,
			&item.Decision,
			&item.Violations,
			&item.InputHash,
			&item.EvaluatedAt,
			&item.PolicyVersion,
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

func GetPolicyResultByID(ctx context.Context, db *sql.DB, id uuid.UUID, tenantID *uuid.UUID) (*PolicyResultDetail, error) {
	var tenant any
	if tenantID != nil {
		tenant = *tenantID
	}

	row := db.QueryRowContext(
		ctx,
		`SELECT
			pr.id, pr.policy_id, pr.policy_rule_id, pr.subject_type, pr.subject_id,
			pr.decision, pr.violations, pr.input_hash, pr.evaluated_at,
			prule.version, p.name, p.kind, prule.format, prule.entrypoint
		 FROM policy_results pr
		 LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
		 LEFT JOIN policies p ON p.id = pr.policy_id
		 WHERE pr.id = $1
		   AND ($2::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.tenant_id = $2))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.tenant_id = $2))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.tenant_id = $2))
			))`,
		id,
		tenant,
	)

	var detail PolicyResultDetail
	if err := row.Scan(
		&detail.ID,
		&detail.PolicyID,
		&detail.PolicyRuleID,
		&detail.SubjectType,
		&detail.SubjectID,
		&detail.Decision,
		&detail.Violations,
		&detail.InputHash,
		&detail.EvaluatedAt,
		&detail.PolicyVersion,
		&detail.PolicyName,
		&detail.PolicyKind,
		&detail.RuleFormat,
		&detail.RuleEntrypoint,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &detail, nil
}

func QueryPolicyResultsExport(ctx context.Context, db *sql.DB, filters PolicyResultsExportFilters) (*sql.Rows, error) {
	if filters.Limit <= 0 {
		filters.Limit = 5000
	}

	decision := nilIfEmpty(filters.Decision)

	var policyID any
	if filters.PolicyID != nil {
		policyID = *filters.PolicyID
	}

	var from any
	if filters.From != nil {
		from = *filters.From
	}

	var to any
	if filters.To != nil {
		to = *filters.To
	}

	var productID any
	if filters.ProductID != nil {
		productID = *filters.ProductID
	}

	var importJobID any
	if filters.ImportJobID != nil {
		importJobID = *filters.ImportJobID
	}

	var tenantID any
	if filters.TenantID != nil {
		tenantID = *filters.TenantID
	}

	return db.QueryContext(
		ctx,
		`SELECT
			pr.evaluated_at,
			pr.policy_id,
			prule.version,
			pr.subject_type,
			pr.subject_id,
			pr.decision,
			pr.violations
		 FROM policy_results pr
		 LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
		 WHERE ($1::text IS NULL OR pr.decision = $1)
		   AND ($2::uuid IS NULL OR pr.policy_id = $2)
		   AND ($3::timestamptz IS NULL OR pr.evaluated_at >= $3)
		   AND ($4::timestamptz IS NULL OR pr.evaluated_at <= $4)
		   AND ($5::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.product_id = $5))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.product_id = $5))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.product_id = $5))
			))
		   AND ($6::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.import_job_id = $6))
				OR (pr.subject_type = 'import_job' AND pr.subject_id = $6)
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.import_job_id = $6))
			))
		   AND ($7::uuid IS NULL OR (
				(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.tenant_id = $7))
				OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.tenant_id = $7))
				OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.tenant_id = $7))
			))
		 ORDER BY pr.evaluated_at DESC
		 LIMIT $8`,
		decision,
		policyID,
		from,
		to,
		productID,
		importJobID,
		tenantID,
		filters.Limit,
	)
}
