package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ImportJobResponse struct {
	ID                string  `json:"id"`
	Scanner           string  `json:"scanner"`
	Status            string  `json:"status"`
	FindingsTotal     int     `json:"findingsTotal"`
	FindingsNew       int     `json:"findingsNew"`
	DuplicatesTotal   int     `json:"duplicatesTotal"`
	Checksum          string  `json:"checksum"`
	CreatedAt         string  `json:"createdAt"`
	StartedAt         *string `json:"startedAt,omitempty"`
	FinishedAt        *string `json:"finishedAt,omitempty"`
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
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	items, total, err := storage.ListImportJobs(c.Context(), h.db, limit, offset)
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
	return ImportJobResponse{
		ID:                item.ID.String(),
		Scanner:           item.Scanner,
		Status:            item.Status,
		FindingsTotal:     item.FindingsTotal,
		FindingsNew:       item.FindingsNew,
		DuplicatesTotal:   item.DuplicatesTotal,
		Checksum:          item.Checksum,
		CreatedAt:         item.CreatedAt.Format(time.RFC3339),
		StartedAt:         startedAt,
		FinishedAt:        finishedAt,
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
