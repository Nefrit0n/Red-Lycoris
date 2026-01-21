package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ImportJobResponse struct {
	ID                string  `json:"id"`
	Scanner           string  `json:"scanner"`
	SourceType        *string `json:"sourceType,omitempty"`
	SourceVersion     *string `json:"sourceVersion,omitempty"`
	Status            string  `json:"status"`
	FindingsTotal     int     `json:"findingsTotal"`
	FindingsNew       int     `json:"findingsNew"`
	DuplicatesTotal   int     `json:"duplicatesTotal"`
	Checksum          string  `json:"checksum"`
	CreatedAt         string  `json:"createdAt"`
	StartedAt         *string `json:"startedAt,omitempty"`
	FinishedAt        *string `json:"finishedAt,omitempty"`
	ProductID         *string `json:"productId,omitempty"`
	ProductName       *string `json:"productName,omitempty"`
	ProductVersion    *string `json:"productVersion,omitempty"`
	ProductIdentifier *string `json:"productIdentifier,omitempty"`
	CreatedBy         *string `json:"createdBy,omitempty"`
	ErrorMessage      *string `json:"errorMessage,omitempty"`
}

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
	filters := storage.ImportJobFilters{
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

	response := make([]ImportJobResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapImportJobListItem(item))
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

	resp := mapImportJobDetail(*job)
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

func mapImportJobListItem(item storage.ImportJobListItem) ImportJobResponse {
	var startedAt *string
	if item.StartedAt.Valid {
		value := item.StartedAt.Time.Format(time.RFC3339)
		startedAt = &value
	}
	var finishedAt *string
	if item.FinishedAt.Valid {
		value := item.FinishedAt.Time.Format(time.RFC3339)
		finishedAt = &value
	}
	var productID *string
	if item.ProductID.Valid {
		value := item.ProductID.UUID.String()
		productID = &value
	}
	var productName *string
	if item.ProductName.Valid {
		value := item.ProductName.String
		productName = &value
	}
	var productVersion *string
	if item.ProductVersion.Valid {
		value := item.ProductVersion.String
		productVersion = &value
	}
	var productIdentifier *string
	if item.ProductIdentifier.Valid {
		value := item.ProductIdentifier.String
		productIdentifier = &value
	}
	var createdBy *string
	if item.CreatedBy.Valid {
		value := item.CreatedBy.UUID.String()
		createdBy = &value
	}
	var sourceType *string
	if item.SourceType.Valid {
		value := item.SourceType.String
		sourceType = &value
	}
	var sourceVersion *string
	if item.SourceVersion.Valid {
		value := item.SourceVersion.String
		sourceVersion = &value
	}
	return ImportJobResponse{
		ID:                item.ID.String(),
		Scanner:           item.Scanner,
		SourceType:        sourceType,
		SourceVersion:     sourceVersion,
		Status:            item.Status,
		FindingsTotal:     item.FindingsTotal,
		FindingsNew:       item.FindingsNew,
		DuplicatesTotal:   item.DuplicatesTotal,
		Checksum:          item.Checksum,
		CreatedAt:         item.CreatedAt.Format(time.RFC3339),
		StartedAt:         startedAt,
		FinishedAt:        finishedAt,
		ProductID:         productID,
		ProductName:       productName,
		ProductVersion:    productVersion,
		ProductIdentifier: productIdentifier,
		CreatedBy:         createdBy,
	}
}

func mapImportJobDetail(item storage.ImportJobDetail) ImportJobResponse {
	resp := mapImportJobListItem(item.ImportJobListItem)
	if item.ErrorMessage.Valid {
		message := item.ErrorMessage.String
		resp.ErrorMessage = &message
	}
	return resp
}
