package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type FindingsHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

type FindingResponse struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Severity    string  `json:"severity"`
	Status      string  `json:"status"`
	ProductID   *string `json:"productId,omitempty"`
	ProductName *string `json:"productName,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	DeletedAt   *string `json:"deletedAt,omitempty"`
}

type CreateFindingRequest struct {
	Title       string  `json:"title" validate:"required,max=200"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Severity    string  `json:"severity" validate:"required"`
	Status      string  `json:"status,omitempty"`
	ProductID   string  `json:"productId" validate:"required,uuid4"`
}

type UpdateFindingRequest struct {
	Title       *string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Severity    *string `json:"severity,omitempty"`
	Status      *string `json:"status,omitempty"`
	ProductID   *string `json:"productId,omitempty" validate:"omitempty,uuid4"`
}

func NewFindingsHandler(db *sql.DB) *FindingsHandler {
	return &FindingsHandler{db: db, validator: validator.New()}
}

// ListFindings godoc
// @Summary List findings
// @Description Get paginated findings list
// @Tags findings
// @Produce json
// @Param page query int false "Page number"
// @Param pageSize query int false "Page size"
// @Param severity query string false "Severity"
// @Param status query string false "Status"
// @Param productId query string false "Product ID"
// @Param sortField query string false "Sort field"
// @Param sortOrder query string false "Sort order"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /api/v1/findings [get]
func (h *FindingsHandler) List(c *fiber.Ctx) error {
	page := parseIntWithDefault(c.Query("page"), 1)
	pageSize := parseIntWithDefault(c.Query("pageSize"), 20)
	if page < 1 || pageSize < 1 || pageSize > 200 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	var productID *uuid.UUID
	if productParam := strings.TrimSpace(c.Query("productId")); productParam != "" {
		parsed, err := uuid.Parse(productParam)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
		}
		productID = &parsed
	}

	filters := storage.FindingFilters{
		Severity:  strings.TrimSpace(c.Query("severity")),
		Status:    strings.TrimSpace(c.Query("status")),
		ProductID: productID,
		SortField: strings.TrimSpace(c.Query("sortField")),
		SortOrder: strings.TrimSpace(c.Query("sortOrder")),
		Limit:     pageSize,
		Offset:    (page - 1) * pageSize,
	}

	items, total, err := storage.ListFindings(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch findings"})
	}

	response := make([]FindingResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapFindingListItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

// GetFinding godoc
// @Summary Get finding
// @Description Get a finding by ID
// @Tags findings
// @Produce json
// @Param id path string true "Finding ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Router /api/v1/findings/{id} [get]
func (h *FindingsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	finding, err := storage.GetFindingByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch finding"})
	}
	if finding == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapFindingDetail(*finding)})
}

// CreateFinding godoc
// @Summary Create finding
// @Description Create a new finding
// @Tags findings
// @Accept json
// @Produce json
// @Param payload body CreateFindingRequest true "Finding payload"
// @Success 201 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Router /api/v1/findings [post]
func (h *FindingsHandler) Create(c *fiber.Ctx) error {
	var req CreateFindingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	if err := validateFindingSeverity(req.Severity); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "new"
	}
	if err := validateFindingStatus(status); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	productID := uuid.MustParse(req.ProductID)
	finding := &models.Finding{
		ProductID:   &productID,
		Title:       req.Title,
		Description: req.Description,
		Severity:    req.Severity,
		Status:      status,
		Fingerprint: uuid.NewString(),
	}
	if err := storage.CreateFinding(c.Context(), h.db, finding); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create finding"})
	}

	response := mapFindingModel(*finding)
	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true, "data": response})
}

// UpdateFinding godoc
// @Summary Update finding
// @Description Update finding by ID
// @Tags findings
// @Accept json
// @Produce json
// @Param id path string true "Finding ID"
// @Param payload body UpdateFindingRequest true "Finding payload"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Router /api/v1/findings/{id} [put]
func (h *FindingsHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	var req UpdateFindingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	isAdmin := middleware.HasRole(c, "admin")
	isAnalyst := middleware.HasRole(c, "analyst")
	if !isAdmin && !isAnalyst {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}

	if !isAdmin {
		if req.Title != nil || req.Severity != nil || req.ProductID != nil {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "analyst can only update status or description"})
		}
	}

	if req.Severity != nil {
		if err := validateFindingSeverity(*req.Severity); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}
	if req.Status != nil {
		if err := validateFindingStatus(*req.Status); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	var productID *uuid.UUID
	if req.ProductID != nil {
		parsed := uuid.MustParse(*req.ProductID)
		productID = &parsed
	}

	updated, err := storage.UpdateFinding(c.Context(), h.db, id, storage.UpdateFindingParams{
		Title:       req.Title,
		Description: req.Description,
		Severity:    req.Severity,
		Status:      req.Status,
		ProductID:   productID,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update finding"})
	}
	if updated == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapFindingModel(*updated)})
}

// DeleteFinding godoc
// @Summary Delete finding
// @Description Soft delete a finding
// @Tags findings
// @Produce json
// @Param id path string true "Finding ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Router /api/v1/findings/{id} [delete]
func (h *FindingsHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	deleted, err := storage.SoftDeleteFinding(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to delete finding"})
	}
	if deleted == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapFindingModel(*deleted)})
}

func mapFindingListItem(item storage.FindingListItem) FindingResponse {
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
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		ProductName: productName,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
	}
}

func mapFindingDetail(item storage.FindingDetail) FindingResponse {
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
	var deletedAt *string
	if item.DeletedAt.Valid {
		value := item.DeletedAt.Time.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	var description *string
	if item.Description.Valid {
		value := item.Description.String
		description = &value
	}
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: description,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		ProductName: productName,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

func mapFindingModel(item models.Finding) FindingResponse {
	var productID *string
	if item.ProductID != nil {
		value := item.ProductID.String()
		productID = &value
	}
	var deletedAt *string
	if item.DeletedAt != nil {
		value := item.DeletedAt.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: item.Description,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

func parseIntWithDefault(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func validateFindingSeverity(severity string) error {
	switch severity {
	case "low", "medium", "high", "critical":
		return nil
	default:
		return fmt.Errorf("invalid severity")
	}
}

func validateFindingStatus(status string) error {
	switch status {
	case "new", "duplicate", "resolved", "ignored":
		return nil
	default:
		return fmt.Errorf("invalid status")
	}
}

func timeFormatRFC3339() string {
	return time.RFC3339
}
