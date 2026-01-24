package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// QueryFindingsExport returns a cursor (rows) for exporting findings.
// It intentionally supports larger limits than ListFindings (CSV/JSON export use-case).
//
// Returned columns order MUST match handlers.scanFindingExportRow.
func QueryFindingsExport(ctx context.Context, db *sql.DB, filters FindingFilters) (*sql.Rows, error) {
	// Safety: enforce a stable, bounded export cursor.
	if filters.Limit <= 0 {
		filters.Limit = 10000
	}
	if filters.Limit > 20000 {
		filters.Limit = 20000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	whereClause, args := buildFindingWhereClause(filters, 0)

	sortField := resolveFindingSortField(filters.SortField)
	sortOrder := "DESC"
	if strings.EqualFold(filters.SortOrder, "asc") {
		sortOrder = "ASC"
	}

	args = append(args, filters.Limit, filters.Offset)
	limitPH := len(args) - 1
	offsetPH := len(args)

	query := fmt.Sprintf(`
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
		%s
		ORDER BY %s %s, f.id %s
		LIMIT $%d OFFSET $%d`,
		whereClause,
		sortField,
		sortOrder,
		sortOrder,
		limitPH,
		offsetPH,
	)

	return db.QueryContext(ctx, query, args...)
}
