package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type RiskModelsHandler struct {
	db        *sql.DB
	publisher *events.Publisher
}

func NewRiskModelsHandler(db *sql.DB, publisher *events.Publisher) *RiskModelsHandler {
	return &RiskModelsHandler{db: db, publisher: publisher}
}

func (h *RiskModelsHandler) Activate(c *fiber.Ctx) error {
	modelID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid model id"})
	}

	activation, err := storage.ActivateRiskModel(c.Context(), h.db, modelID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "risk model not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to activate risk model"})
	}

	if h.publisher != nil {
		var tenantValue *string
		if activation.TenantID != nil {
			value := activation.TenantID.String()
			tenantValue = &value
		}
		_ = h.publisher.PublishJSON(c.Context(), events.RiskModelActivatedSubject, events.RiskModelActivatedEvent{
			ModelVersion: activation.ModelVersion,
			ActivatedAt:  time.Now().UTC(),
			TenantID:     tenantValue,
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": fiber.Map{"modelVersion": activation.ModelVersion}})
}
