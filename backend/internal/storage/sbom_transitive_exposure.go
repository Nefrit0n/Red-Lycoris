package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type SbomOsvComponent struct {
	ComponentID uuid.UUID
	Purl        string
	Version     string
}

func ListSbomOsvComponents(ctx context.Context, db *sql.DB, sbomID uuid.UUID) ([]SbomOsvComponent, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT DISTINCT sco.component_id, c.purl, sco.version
		 FROM sbom_component_occurrences sco
		 JOIN sca_components c ON c.id = sco.component_id
		 WHERE sco.sbom_id = $1
		   AND c.purl IS NOT NULL
		   AND NULLIF(sco.version, '') IS NOT NULL`,
		sbomID,
	)
	if err != nil {
		return nil, fmt.Errorf("list sbom osv components query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomOsvComponent, 0)
	for rows.Next() {
		var it SbomOsvComponent
		if err := rows.Scan(&it.ComponentID, &it.Purl, &it.Version); err != nil {
			return nil, fmt.Errorf("list sbom osv components scan failed: %w", err)
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list sbom osv components rows error: %w", err)
	}
	return items, nil
}

type SbomComponentVulnRecord struct {
	ComponentID  uuid.UUID
	Identifier   string
	Severity     string
	CvssScore    *float64
	EpssScore    *float64
	FixedVersion *string
	Source       string
}

func ReplaceSbomComponentVulns(ctx context.Context, db *sql.DB, sbomID uuid.UUID, records []SbomComponentVulnRecord) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `DELETE FROM sbom_component_vulns WHERE sbom_id = $1`, sbomID); err != nil {
		return fmt.Errorf("delete sbom component vulns failed: %w", err)
	}

	if len(records) > 0 {
		stmt, err := tx.PrepareContext(ctx, `INSERT INTO sbom_component_vulns
			(sbom_id, component_id, identifier, severity, cvss_score, epss_score, fixed_version, source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (sbom_id, component_id, identifier)
			DO UPDATE SET
				severity = EXCLUDED.severity,
				cvss_score = EXCLUDED.cvss_score,
				epss_score = EXCLUDED.epss_score,
				fixed_version = EXCLUDED.fixed_version,
				source = EXCLUDED.source`,
		)
		if err != nil {
			return fmt.Errorf("prepare sbom component vulns failed: %w", err)
		}
		defer stmt.Close()

		for _, record := range records {
			if _, err := stmt.ExecContext(
				ctx,
				sbomID,
				record.ComponentID,
				record.Identifier,
				record.Severity,
				nullFloatPtr(record.CvssScore),
				nullFloatPtr(record.EpssScore),
				anyStringPtr(record.FixedVersion),
				record.Source,
			); err != nil {
				return fmt.Errorf("insert sbom component vulns failed: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

type SbomTransitiveExposureItem struct {
	ComponentID          uuid.UUID
	Purl                 sql.NullString
	Name                 string
	Version              sql.NullString
	Ecosystem            sql.NullString
	CriticalCount        int
	HighCount            int
	MediumCount          int
	LowCount             int
	MaxCvss              *float64
	MaxEpss              *float64
	MinDistanceToAnyVuln sql.NullInt64
}

type SbomTransitiveExposureFilters struct {
	SbomID   uuid.UUID
	MaxDepth int
	Query    string
	Limit    int
	Offset   int
}

func ListSbomTransitiveExposure(ctx context.Context, db *sql.DB, filters SbomTransitiveExposureFilters) ([]SbomTransitiveExposureItem, int, error) {
	if filters.SbomID == uuid.Nil {
		return nil, 0, fmt.Errorf("sbom_id is required")
	}
	if filters.MaxDepth <= 0 {
		filters.MaxDepth = 25
	}
	if filters.MaxDepth > 100 {
		filters.MaxDepth = 100
	}
	if filters.Limit <= 0 {
		filters.Limit = 200
	}
	if filters.Limit > 1000 {
		filters.Limit = 1000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	pattern := strings.TrimSpace(filters.Query)
	if pattern != "" {
		pattern = "%" + pattern + "%"
	}

	countQuery := `SELECT COUNT(*)
		FROM sbom_transitive_exposure ste
		JOIN sca_components c ON c.id = ste.root_component_id
		LEFT JOIN sbom_component_occurrences sco
			ON sco.sbom_id = ste.sbom_id AND sco.component_id = ste.root_component_id
		WHERE ste.sbom_id = $1
			AND ste.max_depth = $2
			AND (ste.critical_cnt + ste.high_cnt + ste.medium_cnt + ste.low_cnt > 0 OR ste.max_cvss IS NOT NULL)
			AND ($3 = '' OR c.name ILIKE $3 OR c.purl ILIKE $3 OR sco.version ILIKE $3)`

	var total int
	if err := db.QueryRowContext(ctx, countQuery, filters.SbomID, filters.MaxDepth, pattern).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("sbom transitive exposure count failed: %w", err)
	}

	listQuery := `SELECT c.id, c.purl, c.name, NULLIF(sco.version, ''), c.ecosystem,
		ste.critical_cnt, ste.high_cnt, ste.medium_cnt, ste.low_cnt,
		ste.max_cvss, ste.max_epss, ste.min_distance_to_any_vuln
		FROM sbom_transitive_exposure ste
		JOIN sca_components c ON c.id = ste.root_component_id
		LEFT JOIN sbom_component_occurrences sco
			ON sco.sbom_id = ste.sbom_id AND sco.component_id = ste.root_component_id
		WHERE ste.sbom_id = $1
			AND ste.max_depth = $2
			AND (ste.critical_cnt + ste.high_cnt + ste.medium_cnt + ste.low_cnt > 0 OR ste.max_cvss IS NOT NULL)
			AND ($3 = '' OR c.name ILIKE $3 OR c.purl ILIKE $3 OR sco.version ILIKE $3)
		ORDER BY ste.max_cvss DESC NULLS LAST, (ste.critical_cnt + ste.high_cnt + ste.medium_cnt + ste.low_cnt) DESC, c.name
		LIMIT $4 OFFSET $5`

	rows, err := db.QueryContext(ctx, listQuery, filters.SbomID, filters.MaxDepth, pattern, filters.Limit, filters.Offset)
	if err != nil {
		return nil, 0, fmt.Errorf("sbom transitive exposure query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomTransitiveExposureItem, 0)
	for rows.Next() {
		var it SbomTransitiveExposureItem
		var maxCvss *float64
		var maxEpss *float64
		if err := rows.Scan(
			&it.ComponentID,
			&it.Purl,
			&it.Name,
			&it.Version,
			&it.Ecosystem,
			&it.CriticalCount,
			&it.HighCount,
			&it.MediumCount,
			&it.LowCount,
			&maxCvss,
			&maxEpss,
			&it.MinDistanceToAnyVuln,
		); err != nil {
			return nil, 0, fmt.Errorf("sbom transitive exposure scan failed: %w", err)
		}
		it.MaxCvss = maxCvss
		it.MaxEpss = maxEpss
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("sbom transitive exposure rows error: %w", err)
	}

	return items, total, nil
}

func RefreshSbomTransitiveExposure(ctx context.Context, db *sql.DB, sbomID uuid.UUID, maxDepth int) error {
	if sbomID == uuid.Nil {
		return fmt.Errorf("sbom_id is required")
	}
	if maxDepth <= 0 {
		maxDepth = 25
	}
	if maxDepth > 100 {
		maxDepth = 100
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `DELETE FROM sbom_transitive_exposure WHERE sbom_id = $1 AND max_depth = $2`, sbomID, maxDepth); err != nil {
		return fmt.Errorf("delete sbom transitive exposure failed: %w", err)
	}

	query := `WITH RECURSIVE direct_components AS (
		SELECT 1
		FROM sbom_component_occurrences
		WHERE sbom_id = $1
			AND direct = true
		LIMIT 1
	), walk AS (
		SELECT sco.component_id AS root_component_id,
			sco.component_id AS component_id,
			0 AS depth,
			ARRAY[sco.component_id] AS path
		FROM sbom_component_occurrences sco
		WHERE sco.sbom_id = $1
			AND (sco.direct = true OR NOT EXISTS (SELECT 1 FROM direct_components))
		UNION ALL
		SELECT w.root_component_id,
			e.to_component_id,
			w.depth + 1,
			w.path || e.to_component_id
		FROM walk w
		JOIN sbom_edges e ON e.sbom_id = $1 AND e.from_component_id = w.component_id
		WHERE w.depth < $2
			AND NOT (e.to_component_id = ANY(w.path))
	), reachable AS (
		SELECT root_component_id, component_id, MIN(depth) AS min_depth
		FROM walk
		GROUP BY root_component_id, component_id
	), distinct_vulns AS (
		SELECT DISTINCT r.root_component_id, r.component_id, r.min_depth,
			v.identifier, v.severity, v.cvss_score, v.epss_score
		FROM reachable r
		JOIN sbom_component_vulns v
			ON v.sbom_id = $1 AND v.component_id = r.component_id
	), agg AS (
		SELECT root_component_id,
			COUNT(*) FILTER (WHERE severity = 'critical') AS critical_cnt,
			COUNT(*) FILTER (WHERE severity = 'high') AS high_cnt,
			COUNT(*) FILTER (WHERE severity = 'medium') AS medium_cnt,
			COUNT(*) FILTER (WHERE severity = 'low') AS low_cnt,
			MAX(cvss_score) AS max_cvss,
			MAX(epss_score) AS max_epss,
			MIN(min_depth) AS min_distance
		FROM distinct_vulns
		GROUP BY root_component_id
	)
	INSERT INTO sbom_transitive_exposure
		(sbom_id, root_component_id, max_depth, critical_cnt, high_cnt, medium_cnt, low_cnt, max_cvss, max_epss, min_distance_to_any_vuln, updated_at)
	SELECT $1, root_component_id, $2, critical_cnt, high_cnt, medium_cnt, low_cnt, max_cvss, max_epss, min_distance, NOW()
	FROM agg
	ON CONFLICT (sbom_id, root_component_id, max_depth)
	DO UPDATE SET
		critical_cnt = EXCLUDED.critical_cnt,
		high_cnt = EXCLUDED.high_cnt,
		medium_cnt = EXCLUDED.medium_cnt,
		low_cnt = EXCLUDED.low_cnt,
		max_cvss = EXCLUDED.max_cvss,
		max_epss = EXCLUDED.max_epss,
		min_distance_to_any_vuln = EXCLUDED.min_distance_to_any_vuln,
		updated_at = NOW()`

	if _, err = tx.ExecContext(ctx, query, sbomID, maxDepth); err != nil {
		return fmt.Errorf("compute sbom transitive exposure failed: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}
