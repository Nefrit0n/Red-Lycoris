package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	v1dto "lotus-warden/backend/internal/dto/v1"
	v1mapper "lotus-warden/backend/internal/mapper/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ImportJobsHandler struct {
	db *sql.DB
}

func NewImportJobsHandler(db *sql.DB) *ImportJobsHandler {
	return &ImportJobsHandler{db: db}
}

func (h *ImportJobsHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), 20)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		page := parseIntWithDefault(c.Query("page"), 1)
		pageSize := parseIntWithDefault(c.Query("pageSize"), 20)
		if page < 1 || pageSize < 1 || pageSize > 200 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
		}
		limit = pageSize
		offset = (page - 1) * pageSize
	}

	var productID *uuid.UUID
	if raw := strings.TrimSpace(c.Query("productId")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
		}
		productID = &parsed
	}
	var tenantID *uuid.UUID
	if raw := strings.TrimSpace(c.Query("tenantId")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid tenantId"})
		}
		tenantID = &parsed
	}
	filters := storage.ImportJobFilters{
		TenantID:  tenantID,
		ProductID: productID,
		Scanner:   strings.TrimSpace(c.Query("scanner")),
		Status:    strings.TrimSpace(c.Query("status")),
		Limit:     limit,
		Offset:    offset,
	}

	items, total, err := storage.ListImportJobs(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch import jobs"})
	}

	response := make([]v1dto.ImportJobListItemDTO, 0, len(items))
	for _, item := range items {
		response = append(response, v1mapper.ImportJobListItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *ImportJobsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid import job id"})
	}

	job, err := storage.GetImportJobByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch import job"})
	}
	if job == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "import job not found"})
	}

	resp := v1mapper.ImportJobDetail(*job)
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}
