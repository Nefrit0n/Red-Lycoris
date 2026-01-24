package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type RiskMetricsHandler struct {
	db *sql.DB
}

func NewRiskMetricsHandler(db *sql.DB) *RiskMetricsHandler {
	return &RiskMetricsHandler{db: db}
}

func (h *RiskMetricsHandler) Get(c *fiber.Ctx) error {
	var productID *uuid.UUID
	if raw := strings.TrimSpace(c.Query("productId")); raw != "" {
		resolved, err := resolveProductFilter(c.Context(), h.db, "", raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		productID = resolved
	}

	status := strings.TrimSpace(c.Query("status"))
	if status != "" {
		if err := validateFindingStatus(status); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	fromRaw := strings.TrimSpace(c.Query("from"))
	toRaw := strings.TrimSpace(c.Query("to"))
	var from *time.Time
	var to *time.Time
	if fromRaw != "" {
		parsed, err := parseDateParam(fromRaw, false)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		from = parsed
	}
	if toRaw != "" {
		parsed, err := parseDateParam(toRaw, true)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		to = parsed
	}

	if from == nil && to == nil {
		defaultFrom := time.Now().UTC().AddDate(0, 0, -30)
		from = &defaultFrom
	}
	if from != nil && to == nil {
		now := time.Now().UTC()
		to = &now
	}

	filters := storage.RiskMetricsFilters{
		ProductID: productID,
		Status:    status,
		From:      from,
		To:        to,
	}
	bands, topFindings, trend, err := storage.GetRiskMetrics(c.Context(), h.db, filters, 10)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch risk metrics"})
	}

	resp := v1dto.RiskMetricsDTO{
		Bands: v1dto.RiskBandCounts{
			Low:      bands.Low,
			Medium:   bands.Medium,
			High:     bands.High,
			Critical: bands.Critical,
		},
		TopFindings: make([]v1dto.RiskTopFinding, 0, len(topFindings)),
	}

	for _, item := range topFindings {
		var productIDValue *string
		if item.ProductID.Valid {
			value := item.ProductID.UUID.String()
			productIDValue = &value
		}
		resp.TopFindings = append(resp.TopFindings, v1dto.RiskTopFinding{
			ID:        item.ID.String(),
			Title:     item.Title,
			Severity:  item.Severity,
			RiskScore: item.RiskScore,
			RiskBand:  item.RiskBand,
			ProductID: productIDValue,
		})
	}

	if len(trend) > 0 {
		resp.Trend = make([]v1dto.RiskTrendPoint, 0, len(trend))
		for _, point := range trend {
			resp.Trend = append(resp.Trend, v1dto.RiskTrendPoint{
				Date:          point.Date.UTC().Format("2006-01-02"),
				AverageRisk:   point.AverageRisk,
				CriticalCount: point.CriticalCount,
			})
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}
