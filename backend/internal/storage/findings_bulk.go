package storage

import (
	"context"
	"database/sql"
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
	args := buildFindingFilterArgs(filters)

	var (
		rows *sql.Rows
		err  error
	)
	if limit > 0 {
		rows, err = db.QueryContext(
			ctx,
			`SELECT f.id, f.status, f.assignee_id, f.duplicate_id
			 FROM findings f
			 LEFT JOIN finding_risk fr ON fr.finding_id = f.id
			 LEFT JOIN products p ON p.id = f.product_id
			 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
			 WHERE f.deleted_at IS NULL
			   AND ($1::uuid IS NULL OR f.tenant_id = $1)
			   AND ($2::text IS NULL OR f.severity = $2)
			   AND ($3::text IS NULL OR f.status = $3)
			   AND ($4::uuid IS NULL OR f.product_id = $4)
			   AND ($5::uuid IS NULL OR f.import_job_id = $5)
			   AND ($6::uuid IS NULL OR EXISTS (
					SELECT 1 FROM policy_results pr
					WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $6
				))
			   AND ($7::text IS NULL OR (
					SELECT pr.decision FROM policy_results pr
					WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
					ORDER BY pr.evaluated_at DESC
					LIMIT 1
				) = $7)
			   AND ($8::text IS NULL OR fr.risk_band = $8)
			   AND ($9::text IS NULL OR (f.title ILIKE $9 OR f.description ILIKE $9 OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9))
			   AND ($10::text IS NULL OR sr.scanner = $10)
			   AND ($11::text IS NULL OR f.source_type = $11)
			   AND ($12::text IS NULL OR (
					($12 = 'NEW' AND f.duplicate_id IS NULL AND f.repeat_count = 0)
					OR ($12 = 'REPEAT' AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL))
				))
			   AND ($13::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $13)
			   AND ($14::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $14)
			   AND ($15::bool = FALSE OR f.duplicate_id IS NULL)
			 ORDER BY f.created_at DESC
			 LIMIT $16`,
			append(args, limit)...,
		)
	} else {
		rows, err = db.QueryContext(
			ctx,
			`SELECT f.id, f.status, f.assignee_id, f.duplicate_id
			 FROM findings f
			 LEFT JOIN finding_risk fr ON fr.finding_id = f.id
			 LEFT JOIN products p ON p.id = f.product_id
			 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
			 WHERE f.deleted_at IS NULL
			   AND ($1::uuid IS NULL OR f.tenant_id = $1)
			   AND ($2::text IS NULL OR f.severity = $2)
			   AND ($3::text IS NULL OR f.status = $3)
			   AND ($4::uuid IS NULL OR f.product_id = $4)
			   AND ($5::uuid IS NULL OR f.import_job_id = $5)
			   AND ($6::uuid IS NULL OR EXISTS (
					SELECT 1 FROM policy_results pr
					WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $6
				))
			   AND ($7::text IS NULL OR (
					SELECT pr.decision FROM policy_results pr
					WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
					ORDER BY pr.evaluated_at DESC
					LIMIT 1
				) = $7)
			   AND ($8::text IS NULL OR fr.risk_band = $8)
			   AND ($9::text IS NULL OR (f.title ILIKE $9 OR f.description ILIKE $9 OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9))
			   AND ($10::text IS NULL OR sr.scanner = $10)
			   AND ($11::text IS NULL OR f.source_type = $11)
			   AND ($12::text IS NULL OR (
					($12 = 'NEW' AND f.duplicate_id IS NULL AND f.repeat_count = 0)
					OR ($12 = 'REPEAT' AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL))
				))
			   AND ($13::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $13)
			   AND ($14::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $14)
			   AND ($15::bool = FALSE OR f.duplicate_id IS NULL)
			 ORDER BY f.created_at DESC`,
			args...,
		)
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
	args := buildFindingFilterArgs(filters)

	var total int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM findings f
		 LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		 LEFT JOIN products p ON p.id = f.product_id
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 WHERE f.deleted_at IS NULL
		   AND ($1::uuid IS NULL OR f.tenant_id = $1)
		   AND ($2::text IS NULL OR f.severity = $2)
		   AND ($3::text IS NULL OR f.status = $3)
		   AND ($4::uuid IS NULL OR f.product_id = $4)
		   AND ($5::uuid IS NULL OR f.import_job_id = $5)
		   AND ($6::uuid IS NULL OR EXISTS (
				SELECT 1 FROM policy_results pr
				WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $6
			))
		   AND ($7::text IS NULL OR (
				SELECT pr.decision FROM policy_results pr
				WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
				ORDER BY pr.evaluated_at DESC
				LIMIT 1
			) = $7)
		   AND ($8::text IS NULL OR fr.risk_band = $8)
		   AND ($9::text IS NULL OR (f.title ILIKE $9 OR f.description ILIKE $9 OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9))
		   AND ($10::text IS NULL OR sr.scanner = $10)
		   AND ($11::text IS NULL OR f.source_type = $11)
		   AND ($12::text IS NULL OR (
				($12 = 'NEW' AND f.duplicate_id IS NULL AND f.repeat_count = 0)
				OR ($12 = 'REPEAT' AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL))
			))
		   AND ($13::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $13)
		   AND ($14::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $14)
		   AND ($15::bool = FALSE OR f.duplicate_id IS NULL)`,
		args...,
	).Scan(&total); err != nil {
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

func BulkUpdateFindingStatusByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, status string) (int64, error) {
	filterArgs := buildFindingFilterArgs(filters)

	args := append([]any{status, time.Now().UTC()}, filterArgs...)

	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET status = $1,
		     updated_at = $2
		 WHERE id IN (
			SELECT f.id
			FROM findings f
			LEFT JOIN finding_risk fr ON fr.finding_id = f.id
			LEFT JOIN products p ON p.id = f.product_id
			LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
			WHERE f.deleted_at IS NULL
			  AND ($3::uuid IS NULL OR f.tenant_id = $3)
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
			  AND ($17::bool = FALSE OR f.duplicate_id IS NULL)
		)`,
		args...,
	)
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
	filterArgs := buildFindingFilterArgs(filters)
	args := append([]any{anyUUIDPtr(assigneeID), time.Now().UTC()}, filterArgs...)

	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET assignee_id = $1,
		     updated_at = $2
		 WHERE id IN (
			SELECT f.id
			FROM findings f
			LEFT JOIN finding_risk fr ON fr.finding_id = f.id
			LEFT JOIN products p ON p.id = f.product_id
			LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
			WHERE f.deleted_at IS NULL
			  AND ($3::uuid IS NULL OR f.tenant_id = $3)
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
			  AND ($17::bool = FALSE OR f.duplicate_id IS NULL)
		)`,
		args...,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
