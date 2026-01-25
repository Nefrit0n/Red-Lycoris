package storage

import (
	"context"
	"database/sql"
	"fmt"
)

type FindingsStats struct {
	BySeverity map[string]int
	ByStatus   map[string]int
	ByScanner  map[string]int
	ByProduct  map[string]int
}

func GetFindingsStats(ctx context.Context, db *sql.DB, filters FindingFilters) (*FindingsStats, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required for findings stats")
	}

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

// scanGroupedCounts is a helper to scan GROUP BY query results into a map.
func scanGroupedCounts(rows *sql.Rows) (map[string]int, error) {
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

func CountFindingsBySeverity(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	args := buildFindingFilterArgs(filters)
	query := fmt.Sprintf(`SELECT f.severity, COUNT(*) %s WHERE %s GROUP BY f.severity`,
		findingBaseJoins, findingFilterWhereClause)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return scanGroupedCounts(rows)
}

func CountFindingsByStatus(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	args := buildFindingFilterArgs(filters)
	query := fmt.Sprintf(`SELECT f.status, COUNT(*) %s WHERE %s GROUP BY f.status`,
		findingBaseJoins, findingFilterWhereClause)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return scanGroupedCounts(rows)
}

func CountFindingsByScanner(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	args := buildFindingFilterArgs(filters)
	query := fmt.Sprintf(`SELECT sr.scanner, COUNT(*) %s WHERE %s GROUP BY sr.scanner`,
		findingBaseJoins, findingFilterWhereClause)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return scanGroupedCounts(rows)
}

func CountFindingsByProduct(ctx context.Context, db *sql.DB, filters FindingFilters) (map[string]int, error) {
	if filters.TenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	args := buildFindingFilterArgs(filters)
	query := fmt.Sprintf(`SELECT p.name, COUNT(*) %s WHERE %s GROUP BY p.name`,
		findingBaseJoins, findingFilterWhereClause)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return scanGroupedCounts(rows)
}
