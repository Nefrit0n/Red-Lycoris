package storage

import (
	"context"
	"database/sql"
	"fmt"
)

// findingExportJoins contains JOIN clauses specific to export queries (includes vuln_intel).
const findingExportJoins = `
FROM findings f
LEFT JOIN finding_risk fr ON fr.finding_id = f.id
LEFT JOIN products p ON p.id = f.product_id
LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
LEFT JOIN (
	SELECT DISTINCT ON (subject_id) subject_id, decision
	FROM policy_results
	WHERE subject_type = 'finding'
	ORDER BY subject_id, evaluated_at DESC
) pr ON pr.subject_id = f.id
LEFT JOIN LATERAL (
	SELECT
		MAX(vi.cvss_score) AS cvss_score,
		MAX(vi.epss_score) AS epss_score,
		COALESCE(BOOL_OR(vi.kev), FALSE) AS kev
	FROM finding_vuln_identifiers fvi
	LEFT JOIN vuln_intel vi ON vi.identifier = fvi.identifier
	WHERE fvi.finding_id = f.id
) intel ON true`

// QueryFindingsExport returns a cursor (rows) for exporting findings.
// It intentionally supports larger limits than ListFindings (CSV/JSON export use-case).
//
// Returned columns order MUST match handlers.scanFindingExportRow.
func QueryFindingsExport(ctx context.Context, db *sql.DB, filters FindingFilters) (*sql.Rows, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required for exporting findings")
	}

	if filters.Limit <= 0 {
		filters.Limit = 10000
	}
	if filters.Limit > 20000 {
		filters.Limit = 20000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	sortField, err := NormalizeFindingSortField(filters.SortField)
	if err != nil {
		return nil, err
	}
	sortOrder := NormalizeFindingSortOrder(filters.SortOrder)
	sortConfig, err := findingSortConfigFor(sortField)
	if err != nil {
		return nil, err
	}

	args := append(buildFindingFilterArgs(filters), filters.Limit, filters.Offset)

	selectFields := `
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
			intel.kev`

	query := fmt.Sprintf(`%s %s WHERE %s %s LIMIT $16 OFFSET $17`,
		selectFields,
		findingExportJoins,
		findingFilterWhereClause,
		findingSortOrderBy(sortConfig, sortOrder))

	return db.QueryContext(ctx, query, args...)
}
