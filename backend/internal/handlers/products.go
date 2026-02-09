package handlers

import (
	"database/sql"
	"net/http"

	v1dto "red-lycoris/backend/internal/dto/v1"
	v1mapper "red-lycoris/backend/internal/mapper/v1"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProductsHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

type CreateProductRequest struct {
	Name             string  `json:"name" validate:"required,min=2"`
	Identifier       *string `json:"identifier,omitempty" validate:"omitempty,max=200"`
	Version          *string `json:"version,omitempty" validate:"omitempty,max=100"`
	AssetCriticality *string `json:"assetCriticality,omitempty" validate:"omitempty,oneof=low medium high critical"`
}

func NewProductsHandler(db *sql.DB) *ProductsHandler {
	return &ProductsHandler{db: db, validator: validator.New()}
}

func (h *ProductsHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), 20)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
	}

	items, total, err := storage.ListProducts(c.Context(), h.db, tenantID, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch products"})
	}

	response := make([]v1dto.ProductListItemDTO, 0, len(items))
	for _, item := range items {
		response = append(response, v1mapper.ProductListItem(item))
	}
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *ProductsHandler) Create(c *fiber.Ctx) error {
	var req CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
	}

	product := &models.Product{
		Name:     req.Name,
		Slug:     slugify(req.Name),
		TenantID: tenantID,
	}
	if req.Identifier != nil && *req.Identifier != "" {
		product.Identifier = req.Identifier
	}
	if req.Version != nil && *req.Version != "" {
		product.Version = req.Version
		if product.Version != nil {
			product.Slug = slugify(req.Name + "-" + *product.Version)
		}
	}
	if req.AssetCriticality != nil && *req.AssetCriticality != "" {
		product.AssetCriticality = req.AssetCriticality
	}

	if err := storage.CreateProduct(c.Context(), h.db, product); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create product"})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true, "data": v1mapper.ProductDetail(*product, 0, nil)})
}

func (h *ProductsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
	}

	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, id, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
	}

	product, err := storage.GetProductListItem(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	if product == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
	}

	response := v1mapper.ProductDetailFromListItem(*product)
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

func (h *ProductsHandler) Stats(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
	}

	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, id, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
	}

	filters := storage.FindingFilters{
		TenantID:       tenantID,
		ProductIDs:     []uuid.UUID{id},
		CanonicalOnly:  true,
		IncludeRepeats: false,
	}

	statusCounts, err := storage.CountFindingsByStatus(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to compute findings status stats"})
	}

	openStatuses := append([]string{}, models.FindingOpenStatuses...)
	openStatuses = append(openStatuses, models.StatusRiskAccepted)
	openCount := 0
	for _, status := range openStatuses {
		openCount += statusCounts[status]
	}

	mitigatedCount := statusCounts[models.StatusMitigated]
	falsePositiveCount := statusCounts[models.StatusFalsePositive]

	severityCounts := make(map[string]int)
	for _, status := range openStatuses {
		filters.Statuses = []string{status}
		counts, err := storage.CountFindingsBySeverity(c.Context(), h.db, filters)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to compute findings severity stats"})
		}
		for severity, count := range counts {
			severityCounts[severity] += count
		}
	}

	response := v1dto.ProductStatsDTO{
		OpenCount:          openCount,
		MitigatedCount:     mitigatedCount,
		FalsePositiveCount: falsePositiveCount,
		SeverityCounts:     severityCounts,
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}
