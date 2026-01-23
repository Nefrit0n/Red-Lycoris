package storage

import (
	"context"
	"database/sql"
	"strings"
)

// SeverityCounts is used by dashboards to render breakdown charts.
// Keep JSON keys stable for frontend.
type SeverityCounts struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Info     int `json:"info"`
}

type CategoryCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

// CountFindingsBySeverity returns counts per severity for the given filters.
// It mirrors the same WHERE logic as ListFindings (canonicalOnly/includeRepeats/etc.).
func CountFindingsBySeverity(ctx context.Context, db *sql.DB, filters FindingFilters) (SeverityCounts, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)

	query := `
		SELECT f.severity, COUNT(*)
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
	` + " " + whereClause + `
		GROUP BY f.severity
	`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return SeverityCounts{}, err
	}
	defer rows.Close()

	var counts SeverityCounts
	for rows.Next() {
		var sev string
		var n int
		if err := rows.Scan(&sev, &n); err != nil {
			return SeverityCounts{}, err
		}
		switch strings.ToLower(strings.TrimSpace(sev)) {
		case "critical":
			counts.Critical = n
		case "high":
			counts.High = n
		case "medium":
			counts.Medium = n
		case "low":
			counts.Low = n
		case "info":
			counts.Info = n
		}
	}
	if err := rows.Err(); err != nil {
		return SeverityCounts{}, err
	}

	return counts, nil
}

// CountFindingsByCategory returns counts per category for the given filters.
// It mirrors the same WHERE logic as ListFindings (canonicalOnly/includeRepeats/etc.).
func CountFindingsByCategory(ctx context.Context, db *sql.DB, filters FindingFilters) ([]CategoryCount, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)

	query := `
		SELECT f.category, COUNT(*)
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
	` + " " + whereClause + `
		GROUP BY f.category
	`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := []CategoryCount{}
	for rows.Next() {
		var category string
		var n int
		if err := rows.Scan(&category, &n); err != nil {
			return nil, err
		}
		counts = append(counts, CategoryCount{Category: category, Count: n})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return counts, nil
}
