package handlers

import (
	"database/sql"
	"net/http"

	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type IntelHandler struct {
	db        *sql.DB
	publisher *events.Publisher
}

type IntelRefreshRequest struct {
	Identifiers []string `json:"identifiers"`
	ProductID   *string  `json:"product_id,omitempty"`
}

func NewIntelHandler(db *sql.DB, publisher *events.Publisher) *IntelHandler {
	return &IntelHandler{
		db:        db,
		publisher: publisher,
	}
}

func (h *IntelHandler) Refresh(c *fiber.Ctx) error {
	var req IntelRefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	var productID *uuid.UUID
	if req.ProductID != nil && *req.ProductID != "" {
		parsed, err := uuid.Parse(*req.ProductID)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product_id"})
		}
		productID = &parsed
	}

	identifiers := req.Identifiers
	if len(identifiers) == 0 {
		var err error
		identifiers, err = storage.ListRecentIdentifiers(c.Context(), h.db, productID, 200)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch identifiers"})
		}
	}
	if len(identifiers) == 0 {
		return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": fiber.Map{"queued": 0}})
	}

	var productPtr *string
	if productID != nil {
		value := productID.String()
		productPtr = &value
	}
	if h.publisher != nil {
		_ = h.publisher.PublishJSON(c.Context(), events.IntelEnrichRequested, events.IntelEnrichRequest{
			Identifiers: identifiers,
			ProductID:   productPtr,
			Source:      "manual_refresh",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": fiber.Map{"queued": len(identifiers)}})
}
