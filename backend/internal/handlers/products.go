package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProductsHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

type ProductResponse struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Identifier        *string `json:"identifier,omitempty"`
	Version           *string `json:"version,omitempty"`
	AssetCriticality  *string `json:"assetCriticality,omitempty"`
	LastScanAt        *string `json:"lastScanAt,omitempty"`
	FindingsOpenCount int     `json:"findingsOpenCount"`
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

	items, total, err := storage.ListProducts(c.Context(), h.db, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch products"})
	}

	response := make([]ProductResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapProductListItem(item))
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

	product := &models.Product{
		Name: req.Name,
		Slug: slugify(req.Name),
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

	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true, "data": ProductResponse{
		ID:                product.ID.String(),
		Name:              product.Name,
		Identifier:        product.Identifier,
		Version:           product.Version,
		AssetCriticality:  product.AssetCriticality,
		FindingsOpenCount: 0,
	}})
}

func (h *ProductsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	row := h.db.QueryRowContext(
		c.Context(),
		`SELECT id, name, identifier, version, asset_criticality FROM products WHERE id = $1`,
		id,
	)
	var product storage.ProductListItem
	var identifier sql.NullString
	var version sql.NullString
	var assetCriticality sql.NullString
	if err := row.Scan(&product.ID, &product.Name, &identifier, &version, &assetCriticality); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	product.Identifier = identifier
	product.Version = version
	product.AssetCriticality = assetCriticality

	response := mapProductListItem(product)
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

func mapProductListItem(item storage.ProductListItem) ProductResponse {
	var identifier *string
	if item.Identifier.Valid {
		value := item.Identifier.String
		identifier = &value
	}
	var version *string
	if item.Version.Valid {
		value := item.Version.String
		version = &value
	}
	var assetCriticality *string
	if item.AssetCriticality.Valid {
		value := item.AssetCriticality.String
		assetCriticality = &value
	}
	var lastScanAt *string
	if item.LastScanAt.Valid {
		value := item.LastScanAt.Time.Format(time.RFC3339)
		lastScanAt = &value
	}
	return ProductResponse{
		ID:                item.ID.String(),
		Name:              item.Name,
		Identifier:        identifier,
		Version:           version,
		AssetCriticality:  assetCriticality,
		LastScanAt:        lastScanAt,
		FindingsOpenCount: item.FindingsOpenCount,
	}
}
