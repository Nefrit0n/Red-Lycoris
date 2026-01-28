package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type SbomDiffKind string

const (
	SbomDiffAll       SbomDiffKind = "all"
	SbomDiffAdded     SbomDiffKind = "added"
	SbomDiffRemoved   SbomDiffKind = "removed"
	SbomDiffChanged   SbomDiffKind = "changed"
	SbomDiffUnchanged SbomDiffKind = "unchanged"
)

type SbomDiffFilters struct {
	FromSbomID uuid.UUID
	ToSbomID   uuid.UUID
	Kind       SbomDiffKind
	Limit      int
	Offset     int
}

type SbomDiffSummary struct {
	Added     int `json:"added"`
	Removed   int `json:"removed"`
	Changed   int `json:"changed"`
	Unchanged int `json:"unchanged"`
}

type SbomDiffItem struct {
	ComponentID uuid.UUID
	Purl        sql.NullString
	Name        string
	Ecosystem   sql.NullString

	Kind       string
	OldVersion []string
	NewVersion []string
	OldDirect  bool
	NewDirect  bool
}

func normalizeSbomDiffKind(kind SbomDiffKind) SbomDiffKind {
	s := strings.ToLower(strings.TrimSpace(string(kind)))
	switch SbomDiffKind(s) {
	case SbomDiffAll, SbomDiffAdded, SbomDiffRemoved, SbomDiffChanged, SbomDiffUnchanged:
		return SbomDiffKind(s)
	default:
		return SbomDiffChanged
	}
}

// DiffSbomComponents returns component-level diff between two indexed SBOMs.
// It compares the set of components and their versions (and direct flag).
func DiffSbomComponents(ctx context.Context, db *sql.DB, filters SbomDiffFilters) ([]SbomDiffItem, int, SbomDiffSummary, error) {
	filters.Kind = normalizeSbomDiffKind(filters.Kind)
	if filters.Limit <= 0 {
		filters.Limit = 100
	}
	if filters.Limit > 1000 {
		filters.Limit = 1000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	cte := `WITH old AS (
		SELECT component_id,
			COALESCE(
				array_agg(DISTINCT NULLIF(version, '') ORDER BY NULLIF(version, ''))
					FILTER (WHERE NULLIF(version, '') IS NOT NULL),
				ARRAY[]::text[]
			) AS versions,
			bool_or(direct) AS direct
		FROM sbom_component_occurrences
		WHERE sbom_id = $1
		GROUP BY component_id
	),
	new AS (
		SELECT component_id,
			COALESCE(
				array_agg(DISTINCT NULLIF(version, '') ORDER BY NULLIF(version, ''))
					FILTER (WHERE NULLIF(version, '') IS NOT NULL),
				ARRAY[]::text[]
			) AS versions,
			bool_or(direct) AS direct
		FROM sbom_component_occurrences
		WHERE sbom_id = $2
		GROUP BY component_id
	),
	merged AS (
		SELECT
			COALESCE(o.component_id, n.component_id) AS component_id,
			COALESCE(o.versions, ARRAY[]::text[]) AS old_versions,
			COALESCE(n.versions, ARRAY[]::text[]) AS new_versions,
			COALESCE(o.direct, false) AS old_direct,
			COALESCE(n.direct, false) AS new_direct,
			CASE
				WHEN o.component_id IS NULL THEN 'added'
				WHEN n.component_id IS NULL THEN 'removed'
				WHEN o.versions IS DISTINCT FROM n.versions OR o.direct IS DISTINCT FROM n.direct THEN 'changed'
				ELSE 'unchanged'
			END AS kind
		FROM old o
		FULL JOIN new n ON n.component_id = o.component_id
	)
`

	// 1) Summary
	var summary SbomDiffSummary
	summaryQuery := cte + `SELECT
		COUNT(*) FILTER (WHERE kind = 'added') AS added,
		COUNT(*) FILTER (WHERE kind = 'removed') AS removed,
		COUNT(*) FILTER (WHERE kind = 'changed') AS changed,
		COUNT(*) FILTER (WHERE kind = 'unchanged') AS unchanged
	FROM merged`
	if err := db.QueryRowContext(ctx, summaryQuery, filters.FromSbomID, filters.ToSbomID).Scan(
		&summary.Added,
		&summary.Removed,
		&summary.Changed,
		&summary.Unchanged,
	); err != nil {
		return nil, 0, SbomDiffSummary{}, fmt.Errorf("sbom diff summary failed: %w", err)
	}

	// 2) Total for selected kind
	args := []any{filters.FromSbomID, filters.ToSbomID}
	where := "TRUE"
	if filters.Kind != SbomDiffAll {
		where = fmt.Sprintf("kind = $%d", len(args)+1)
		args = append(args, string(filters.Kind))
	}
	countQuery := cte + fmt.Sprintf(`SELECT COUNT(*) FROM merged WHERE %s`, where)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, SbomDiffSummary{}, fmt.Errorf("sbom diff count failed: %w", err)
	}

	// 3) List items
	args = append(args, filters.Limit, filters.Offset)
	limitPos := len(args) - 1
	offsetPos := len(args)

	listQuery := cte + fmt.Sprintf(`SELECT
		c.id,
		c.purl,
		c.name,
		c.ecosystem,
		m.kind,
		m.old_versions,
		m.new_versions,
		m.old_direct,
		m.new_direct
	FROM merged m
	JOIN sca_components c ON c.id = m.component_id
	WHERE %s
	ORDER BY
		CASE m.kind
			WHEN 'changed' THEN 0
			WHEN 'added' THEN 1
			WHEN 'removed' THEN 2
			WHEN 'unchanged' THEN 3
			ELSE 4
		END,
		c.name,
		COALESCE(c.purl, '')
	LIMIT $%d OFFSET $%d`, where, limitPos, offsetPos)

	rows, err := db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, SbomDiffSummary{}, fmt.Errorf("sbom diff query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomDiffItem, 0)
	for rows.Next() {
		var it SbomDiffItem
		var oldV []string
		var newV []string
		if err := rows.Scan(
			&it.ComponentID,
			&it.Purl,
			&it.Name,
			&it.Ecosystem,
			&it.Kind,
			pq.Array(&oldV),
			pq.Array(&newV),
			&it.OldDirect,
			&it.NewDirect,
		); err != nil {
			return nil, 0, SbomDiffSummary{}, fmt.Errorf("sbom diff scan failed: %w", err)
		}
		it.OldVersion = oldV
		it.NewVersion = newV
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, SbomDiffSummary{}, fmt.Errorf("sbom diff rows error: %w", err)
	}

	return items, total, summary, nil
}
