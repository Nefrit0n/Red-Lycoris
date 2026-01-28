package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type SbomTransitiveComponentItem struct {
	ID        uuid.UUID
	Purl      sql.NullString
	Name      string
	Version   sql.NullString
	Ecosystem sql.NullString

	MinDepth int

	VulnTotal    int
	VulnCritical int
	VulnHigh     int
	VulnMedium   int
	VulnLow      int

	MaxCvssScore *float64
	MaxEpssScore *float64
	KEV          bool
}

type SbomTransitiveFilters struct {
	SbomID          uuid.UUID
	RootComponentID uuid.UUID
	MaxDepth        int
	Limit           int
	Offset          int
}

func ListSbomTransitiveVulnerableComponents(ctx context.Context, db *sql.DB, filters SbomTransitiveFilters) ([]SbomTransitiveComponentItem, int, error) {
	if filters.SbomID == uuid.Nil {
		return nil, 0, fmt.Errorf("sbom_id is required")
	}
	if filters.RootComponentID == uuid.Nil {
		return nil, 0, fmt.Errorf("root_component_id is required")
	}
	if filters.MaxDepth <= 0 {
		filters.MaxDepth = 25
	}
	if filters.MaxDepth > 100 {
		filters.MaxDepth = 100
	}
	if filters.Limit <= 0 {
		filters.Limit = 50
	}
	if filters.Limit > 1000 {
		filters.Limit = 1000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	args := []any{filters.SbomID, filters.RootComponentID, filters.MaxDepth}

	countQuery := `WITH RECURSIVE walk AS (
		SELECT $2::uuid AS component_id, 0 AS depth, ARRAY[$2::uuid] AS path
		UNION ALL
		SELECT e.to_component_id, w.depth + 1, w.path || e.to_component_id
		FROM sbom_edges e
		JOIN walk w ON w.component_id = e.from_component_id
		WHERE e.sbom_id = $1
			AND w.depth < $3
			AND NOT (e.to_component_id = ANY(w.path))
	), reachable AS (
		SELECT component_id, MIN(depth) AS min_depth
		FROM walk
		GROUP BY component_id
	), vuln AS (
		SELECT sf.component_id,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE f.severity = 'critical') AS critical,
			COUNT(*) FILTER (WHERE f.severity = 'high') AS high,
			COUNT(*) FILTER (WHERE f.severity = 'medium') AS medium,
			COUNT(*) FILTER (WHERE f.severity = 'low') AS low,
			MAX(vi.cvss_score) AS max_cvss,
			MAX(vi.epss_score) AS max_epss,
			COALESCE(BOOL_OR(vi.kev), FALSE) AS kev
		FROM sca_findings sf
		JOIN findings f ON f.id = sf.finding_id
		JOIN sboms s ON s.id = $1 AND f.product_id = s.product_id
		LEFT JOIN vuln_intel vi ON vi.identifier = sf.vulnerability_id AND vi.source_version = 'v1'
		GROUP BY sf.component_id
	)
	SELECT COUNT(*)
	FROM reachable r
	JOIN vuln v ON v.component_id = r.component_id
	WHERE v.total > 0;`

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("sbom transitive count failed: %w", err)
	}

	argsWithLimit := append([]any{}, args...)
	argsWithLimit = append(argsWithLimit, filters.Limit, filters.Offset)

	listQuery := fmt.Sprintf(`WITH RECURSIVE walk AS (
		SELECT $2::uuid AS component_id, 0 AS depth, ARRAY[$2::uuid] AS path
		UNION ALL
		SELECT e.to_component_id, w.depth + 1, w.path || e.to_component_id
		FROM sbom_edges e
		JOIN walk w ON w.component_id = e.from_component_id
		WHERE e.sbom_id = $1
			AND w.depth < $3
			AND NOT (e.to_component_id = ANY(w.path))
	), reachable AS (
		SELECT component_id, MIN(depth) AS min_depth
		FROM walk
		GROUP BY component_id
	), vuln AS (
		SELECT sf.component_id,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE f.severity = 'critical') AS critical,
			COUNT(*) FILTER (WHERE f.severity = 'high') AS high,
			COUNT(*) FILTER (WHERE f.severity = 'medium') AS medium,
			COUNT(*) FILTER (WHERE f.severity = 'low') AS low,
			MAX(vi.cvss_score) AS max_cvss,
			MAX(vi.epss_score) AS max_epss,
			COALESCE(BOOL_OR(vi.kev), FALSE) AS kev
		FROM sca_findings sf
		JOIN findings f ON f.id = sf.finding_id
		JOIN sboms s ON s.id = $1 AND f.product_id = s.product_id
		LEFT JOIN vuln_intel vi ON vi.identifier = sf.vulnerability_id AND vi.source_version = 'v1'
		GROUP BY sf.component_id
	)
	SELECT c.id, c.purl, c.name, NULLIF(sco.version, ''), c.ecosystem,
		r.min_depth,
		v.total, v.critical, v.high, v.medium, v.low,
		v.max_cvss, v.max_epss, v.kev
	FROM reachable r
	JOIN vuln v ON v.component_id = r.component_id
	JOIN sca_components c ON c.id = r.component_id
	LEFT JOIN sbom_component_occurrences sco ON sco.sbom_id = $1 AND sco.component_id = r.component_id
	WHERE v.total > 0
	ORDER BY v.total DESC, r.min_depth ASC, c.name, sco.version
	LIMIT $%d OFFSET $%d`, len(argsWithLimit)-1, len(argsWithLimit))

	rows, err := db.QueryContext(ctx, listQuery, argsWithLimit...)
	if err != nil {
		return nil, 0, fmt.Errorf("sbom transitive query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomTransitiveComponentItem, 0)
	for rows.Next() {
		var it SbomTransitiveComponentItem
		var maxCvss *float64
		var maxEpss *float64

		if err := rows.Scan(
			&it.ID,
			&it.Purl,
			&it.Name,
			&it.Version,
			&it.Ecosystem,
			&it.MinDepth,
			&it.VulnTotal,
			&it.VulnCritical,
			&it.VulnHigh,
			&it.VulnMedium,
			&it.VulnLow,
			&maxCvss,
			&maxEpss,
			&it.KEV,
		); err != nil {
			return nil, 0, fmt.Errorf("sbom transitive scan failed: %w", err)
		}
		it.MaxCvssScore = maxCvss
		it.MaxEpssScore = maxEpss
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("sbom transitive rows error: %w", err)
	}

	return items, total, nil
}

type SbomPathNodeItem struct {
	ID        uuid.UUID
	Purl      sql.NullString
	Name      string
	Version   sql.NullString
	Ecosystem sql.NullString
}

func FindSbomShortestPath(ctx context.Context, db *sql.DB, sbomID uuid.UUID, fromComponentID uuid.UUID, toComponentID uuid.UUID, maxDepth int) ([]SbomPathNodeItem, int, error) {
	if sbomID == uuid.Nil {
		return nil, 0, fmt.Errorf("sbom_id is required")
	}
	if fromComponentID == uuid.Nil || toComponentID == uuid.Nil {
		return nil, 0, fmt.Errorf("from/to component ids are required")
	}
	if maxDepth <= 0 {
		maxDepth = 25
	}
	if maxDepth > 100 {
		maxDepth = 100
	}

	query := `WITH RECURSIVE bfs AS (
		SELECT e.to_component_id AS node,
			ARRAY[$2::uuid, e.to_component_id] AS path,
			1 AS depth
		FROM sbom_edges e
		WHERE e.sbom_id = $1 AND e.from_component_id = $2
		UNION ALL
		SELECT e.to_component_id AS node,
			b.path || e.to_component_id AS path,
			b.depth + 1 AS depth
		FROM sbom_edges e
		JOIN bfs b ON b.node = e.from_component_id
		WHERE e.sbom_id = $1
			AND b.depth < $4
			AND NOT (e.to_component_id = ANY(b.path))
	), best AS (
		SELECT path, depth
		FROM bfs
		WHERE node = $3
		ORDER BY depth ASC
		LIMIT 1
	)
	SELECT b.depth,
		c.id, c.purl, c.name, NULLIF(sco.version, ''), c.ecosystem
	FROM best b
	JOIN LATERAL unnest(b.path) WITH ORDINALITY AS t(component_id, ord) ON true
	JOIN sca_components c ON c.id = t.component_id
	LEFT JOIN sbom_component_occurrences sco ON sco.sbom_id = $1 AND sco.component_id = c.id
	ORDER BY t.ord ASC;`

	rows, err := db.QueryContext(ctx, query, sbomID, fromComponentID, toComponentID, maxDepth)
	if err != nil {
		return nil, 0, fmt.Errorf("sbom path query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomPathNodeItem, 0)
	depth := 0
	for rows.Next() {
		var it SbomPathNodeItem
		var d int
		if err := rows.Scan(
			&d,
			&it.ID,
			&it.Purl,
			&it.Name,
			&it.Version,
			&it.Ecosystem,
		); err != nil {
			return nil, 0, fmt.Errorf("sbom path scan failed: %w", err)
		}
		depth = d
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("sbom path rows error: %w", err)
	}
	if len(items) == 0 {
		return nil, 0, nil
	}

	return items, depth, nil
}
