package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

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
