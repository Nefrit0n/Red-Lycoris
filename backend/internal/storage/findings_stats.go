package storage

import (
	"context"
	"database/sql"
)

type FindingsStats struct {
	BySeverity map[string]int
	ByStatus   map[string]int
	ByScanner  map[string]int
	ByProduct  map[string]int
}

func GetFindingsStats(ctx context.Context, db *sql.DB, filters FindingFilters) (*FindingsStats, error) {
	bySeverity, err := CountFindingsBySeverity(ctx, db, filters)
	if err != nil {
		return nil, err
	}
	byStatus, err := CountFindingsByStatus(ctx, db, filters)
	if err != nil {
		return nil, err
	}
	byScanner, err := CountFindingsByScanner(ctx, db, filters)
	if err != nil {
		return nil, err
	}
	byProduct, err := CountFindingsByProduct(ctx, db, filters)
	if err != nil {
		return nil, err
	}

	return &FindingsStats{
		BySeverity: bySeverity,
		ByStatus:   byStatus,
		ByScanner:  byScanner,
		ByProduct:  byProduct,
	}, nil
}

func CountFindingsBySeverity(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	args := buildFindingFilterArgs(filters)

	rows, err := db.QueryContext(
		ctx,
		`SELECT f.severity, COUNT(*)
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
		 GROUP BY f.severity`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]int)
	for rows.Next() {
		var key sql.NullString
		var count int
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		k := key.String
		if !key.Valid {
			k = ""
		}
		res[k] = count
	}
	return res, rows.Err()
}

func CountFindingsByStatus(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	args := buildFindingFilterArgs(filters)

	rows, err := db.QueryContext(
		ctx,
		`SELECT f.status, COUNT(*)
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
		 GROUP BY f.status`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]int)
	for rows.Next() {
		var key sql.NullString
		var count int
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		k := key.String
		if !key.Valid {
			k = ""
		}
		res[k] = count
	}
	return res, rows.Err()
}

func CountFindingsByScanner(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	args := buildFindingFilterArgs(filters)

	rows, err := db.QueryContext(
		ctx,
		`SELECT sr.scanner, COUNT(*)
		 FROM findings f
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		 LEFT JOIN products p ON p.id = f.product_id
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
		 GROUP BY sr.scanner`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]int)
	for rows.Next() {
		var key sql.NullString
		var count int
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		k := key.String
		if !key.Valid {
			k = ""
		}
		res[k] = count
	}
	return res, rows.Err()
}

func CountFindingsByProduct(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	args := buildFindingFilterArgs(filters)

	rows, err := db.QueryContext(
		ctx,
		`SELECT p.name, COUNT(*)
		 FROM findings f
		 LEFT JOIN products p ON p.id = f.product_id
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 LEFT JOIN finding_risk fr ON fr.finding_id = f.id
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
		 GROUP BY p.name`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]int)
	for rows.Next() {
		var key sql.NullString
		var count int
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		k := key.String
		if !key.Valid {
			k = ""
		}
		res[k] = count
	}
	return res, rows.Err()
}
