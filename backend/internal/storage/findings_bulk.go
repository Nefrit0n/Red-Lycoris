package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type FindingSnapshot struct {
	ID          uuid.UUID
	Status      string
	AssigneeID  uuid.NullUUID
	DuplicateID uuid.NullUUID
}

func ListFindingsByIDs(ctx context.Context, db *sql.DB, ids []uuid.UUID) ([]FindingSnapshot, error) {
	if len(ids) == 0 {
		return []FindingSnapshot{}, nil
	}
	rows, err := db.QueryContext(
		ctx,
		`SELECT id, status, assignee_id, duplicate_id
		 FROM findings
		 WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
		pqUUIDArray(ids),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []FindingSnapshot{}
	for rows.Next() {
		var item FindingSnapshot
		if err := rows.Scan(&item.ID, &item.Status, &item.AssigneeID, &item.DuplicateID); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func ListFindingsByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, limit int) ([]FindingSnapshot, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required for listing findings by filters")
	}

	args := buildFindingFilterArgs(filters)

	var queryBase = fmt.Sprintf(`SELECT f.id, f.status, f.assignee_id, f.duplicate_id %s WHERE %s ORDER BY f.created_at DESC`,
		findingBaseJoins,
		findingFilterWhereClause)

	var (
		rows *sql.Rows
		err  error
	)
	if limit > 0 {
		rows, err = db.QueryContext(ctx, queryBase+" LIMIT $16", append(args, limit)...)
	} else {
		rows, err = db.QueryContext(ctx, queryBase, args...)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []FindingSnapshot{}
	for rows.Next() {
		var item FindingSnapshot
		if err := rows.Scan(&item.ID, &item.Status, &item.AssigneeID, &item.DuplicateID); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func CountFindingsByFilters(ctx context.Context, db *sql.DB, filters FindingFilters) (int, error) {
	if filters.TenantID == nil {
		return 0, fmt.Errorf("tenant_id is required for counting findings")
	}

	args := buildFindingFilterArgs(filters)

	query := fmt.Sprintf(`SELECT COUNT(*) %s WHERE %s`, findingBaseJoins, findingFilterWhereClause)

	var total int
	if err := db.QueryRowContext(ctx, query, args...).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func BulkUpdateFindingStatus(ctx context.Context, db *sql.DB, ids []uuid.UUID, status string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET status = $1,
		     updated_at = $2
		 WHERE id = ANY($3::uuid[]) AND deleted_at IS NULL`,
		status,
		time.Now().UTC(),
		pqUUIDArray(ids),
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// findingFilterWhereClauseOffset2 is the same as findingFilterWhereClause but with $3-$17 placeholders
// (offset by 2 for bulk update queries that have $1=value, $2=timestamp).
const findingFilterWhereClauseOffset2 = `
f.deleted_at IS NULL
  AND (f.tenant_id = $3)
  AND ($4::text IS NULL OR f.severity = $4)
  AND ($5::text IS NULL OR f.status = $5)
  AND ($6::uuid IS NULL OR f.product_id = $6)
  AND ($7::uuid IS NULL OR f.import_job_id = $7)
  AND ($8::uuid IS NULL OR EXISTS (
		SELECT 1 FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $8
	))
  AND ($9::text IS NULL OR (
		SELECT pr.decision FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
		ORDER BY pr.evaluated_at DESC
		LIMIT 1
	) = $9)
  AND ($10::text IS NULL OR fr.risk_band = $10)
  AND ($11::text IS NULL OR (f.title ILIKE $11 OR f.description ILIKE $11 OR f.fingerprint ILIKE $11 OR p.identifier ILIKE $11 OR p.name ILIKE $11))
  AND ($12::text IS NULL OR sr.scanner = $12)
  AND ($13::text IS NULL OR f.source_type = $13)
  AND ($14::text IS NULL OR (
		($14 = 'NEW' AND f.duplicate_id IS NULL AND f.repeat_count = 0)
		OR ($14 = 'REPEAT' AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL))
	))
  AND ($15::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $15)
  AND ($16::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $16)
  AND ($17::bool = FALSE OR f.duplicate_id IS NULL)`

func BulkUpdateFindingStatusByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, status string) (int64, error) {
	if filters.TenantID == nil {
		return 0, fmt.Errorf("tenant_id is required for bulk update")
	}

	filterArgs := buildFindingFilterArgs(filters)
	args := append([]any{status, time.Now().UTC()}, filterArgs...)

	query := fmt.Sprintf(`UPDATE findings
		 SET status = $1,
		     updated_at = $2
		 WHERE id IN (
			SELECT f.id %s WHERE %s
		)`, findingBaseJoins, findingFilterWhereClauseOffset2)

	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func BulkUpdateFindingAssignee(ctx context.Context, db *sql.DB, ids []uuid.UUID, assigneeID *uuid.UUID) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET assignee_id = $1,
		     updated_at = $2
		 WHERE id = ANY($3::uuid[]) AND deleted_at IS NULL`,
		anyUUIDPtr(assigneeID),
		time.Now().UTC(),
		pqUUIDArray(ids),
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func BulkUpdateFindingAssigneeByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, assigneeID *uuid.UUID) (int64, error) {
	if filters.TenantID == nil {
		return 0, fmt.Errorf("tenant_id is required for bulk update")
	}

	filterArgs := buildFindingFilterArgs(filters)
	args := append([]any{anyUUIDPtr(assigneeID), time.Now().UTC()}, filterArgs...)

	query := fmt.Sprintf(`UPDATE findings
		 SET assignee_id = $1,
		     updated_at = $2
		 WHERE id IN (
			SELECT f.id %s WHERE %s
		)`, findingBaseJoins, findingFilterWhereClauseOffset2)

	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
