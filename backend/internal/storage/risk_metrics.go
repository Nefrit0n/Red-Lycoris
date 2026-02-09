package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type RiskMetricsFilters struct {
	ProductID *uuid.UUID
	Status    string
	From      *time.Time
	To        *time.Time
}

type RiskBands struct {
	Low      int
	Medium   int
	High     int
	Critical int
}

type RiskTopFinding struct {
	ID        uuid.UUID
	Title     string
	Severity  string
	RiskScore float64
	RiskBand  string
	ProductID uuid.NullUUID
}

type RiskTrendPoint struct {
	Date          time.Time
	AverageRisk   float64
	CriticalCount int
}

func buildRiskMetricsWhereClause(filters RiskMetricsFilters, startIndex int) (string, []interface{}) {
	whereClause := "WHERE f.deleted_at IS NULL AND f.duplicate_id IS NULL"
	args := []interface{}{}

	if filters.ProductID != nil {
		args = append(args, *filters.ProductID)
		whereClause += fmt.Sprintf(" AND f.product_id = $%d", startIndex+len(args))
	}

	if filters.Status != "" {
		args = append(args, filters.Status)
		whereClause += fmt.Sprintf(" AND f.status = $%d", startIndex+len(args))
	}

	if filters.From != nil {
		args = append(args, *filters.From)
		whereClause += fmt.Sprintf(" AND fr.computed_at >= $%d", startIndex+len(args))
	}

	if filters.To != nil {
		args = append(args, *filters.To)
		whereClause += fmt.Sprintf(" AND fr.computed_at <= $%d", startIndex+len(args))
	}

	return whereClause, args
}

func GetRiskMetrics(ctx context.Context, db *sql.DB, filters RiskMetricsFilters, limit int) (RiskBands, []RiskTopFinding, []RiskTrendPoint, error) {
	if limit <= 0 {
		limit = 10
	}

	whereClause, args := buildRiskMetricsWhereClause(filters, 0)

	bands := RiskBands{}
	var bandBuilder strings.Builder
	bandBuilder.WriteString(`
		SELECT fr.risk_band, COUNT(*)
		FROM findings f
		INNER JOIN finding_risk fr ON fr.finding_id = f.id
		`)
	bandBuilder.WriteString(whereClause)
	bandBuilder.WriteString(`
		GROUP BY fr.risk_band`)
	bandQuery := bandBuilder.String()
	bandRows, err := db.QueryContext(ctx, bandQuery, args...)
	if err != nil {
		return bands, nil, nil, err
	}
	for bandRows.Next() {
		var band string
		var count int
		if err := bandRows.Scan(&band, &count); err != nil {
			_ = bandRows.Close()
			return bands, nil, nil, err
		}
		switch band {
		case "low":
			bands.Low = count
		case "medium":
			bands.Medium = count
		case "high":
			bands.High = count
		case "critical":
			bands.Critical = count
		}
	}
	if err := bandRows.Err(); err != nil {
		_ = bandRows.Close()
		return bands, nil, nil, err
	}
	_ = bandRows.Close()

	argsWithLimit := append([]interface{}{}, args...)
	argsWithLimit = append(argsWithLimit, limit)
	limitPH := len(argsWithLimit)
	var topBuilder strings.Builder
	topBuilder.WriteString(`
		SELECT f.id, f.title, f.severity, fr.risk_score, fr.risk_band, f.product_id
		FROM findings f
		INNER JOIN finding_risk fr ON fr.finding_id = f.id
		`)
	topBuilder.WriteString(whereClause)
	topBuilder.WriteString(`
		ORDER BY fr.risk_score DESC NULLS LAST, fr.computed_at DESC
		LIMIT $`)
	topBuilder.WriteString(strconv.Itoa(limitPH))
	topQuery := topBuilder.String()
	topRows, err := db.QueryContext(ctx, topQuery, argsWithLimit...)
	if err != nil {
		return bands, nil, nil, err
	}
	topFindings := []RiskTopFinding{}
	for topRows.Next() {
		var item RiskTopFinding
		if err := topRows.Scan(
			&item.ID,
			&item.Title,
			&item.Severity,
			&item.RiskScore,
			&item.RiskBand,
			&item.ProductID,
		); err != nil {
			_ = topRows.Close()
			return bands, nil, nil, err
		}
		topFindings = append(topFindings, item)
	}
	if err := topRows.Err(); err != nil {
		_ = topRows.Close()
		return bands, nil, nil, err
	}
	_ = topRows.Close()

	var trendBuilder strings.Builder
	trendBuilder.WriteString(`
		SELECT date_trunc('day', fr.computed_at) AS day,
			AVG(fr.risk_score) AS avg_risk,
			COUNT(*) FILTER (WHERE fr.risk_band = 'critical') AS critical_count
		FROM findings f
		INNER JOIN finding_risk fr ON fr.finding_id = f.id
		`)
	trendBuilder.WriteString(whereClause)
	trendBuilder.WriteString(`
		GROUP BY day
		ORDER BY day ASC`)
	trendQuery := trendBuilder.String()
	trendRows, err := db.QueryContext(ctx, trendQuery, args...)
	if err != nil {
		return bands, nil, nil, err
	}
	trend := []RiskTrendPoint{}
	for trendRows.Next() {
		var point RiskTrendPoint
		if err := trendRows.Scan(&point.Date, &point.AverageRisk, &point.CriticalCount); err != nil {
			_ = trendRows.Close()
			return bands, nil, nil, err
		}
		trend = append(trend, point)
	}
	if err := trendRows.Err(); err != nil {
		_ = trendRows.Close()
		return bands, nil, nil, err
	}
	_ = trendRows.Close()

	return bands, topFindings, trend, nil
}
