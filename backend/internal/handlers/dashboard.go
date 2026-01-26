package handlers

import (
	"database/sql"
	"net/http"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type DashboardHandler struct {
	db *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) Get(c *fiber.Ctx) error {
	// Get tenant ID from context (or use default for MVP)
	var tenantID *uuid.UUID
	if tid := tenantIDFromContext(c); tid != nil {
		tenantID = tid
	} else {
		zero := uuid.Nil
		tenantID = &zero
	}

	data, err := storage.GetDashboardData(c.Context(), h.db, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "failed to fetch dashboard data",
		})
	}

	// Convert to DTO
	resp := v1dto.DashboardDataDTO{
		Metrics: v1dto.DashboardMetrics{
			TotalOpenFindings:    data.Metrics.TotalOpenFindings,
			CriticalHighFindings: data.Metrics.CriticalHighFindings,
			FixedThisWeek:        data.Metrics.FixedThisWeek,
			ProductsAtRisk:       data.Metrics.ProductsAtRisk,
		},
		SeverityDistribution: convertSeverityDistribution(data.SeverityDistribution),
		StatusDistribution:   convertStatusDistribution(data.StatusDistribution),
		Trend:                convertTrend(data.Trend),
		TopProducts:          convertTopProducts(data.TopProducts),
		RecentActivity:       convertRecentActivity(data.RecentActivity),
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    resp,
	})
}

func convertSeverityDistribution(dist map[string]int) []v1dto.SeverityCount {
	// Ensure all severities are present in order
	severities := []string{"critical", "high", "medium", "low"}
	result := make([]v1dto.SeverityCount, 0, len(severities))
	for _, sev := range severities {
		result = append(result, v1dto.SeverityCount{
			Severity: sev,
			Count:    dist[sev],
		})
	}
	return result
}

func convertStatusDistribution(dist map[string]int) []v1dto.StatusCount {
	// Ensure all statuses are present in order
	statuses := []string{"new", "under_review", "confirmed", "false_positive", "out_of_scope", "risk_accepted", "mitigated"}
	result := make([]v1dto.StatusCount, 0, len(statuses))
	for _, status := range statuses {
		result = append(result, v1dto.StatusCount{
			Status: status,
			Count:  dist[status],
		})
	}
	return result
}

func convertTrend(trend []storage.DashboardTrendPoint) []v1dto.TrendPoint {
	result := make([]v1dto.TrendPoint, 0, len(trend))
	for _, point := range trend {
		result = append(result, v1dto.TrendPoint{
			Date:     point.Date.Format("02.01"),
			Total:    point.Total,
			Critical: point.Critical,
			High:     point.High,
			Medium:   point.Medium,
			Low:      point.Low,
		})
	}
	return result
}

func convertTopProducts(products []storage.DashboardProductRisk) []v1dto.ProductRisk {
	result := make([]v1dto.ProductRisk, 0, len(products))
	for _, p := range products {
		pr := v1dto.ProductRisk{
			ID:            p.ID.String(),
			Name:          p.Name,
			FindingsCount: p.FindingsCount,
			CriticalCount: p.CriticalCount,
			HighCount:     p.HighCount,
		}
		if p.Identifier.Valid {
			pr.Identifier = p.Identifier.String
		}
		result = append(result, pr)
	}
	return result
}

func convertRecentActivity(activities []storage.DashboardRecentActivity) []v1dto.RecentActivityItem {
	result := make([]v1dto.RecentActivityItem, 0, len(activities))
	for _, a := range activities {
		item := v1dto.RecentActivityItem{
			ID:        a.ID.String(),
			Type:      a.Type,
			Title:     a.Title,
			Timestamp: a.Timestamp.UTC().Format("2006-01-02T15:04:05Z"),
		}
		if a.Description.Valid {
			item.Description = a.Description.String
		}
		if a.Severity.Valid {
			item.Severity = a.Severity.String
		}
		result = append(result, item)
	}
	return result
}
