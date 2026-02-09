package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"red-lycoris/backend/internal/events"
	v1mapper "red-lycoris/backend/internal/mapper/v1"
	"red-lycoris/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	assetEnvironmentProd    = "prod"
	assetEnvironmentStaging = "staging"
	assetEnvironmentDev     = "dev"
	assetEnvironmentUnknown = "unknown"
)

const (
	dataClassificationPublic       = "public"
	dataClassificationInternal     = "internal"
	dataClassificationConfidential = "confidential"
	dataClassificationRestricted   = "restricted"
	dataClassificationUnknown      = "unknown"
)

type AssetContextHandler struct {
	db        *sql.DB
	validator *validator.Validate
	publisher *events.Publisher
}

type UpsertProductAssetContextRequest struct {
	Environment        string                 `json:"environment" validate:"required,oneof=prod staging dev unknown"`
	InternetExposed    *bool                  `json:"internetExposed" validate:"required"`
	DataClassification string                 `json:"dataClassification" validate:"required,oneof=public internal confidential restricted unknown"`
	BusinessImpact     *string                `json:"businessImpact,omitempty" validate:"omitempty,oneof=low medium high critical"`
	Tags               []string               `json:"tags,omitempty" validate:"omitempty,dive,max=100"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
}

func NewAssetContextHandler(db *sql.DB, publisher *events.Publisher) *AssetContextHandler {
	return &AssetContextHandler{db: db, validator: validator.New(), publisher: publisher}
}

func (h *AssetContextHandler) GetProductAssetContext(c *fiber.Ctx) error {
	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	tenantID := tenantIDFromContext(c)
	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, productID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
	}

	assetContext, err := storage.GetProductAssetContext(c.Context(), h.db, tenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch asset context"})
	}
	if assetContext == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "asset context not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": v1mapper.ProductAssetContext(*assetContext)})
}

func (h *AssetContextHandler) UpsertProductAssetContext(c *fiber.Ctx) error {
	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	var req UpsertProductAssetContextRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	if err := validateAssetContextEnums(req.Environment, req.DataClassification); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	tenantID := tenantIDFromContext(c)
	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, productID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "product not found"})
	}

	before, err := storage.GetProductAssetContext(c.Context(), h.db, tenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch asset context"})
	}

	var metadata json.RawMessage
	if req.Metadata != nil {
		payload, err := json.Marshal(req.Metadata)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid metadata"})
		}
		metadata = payload
	}

	businessImpact := req.BusinessImpact
	if businessImpact != nil && strings.TrimSpace(*businessImpact) == "" {
		businessImpact = nil
	}

	assetContext, err := storage.UpsertProductAssetContext(c.Context(), h.db, storage.ProductAssetContextUpsert{
		ProductID:          productID,
		TenantID:           tenantID,
		Environment:        req.Environment,
		InternetExposed:    *req.InternetExposed,
		DataClassification: req.DataClassification,
		BusinessImpact:     businessImpact,
		Tags:               req.Tags,
		Metadata:           metadata,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to upsert asset context"})
	}

	if h.publisher != nil {
		_ = h.publisher.PublishJSON(c.Context(), events.AssetContextUpdatedSubject, events.AssetContextUpdatedEvent{
			ProductID: productID.String(),
			TenantID:  tenantID.String(),
			UpdatedAt: time.Now().UTC(),
		})
	}

	action := "product_asset_context.updated"
	if before == nil {
		action = "product_asset_context.created"
	}

	var beforePayload interface{}
	if before != nil {
		beforePayload = mapAssetContextAuditPayload(*before)
	}
	writeAuditEntry(c.Context(), h.db, auditEntryInput{
		Action:     action,
		TargetType: "product_asset_context",
		TargetID:   stringPointer(productID.String()),
		Scope:      "product",
		ScopeID:    &productID,
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Diff: auditDiff{
			Before: beforePayload,
			After:  mapAssetContextAuditPayload(*assetContext),
		},
	}, auditMetadataFromContext(c))

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": v1mapper.ProductAssetContext(*assetContext)})
}

func validateAssetContextEnums(environment string, dataClassification string) error {
	environment = strings.TrimSpace(environment)
	dataClassification = strings.TrimSpace(dataClassification)

	switch environment {
	case assetEnvironmentProd, assetEnvironmentStaging, assetEnvironmentDev, assetEnvironmentUnknown:
		// ok
	default:
		return fiber.NewError(http.StatusBadRequest, "environment must be one of prod, staging, dev, unknown")
	}

	switch dataClassification {
	case dataClassificationPublic, dataClassificationInternal, dataClassificationConfidential, dataClassificationRestricted, dataClassificationUnknown:
		// ok
	default:
		return fiber.NewError(http.StatusBadRequest, "dataClassification must be one of public, internal, confidential, restricted, unknown")
	}

	return nil
}

func mapAssetContextAuditPayload(assetContext storage.ProductAssetContext) map[string]interface{} {
	payload := map[string]interface{}{
		"product_id":          assetContext.ProductID.String(),
		"environment":         assetContext.Environment,
		"internet_exposed":    assetContext.InternetExposed,
		"data_classification": assetContext.DataClassification,
		"tags":                assetContext.Tags,
	}
	if assetContext.TenantID != nil {
		payload["tenant_id"] = assetContext.TenantID.String()
	}
	if assetContext.BusinessImpact != nil {
		payload["business_impact"] = *assetContext.BusinessImpact
	}
	if len(assetContext.Metadata) > 0 {
		metadata := map[string]interface{}{}
		if err := json.Unmarshal(assetContext.Metadata, &metadata); err == nil {
			payload["metadata"] = metadata
		}
	}
	return payload
}
