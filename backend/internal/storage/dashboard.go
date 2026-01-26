package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DashboardMetrics contains aggregated dashboard metrics
type DashboardMetrics struct {
	TotalOpenFindings    int
	CriticalHighFindings int
	FixedThisWeek        int
	ProductsAtRisk       int
}

// DashboardTrendPoint represents a point in the findings trend
type DashboardTrendPoint struct {
	Date     time.Time
	Total    int
	Critical int
	High     int
	Medium   int
	Low      int
}

// DashboardProductRisk represents a product's risk metrics
type DashboardProductRisk struct {
	ID            uuid.UUID
	Name          string
	Identifier    sql.NullString
	FindingsCount int
	CriticalCount int
	HighCount     int
}

// DashboardRecentActivity represents a recent activity item
type DashboardRecentActivity struct {
	ID          uuid.UUID
	Type        string
	Title       string
	Description sql.NullString
	Severity    sql.NullString
	Timestamp   time.Time
}

// DashboardData contains all dashboard data
type DashboardData struct {
	Metrics              DashboardMetrics
	SeverityDistribution map[string]int
	StatusDistribution   map[string]int
	Trend                []DashboardTrendPoint
	TopProducts          []DashboardProductRisk
	RecentActivity       []DashboardRecentActivity
}

// OpenStatuses are statuses considered "open" for metrics
var OpenStatuses = []string{"new", "under_review", "confirmed"}

// GetDashboardMetrics fetches aggregated dashboard metrics
func GetDashboardMetrics(ctx context.Context, db *sql.DB, tenantID *uuid.UUID) (*DashboardMetrics, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	metrics := &DashboardMetrics{}

	// Get total open findings (canonical only)
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.status IN ('new', 'under_review', 'confirmed')
	`, tenantID).Scan(&metrics.TotalOpenFindings)
	if err != nil {
		return nil, fmt.Errorf("failed to count open findings: %w", err)
	}

	// Get critical/high findings count
	err = db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.status IN ('new', 'under_review', 'confirmed')
		AND f.severity IN ('critical', 'high')
	`, tenantID).Scan(&metrics.CriticalHighFindings)
	if err != nil {
		return nil, fmt.Errorf("failed to count critical/high findings: %w", err)
	}

	// Get mitigated this week
	weekAgo := time.Now().UTC().AddDate(0, 0, -7)
	err = db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.status = 'mitigated'
		AND f.updated_at >= $2
	`, tenantID, weekAgo).Scan(&metrics.FixedThisWeek)
	if err != nil {
		return nil, fmt.Errorf("failed to count fixed findings: %w", err)
	}

	// Get products at risk (with critical/high findings)
	err = db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT f.product_id) FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.product_id IS NOT NULL
		AND f.status IN ('new', 'under_review', 'confirmed')
		AND f.severity IN ('critical', 'high')
	`, tenantID).Scan(&metrics.ProductsAtRisk)
	if err != nil {
		return nil, fmt.Errorf("failed to count products at risk: %w", err)
	}

	return metrics, nil
}

// GetDashboardSeverityDistribution returns findings count by severity for open findings
func GetDashboardSeverityDistribution(ctx context.Context, db *sql.DB, tenantID *uuid.UUID) (map[string]int, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	rows, err := db.QueryContext(ctx, `
		SELECT f.severity, COUNT(*)
		FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.status IN ('new', 'under_review', 'confirmed')
		GROUP BY f.severity
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get severity distribution: %w", err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var severity sql.NullString
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			return nil, err
		}
		key := severity.String
		if !severity.Valid {
			key = "unknown"
		}
		result[key] = count
	}
	return result, rows.Err()
}

// GetDashboardStatusDistribution returns findings count by status
func GetDashboardStatusDistribution(ctx context.Context, db *sql.DB, tenantID *uuid.UUID) (map[string]int, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	rows, err := db.QueryContext(ctx, `
		SELECT f.status, COUNT(*)
		FROM findings f
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		GROUP BY f.status
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get status distribution: %w", err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var status sql.NullString
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		key := status.String
		if !status.Valid {
			key = "unknown"
		}
		result[key] = count
	}
	return result, rows.Err()
}

