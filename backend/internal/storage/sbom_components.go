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
		FROM sbom_components sc
		JOIN components c ON c.id = sc.component_id
		WHERE %s`, where)

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("sbom components count failed: %w", err)
	}

	argsWithLimit := append([]any{}, args...)
	argsWithLimit = append(argsWithLimit, filters.Limit, filters.Offset)

	listQuery := fmt.Sprintf(`SELECT c.id, c.purl, c.name, c.version, c.ecosystem, c.supplier, c.licenses, sc.direct
		FROM sbom_components sc
		JOIN components c ON c.id = sc.component_id
		WHERE %s
		ORDER BY c.name, c.version
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
	clauses := []string{"sc.sbom_id = $1"}
	args := []any{filters.SbomID}

	if filters.DirectOnly != nil && *filters.DirectOnly {
		clauses = append(clauses, fmt.Sprintf("sc.direct = $%d", len(args)+1))
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
		clauses = append(clauses, fmt.Sprintf("EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.licenses, '[]'::jsonb)) AS lic WHERE lic ILIKE $%d)", len(args)+1))
		args = append(args, "%"+value+"%")
	}

	return strings.Join(clauses, " AND "), args
}
