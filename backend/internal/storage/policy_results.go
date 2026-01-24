package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
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
}

type PolicyResultsExportFilters struct {
	Decision    string
	PolicyID    *uuid.UUID
	ProductID   *uuid.UUID
	ImportJobID *uuid.UUID
	From        *time.Time
	To          *time.Time
	Limit       int
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

	where := []string{"1=1"}
	args := []interface{}{}

	if filters.Decision != "" {
		args = append(args, filters.Decision)
		where = append(where, fmt.Sprintf("pr.decision = $%d", len(args)))
	}
	if filters.PolicyID != nil {
		args = append(args, *filters.PolicyID)
		where = append(where, fmt.Sprintf("pr.policy_id = $%d", len(args)))
	}
	if filters.From != nil {
		args = append(args, *filters.From)
		where = append(where, fmt.Sprintf("pr.evaluated_at >= $%d", len(args)))
	}
	if filters.To != nil {
		args = append(args, *filters.To)
		where = append(where, fmt.Sprintf("pr.evaluated_at <= $%d", len(args)))
	}
	if filters.ProductID != nil {
		args = append(args, *filters.ProductID)
		where = append(where, fmt.Sprintf(`(
            (pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.product_id = $%d))
            OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.product_id = $%d))
            OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.product_id = $%d))
        )`, len(args), len(args), len(args)))
	}
	if filters.ImportJobID != nil {
		args = append(args, *filters.ImportJobID)
		where = append(where, fmt.Sprintf(`(
            (pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.import_job_id = $%d))
            OR (pr.subject_type = 'import_job' AND pr.subject_id = $%d)
            OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.import_job_id = $%d))
        )`, len(args), len(args), len(args)))
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM policy_results pr " + whereClause
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	listQuery := fmt.Sprintf(`
        SELECT
            pr.id, pr.policy_id, pr.policy_rule_id, pr.subject_type, pr.subject_id,
            pr.decision, pr.violations, pr.input_hash, pr.evaluated_at,
            prule.version
        FROM policy_results pr
        LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
        %s
        ORDER BY pr.evaluated_at DESC
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

func GetPolicyResultByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*PolicyResultDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT
            pr.id, pr.policy_id, pr.policy_rule_id, pr.subject_type, pr.subject_id,
            pr.decision, pr.violations, pr.input_hash, pr.evaluated_at,
            prule.version, p.name, p.kind, prule.format, prule.entrypoint
         FROM policy_results pr
         LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
         LEFT JOIN policies p ON p.id = pr.policy_id
         WHERE pr.id = $1`,
		id,
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

	where := []string{"1=1"}
	args := []interface{}{}

	if filters.Decision != "" {
		args = append(args, filters.Decision)
		where = append(where, fmt.Sprintf("pr.decision = $%d", len(args)))
	}
	if filters.PolicyID != nil {
		args = append(args, *filters.PolicyID)
		where = append(where, fmt.Sprintf("pr.policy_id = $%d", len(args)))
	}
	if filters.From != nil {
		args = append(args, *filters.From)
		where = append(where, fmt.Sprintf("pr.evaluated_at >= $%d", len(args)))
	}
	if filters.To != nil {
		args = append(args, *filters.To)
		where = append(where, fmt.Sprintf("pr.evaluated_at <= $%d", len(args)))
	}
	if filters.ProductID != nil {
		args = append(args, *filters.ProductID)
		where = append(where, fmt.Sprintf(`(
			(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.product_id = $%d))
			OR (pr.subject_type = 'import_job' AND EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = pr.subject_id AND ij.product_id = $%d))
			OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.product_id = $%d))
		)`, len(args), len(args), len(args)))
	}
	if filters.ImportJobID != nil {
		args = append(args, *filters.ImportJobID)
		where = append(where, fmt.Sprintf(`(
			(pr.subject_type = 'finding' AND EXISTS (SELECT 1 FROM findings f WHERE f.id = pr.subject_id AND f.import_job_id = $%d))
			OR (pr.subject_type = 'import_job' AND pr.subject_id = $%d)
			OR (pr.subject_type = 'scan_result' AND EXISTS (SELECT 1 FROM scan_results sr WHERE sr.id = pr.subject_id AND sr.import_job_id = $%d))
		)`, len(args), len(args), len(args)))
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")
	args = append(args, filters.Limit)

	query := fmt.Sprintf(`
		SELECT
			pr.evaluated_at,
			pr.policy_id,
			prule.version,
			pr.subject_type,
			pr.subject_id,
			pr.decision,
			pr.violations
		FROM policy_results pr
		LEFT JOIN policy_rules prule ON prule.id = pr.policy_rule_id
		%s
		ORDER BY pr.evaluated_at DESC
		LIMIT $%d`,
		whereClause,
		len(args),
	)

	return db.QueryContext(ctx, query, args...)
}
