package handlers

import (
	"database/sql"
	"net/http"

	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
)

type AdminBDUHandler struct {
	db *sql.DB
}

func NewAdminBDUHandler(db *sql.DB) *AdminBDUHandler {
	return &AdminBDUHandler{db: db}
}

// GetSyncStatus returns current BDU sync status.
func (h *AdminBDUHandler) GetSyncStatus(c *fiber.Ctx) error {
	status, err := storage.GetBDUSyncStatus(c.Context(), h.db)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if status == nil {
		return c.JSON(fiber.Map{"status": "not_configured"})
	}
	return c.JSON(status)
}

// UpdateSyncInterval sets the BDU sync interval (hours).
func (h *AdminBDUHandler) UpdateSyncInterval(c *fiber.Ctx) error {
	var body struct {
		IntervalHours int `json:"interval_hours"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.IntervalHours < 1 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "interval_hours must be >= 1"})
	}
	if err := storage.UpdateBDUSyncInterval(c.Context(), h.db, body.IntervalHours); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"interval_hours": body.IntervalHours})
}
