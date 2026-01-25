package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type SbomComponentFilters struct {
	SbomID     uuid.UUID
	DirectOnly *bool
	Ecosystem  string
	License    string
	Query      string
	Limit      int
	Offset     int
}

type SbomComponentItem struct {
	ID        uuid.UUID
	Purl      sql.NullString
	Name      string
	Version   sql.NullString
	Ecosystem sql.NullString
	Supplier  sql.NullString
	Licenses  json.RawMessage
	Direct    bool

	VulnTotal    int
	VulnCritical int
	VulnHigh     int
	VulnMedium   int
	VulnLow      int
}

func ListSbomComponents(ctx context.Context, db *sql.DB, filters SbomComponentFilters) ([]SbomComponentItem, int, error) {
	if filters.Limit <= 0 {
		filters.Limit = 100
	}
	if filters.Limit > 1000 {
		filters.Limit = 1000
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	where, args := buildSbomComponentFilters(filters)

	countQuery := fmt.Sprintf(`SELECT COUNT(*)
		FROM sbom_component_occurrences sco
		JOIN sca_components c ON c.id = sco.component_id
		WHERE %s`, where)

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("sbom components count failed: %w", err)
	}

	argsWithLimit := append([]any{}, args...)
	argsWithLimit = append(argsWithLimit, filters.Limit, filters.Offset)

	listQuery := fmt.Sprintf(`WITH vuln AS (
		SELECT sco.component_id,
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE f.severity = 'critical') AS critical,
			COUNT(*) FILTER (WHERE f.severity = 'high') AS high,
			COUNT(*) FILTER (WHERE f.severity = 'medium') AS medium,
			COUNT(*) FILTER (WHERE f.severity = 'low') AS low
		FROM sbom_component_occurrences sco
		JOIN sboms s ON s.id = sco.sbom_id
		JOIN sca_findings sf ON sf.component_id = sco.component_id
		JOIN findings f ON f.id = sf.finding_id AND f.product_id = s.product_id
		WHERE sco.sbom_id = $1
		GROUP BY sco.component_id
	)
	SELECT c.id, c.purl, c.name, NULLIF(sco.version, ''), c.ecosystem, sco.supplier, sco.licenses, sco.direct,
		COALESCE(v.total, 0), COALESCE(v.critical, 0), COALESCE(v.high, 0), COALESCE(v.medium, 0), COALESCE(v.low, 0)
	FROM sbom_component_occurrences sco
	JOIN sca_components c ON c.id = sco.component_id
	LEFT JOIN vuln v ON v.component_id = sco.component_id
	WHERE %s
	ORDER BY COALESCE(v.total, 0) DESC, c.name, sco.version
	LIMIT $%d OFFSET $%d`, where, len(argsWithLimit)-1, len(argsWithLimit))

	rows, err := db.QueryContext(ctx, listQuery, argsWithLimit...)
	if err != nil {
		return nil, 0, fmt.Errorf("sbom components query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomComponentItem, 0)
	for rows.Next() {
		var item SbomComponentItem
		var licenses []byte
		if err := rows.Scan(
			&item.ID,
			&item.Purl,
			&item.Name,
			&item.Version,
			&item.Ecosystem,
			&item.Supplier,
			&licenses,
			&item.Direct,
			&item.VulnTotal,
			&item.VulnCritical,
			&item.VulnHigh,
			&item.VulnMedium,
			&item.VulnLow,
		); err != nil {
			return nil, 0, fmt.Errorf("sbom components scan failed: %w", err)
		}
		if licenses != nil {
			item.Licenses = json.RawMessage(licenses)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("sbom components rows error: %w", err)
	}

	return items, total, nil
}

func buildSbomComponentFilters(filters SbomComponentFilters) (string, []any) {
	clauses := []string{"sco.sbom_id = $1"}
	args := []any{filters.SbomID}

	if filters.DirectOnly != nil && *filters.DirectOnly {
		clauses = append(clauses, fmt.Sprintf("sco.direct = $%d", len(args)+1))
		args = append(args, true)
	}
	if value := strings.TrimSpace(filters.Ecosystem); value != "" {
		clauses = append(clauses, fmt.Sprintf("c.ecosystem = $%d", len(args)+1))
		args = append(args, value)
	}
	if value := strings.TrimSpace(filters.Query); value != "" {
		clauses = append(clauses, fmt.Sprintf("(c.name ILIKE $%d OR c.purl ILIKE $%d)", len(args)+1, len(args)+1))
		args = append(args, "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.License); value != "" {
		clauses = append(clauses, fmt.Sprintf("EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(sco.licenses, '[]'::jsonb)) AS lic WHERE lic ILIKE $%d)", len(args)+1))
		args = append(args, "%"+value+"%")
	}

	return strings.Join(clauses, " AND "), args
}
