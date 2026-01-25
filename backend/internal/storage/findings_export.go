package storage

import (
	"context"
	"database/sql"
)

// QueryFindingsExport returns a cursor (rows) for exporting findings.
// It intentionally supports larger limits than ListFindings (CSV/JSON export use-case).
//
// Returned columns order MUST match handlers.scanFindingExportRow.
func QueryFindingsExport(ctx context.Context, db *sql.DB, filters FindingFilters) (*sql.Rows, error) {
	if filters.Limit <= 0 {
		filters.Limit = 10000
	}
	if filters.Limit > 20000 {
		filters.Limit = 20000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	sortField := normalizeFindingSortField(filters.SortField)
	sortOrder := normalizeSortOrder(filters.SortOrder)

	args := append(buildFindingFilterArgs(filters), sortField, filters.Limit, filters.Offset)

	var query string
	if sortOrder == "asc" {
		query = `
		SELECT
			f.id::text,
			f.title,
			f.severity,
			f.status,
			f.category,
			f.product_id::text,
			p.name,
			sr.scanner,
			f.source_type,
			f.import_job_id::text,
			pr.decision,
			f.created_at,
			f.updated_at,
			f.first_seen_at,
			f.last_seen_at,
			f.repeat_count,
			f.sla_due_at,
			f.sla_breached,
			f.sla_breached_at,
			fr.risk_score,
			fr.risk_band,
			fr.computed_at,
			fr.model_version,
			intel.cvss_score,
			intel.epss_score,
			intel.kev
		FROM findings f
		LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		LEFT JOIN LATERAL (
			SELECT pr.decision
			FROM policy_results pr
			WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
			ORDER BY pr.evaluated_at DESC
			LIMIT 1
		) pr ON true
		LEFT JOIN LATERAL (
			SELECT
				MAX(vi.cvss_score) AS cvss_score,
				MAX(vi.epss_score) AS epss_score,
				COALESCE(BOOL_OR(vi.kev), FALSE) AS kev
			FROM finding_vuln_identifiers fvi
			LEFT JOIN vuln_intel vi ON vi.identifier = fvi.identifier
			WHERE fvi.finding_id = f.id
		) intel ON true
		WHERE f.deleted_at IS NULL
		  AND ($1::uuid IS NULL OR f.tenant_id = $1)
		  AND ($2::text IS NULL OR f.severity = $2)
		  AND ($3::text IS NULL OR f.status = $3)
		  AND ($4::uuid IS NULL OR f.product_id = $4)
		  AND ($5::uuid IS NULL OR f.import_job_id = $5)
		  AND ($6::uuid IS NULL OR EXISTS (
				SELECT 1 FROM policy_results pr2
				WHERE pr2.subject_type = 'finding' AND pr2.subject_id = f.id AND pr2.policy_id = $6
			))
		  AND ($7::text IS NULL OR (
				SELECT pr2.decision FROM policy_results pr2
				WHERE pr2.subject_type = 'finding' AND pr2.subject_id = f.id
				ORDER BY pr2.evaluated_at DESC
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
		ORDER BY
			CASE WHEN $16 = 'slaDueAt' THEN CASE WHEN f.sla_due_at IS NULL THEN 1 ELSE 0 END END ASC,
			CASE WHEN $16 = 'slaDueAt' THEN f.sla_due_at END ASC NULLS LAST,
			CASE WHEN $16 = 'title' THEN f.title END ASC NULLS LAST,
			CASE WHEN $16 = 'productName' THEN p.name END ASC NULLS LAST,
			CASE WHEN $16 = 'severity' THEN (CASE LOWER(f.severity) WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) END ASC NULLS LAST,
			CASE WHEN $16 = 'status' THEN f.status END ASC NULLS LAST,
			CASE WHEN $16 = 'lastSeenAt' THEN COALESCE(f.last_seen_at, f.created_at) END ASC NULLS LAST,
			CASE WHEN $16 = 'createdAt' THEN f.created_at END ASC NULLS LAST,
			CASE WHEN $16 = 'updatedAt' THEN f.updated_at END ASC NULLS LAST,
			CASE WHEN $16 = 'riskScore' THEN fr.risk_score END ASC NULLS LAST,
			f.id ASC
		LIMIT $17 OFFSET $18`
	} else {
		query = `
		SELECT
			f.id::text,
			f.title,
			f.severity,
			f.status,
			f.category,
			f.product_id::text,
			p.name,
			sr.scanner,
			f.source_type,
			f.import_job_id::text,
			pr.decision,
			f.created_at,
			f.updated_at,
			f.first_seen_at,
			f.last_seen_at,
			f.repeat_count,
			f.sla_due_at,
			f.sla_breached,
			f.sla_breached_at,
			fr.risk_score,
			fr.risk_band,
			fr.computed_at,
			fr.model_version,
			intel.cvss_score,
			intel.epss_score,
			intel.kev
		FROM findings f
		LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		LEFT JOIN LATERAL (
			SELECT pr.decision
			FROM policy_results pr
			WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
			ORDER BY pr.evaluated_at DESC
			LIMIT 1
		) pr ON true
		LEFT JOIN LATERAL (
			SELECT
				MAX(vi.cvss_score) AS cvss_score,
				MAX(vi.epss_score) AS epss_score,
				COALESCE(BOOL_OR(vi.kev), FALSE) AS kev
			FROM finding_vuln_identifiers fvi
			LEFT JOIN vuln_intel vi ON vi.identifier = fvi.identifier
			WHERE fvi.finding_id = f.id
		) intel ON true
		WHERE f.deleted_at IS NULL
		  AND ($1::uuid IS NULL OR f.tenant_id = $1)
		  AND ($2::text IS NULL OR f.severity = $2)
		  AND ($3::text IS NULL OR f.status = $3)
		  AND ($4::uuid IS NULL OR f.product_id = $4)
		  AND ($5::uuid IS NULL OR f.import_job_id = $5)
		  AND ($6::uuid IS NULL OR EXISTS (
				SELECT 1 FROM policy_results pr2
				WHERE pr2.subject_type = 'finding' AND pr2.subject_id = f.id AND pr2.policy_id = $6
			))
		  AND ($7::text IS NULL OR (
				SELECT pr2.decision FROM policy_results pr2
				WHERE pr2.subject_type = 'finding' AND pr2.subject_id = f.id
				ORDER BY pr2.evaluated_at DESC
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
		ORDER BY
			CASE WHEN $16 = 'slaDueAt' THEN CASE WHEN f.sla_due_at IS NULL THEN 1 ELSE 0 END END ASC,
			CASE WHEN $16 = 'slaDueAt' THEN f.sla_due_at END DESC NULLS LAST,
			CASE WHEN $16 = 'title' THEN f.title END DESC NULLS LAST,
			CASE WHEN $16 = 'productName' THEN p.name END DESC NULLS LAST,
			CASE WHEN $16 = 'severity' THEN (CASE LOWER(f.severity) WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) END DESC NULLS LAST,
			CASE WHEN $16 = 'status' THEN f.status END DESC NULLS LAST,
			CASE WHEN $16 = 'lastSeenAt' THEN COALESCE(f.last_seen_at, f.created_at) END DESC NULLS LAST,
			CASE WHEN $16 = 'createdAt' THEN f.created_at END DESC NULLS LAST,
			CASE WHEN $16 = 'updatedAt' THEN f.updated_at END DESC NULLS LAST,
			CASE WHEN $16 = 'riskScore' THEN fr.risk_score END DESC NULLS LAST,
			f.id DESC
		LIMIT $17 OFFSET $18`
	}

	return db.QueryContext(ctx, query, args...)
}