// GetDashboardTrend returns findings trend for the last 30 days
func GetDashboardTrend(ctx context.Context, db *sql.DB, tenantID *uuid.UUID) ([]DashboardTrendPoint, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}

	// Get trend data for the last 30 days
	rows, err := db.QueryContext(ctx, `
		WITH dates AS (
			SELECT generate_series(
				(CURRENT_DATE - INTERVAL '29 days')::date,
				CURRENT_DATE::date,
				INTERVAL '1 day'
			)::date AS date
		),
		daily_counts AS (
			SELECT
				d.date,
				COALESCE(SUM(CASE WHEN f.created_at::date <= d.date AND (f.status IN ('new', 'under_review', 'confirmed') OR f.updated_at::date > d.date) THEN 1 ELSE 0 END), 0) AS total,
				COALESCE(SUM(CASE WHEN f.severity = 'critical' AND f.created_at::date <= d.date AND (f.status IN ('new', 'under_review', 'confirmed') OR f.updated_at::date > d.date) THEN 1 ELSE 0 END), 0) AS critical,
				COALESCE(SUM(CASE WHEN f.severity = 'high' AND f.created_at::date <= d.date AND (f.status IN ('new', 'under_review', 'confirmed') OR f.updated_at::date > d.date) THEN 1 ELSE 0 END), 0) AS high,
				COALESCE(SUM(CASE WHEN f.severity = 'medium' AND f.created_at::date <= d.date AND (f.status IN ('new', 'under_review', 'confirmed') OR f.updated_at::date > d.date) THEN 1 ELSE 0 END), 0) AS medium,
				COALESCE(SUM(CASE WHEN f.severity = 'low' AND f.created_at::date <= d.date AND (f.status IN ('new', 'under_review', 'confirmed') OR f.updated_at::date > d.date) THEN 1 ELSE 0 END), 0) AS low
			FROM dates d
			LEFT JOIN findings f ON f.tenant_id = $1 AND f.deleted_at IS NULL AND f.duplicate_id IS NULL
			GROUP BY d.date
		)
		SELECT date, total, critical, high, medium, low
		FROM daily_counts
		ORDER BY date ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get trend: %w", err)
	}
	defer rows.Close()

	var trend []DashboardTrendPoint
	for rows.Next() {
		var point DashboardTrendPoint
		if err := rows.Scan(&point.Date, &point.Total, &point.Critical, &point.High, &point.Medium, &point.Low); err != nil {
			return nil, err
		}
		trend = append(trend, point)
	}
	return trend, rows.Err()
}

// GetDashboardTopProducts returns top products by risk
func GetDashboardTopProducts(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, limit int) ([]DashboardProductRisk, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if limit <= 0 {
		limit = 5
	}

	rows, err := db.QueryContext(ctx, `
		SELECT
			p.id,
			p.name,
			p.identifier,
			COUNT(*) AS findings_count,
			COALESCE(SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END), 0) AS critical_count,
			COALESCE(SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END), 0) AS high_count
		FROM findings f
		JOIN products p ON p.id = f.product_id
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		AND f.status IN ('new', 'under_review', 'confirmed')
		GROUP BY p.id, p.name, p.identifier
		ORDER BY
			COALESCE(SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END), 0) * 10 +
			COALESCE(SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END), 0) * 5 +
			COUNT(*) DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top products: %w", err)
	}
	defer rows.Close()

	var products []DashboardProductRisk
	for rows.Next() {
		var p DashboardProductRisk
		if err := rows.Scan(&p.ID, &p.Name, &p.Identifier, &p.FindingsCount, &p.CriticalCount, &p.HighCount); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

// GetDashboardRecentActivity returns recent findings activity
func GetDashboardRecentActivity(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, limit int) ([]DashboardRecentActivity, error) {
	if tenantID == nil {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if limit <= 0 {
		limit = 10
	}

	rows, err := db.QueryContext(ctx, `
		SELECT
			f.id,
			'new_finding' AS type,
			CASE WHEN LENGTH(f.title) > 50 THEN LEFT(f.title, 50) || '...' ELSE f.title END AS title,
			p.name AS description,
			f.severity,
			f.created_at AS timestamp
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		WHERE f.deleted_at IS NULL
		AND f.tenant_id = $1
		AND f.duplicate_id IS NULL
		ORDER BY f.created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent activity: %w", err)
	}
	defer rows.Close()

	var activities []DashboardRecentActivity
	for rows.Next() {
		var a DashboardRecentActivity
		if err := rows.Scan(&a.ID, &a.Type, &a.Title, &a.Description, &a.Severity, &a.Timestamp); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

// GetDashboardData fetches all dashboard data in one call
func GetDashboardData(ctx context.Context, db *sql.DB, tenantID *uuid.UUID) (*DashboardData, error) {
	metrics, err := GetDashboardMetrics(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}

	severityDist, err := GetDashboardSeverityDistribution(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}

	statusDist, err := GetDashboardStatusDistribution(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}

	trend, err := GetDashboardTrend(ctx, db, tenantID)
	if err != nil {
		return nil, err
	}

	topProducts, err := GetDashboardTopProducts(ctx, db, tenantID, 5)
	if err != nil {
		return nil, err
	}

	recentActivity, err := GetDashboardRecentActivity(ctx, db, tenantID, 10)
	if err != nil {
		return nil, err
	}

	return &DashboardData{
		Metrics:              *metrics,
		SeverityDistribution: severityDist,
		StatusDistribution:   statusDist,
		Trend:                trend,
		TopProducts:          topProducts,
		RecentActivity:       recentActivity,
	}, nil
}
