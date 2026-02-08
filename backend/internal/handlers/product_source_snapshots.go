package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const productSourceSnapshotDefaultLimit = 20

type ProductSourceSnapshotsHandler struct {
	db        *sql.DB
	store     objectstore.Store
	publisher *events.Publisher
	cfg       config.Config
}

func NewProductSourceSnapshotsHandler(db *sql.DB, store objectstore.Store, publisher *events.Publisher, cfg config.Config) *ProductSourceSnapshotsHandler {
	return &ProductSourceSnapshotsHandler{db: db, store: store, publisher: publisher, cfg: cfg}
}

func (h *ProductSourceSnapshotsHandler) Create(c *fiber.Ctx) error {
	uploaderID := userIDFromContext(c)
	if uploaderID == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized: user id missing"})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "tenant_id is required"})
	}

	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid product id"})
	}

	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, productID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "product not found"})
	}

	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
	if idempotencyKey != "" {
		existing, err := storage.GetProductSourceSnapshotByIdempotencyKey(c.Context(), h.db, tenantID, idempotencyKey)
		if err == nil && existing != nil {
			if existing.ProductID != productID {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "idempotency key already used for another product"})
			}
			if tenantID != nil && (!existing.TenantID.Valid || existing.TenantID.UUID != *tenantID) {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "snapshot does not belong to tenant"})
			}
			return c.Status(http.StatusOK).JSON(fiber.Map{
				"success": true,
				"data": map[string]interface{}{
					"id":        existing.ID.String(),
					"productId": existing.ProductID.String(),
					"size":      existing.ArchiveSize,
					"createdAt": existing.CreatedAt.Format(time.RFC3339),
				},
			})
		}
	}

	fileHeader, err := c.FormFile("archive")
	if err != nil || fileHeader == nil {
		if err != nil && errors.Is(err, fiber.ErrRequestEntityTooLarge) {
			return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "archive exceeds request limit"})
		}
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "archive file is required"})
	}

	maxSize := parseInt64WithDefault(h.cfg.AnalysisMaxArchiveBytes, 104857600)
	if fileHeader.Size > maxSize {
		return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": fmt.Sprintf("archive exceeds %d bytes", maxSize)})
	}

	snapshot := &models.ProductSourceSnapshot{
		TenantID:    tenantID,
		ProductID:   productID,
		ArchiveSize: fileHeader.Size,
		CreatedBy:   uploaderID,
	}
	if idempotencyKey != "" {
		snapshot.IdempotencyKey = &idempotencyKey
	}
	snapshot.PrepareForInsert()

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "failed to read archive"})
	}
	defer file.Close()

	format, buffered, err := detectArchiveFormat(file)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "failed to read archive"})
	}
	if !isSupportedArchiveFormat(format) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": supportedArchiveMessage})
	}

	objectKey := fmt.Sprintf("products/%s/source-snapshots/%s/archive%s", productID.String(), snapshot.ID.String(), format.Extension())
	snapshot.ObjectKey = objectKey

	if err := h.store.PutObject(c.Context(), objectKey, buffered, fileHeader.Size, "application/octet-stream"); err != nil {
		logSnapshotError(c, tenantID, productID, snapshot.ID, "failed to store archive", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store archive"})
	}

	if err := storage.CreateProductSourceSnapshot(c.Context(), h.db, snapshot); err != nil {
		_ = h.store.DeleteObject(c.Context(), objectKey)
		logSnapshotError(c, tenantID, productID, snapshot.ID, "failed to save source snapshot", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save source snapshot"})
	}

	if h.publisher != nil {
		_ = h.publisher.PublishJSON(c.Context(), events.ProductSourceSnapshotCreatedSubject, fiber.Map{
			"snapshot_id": snapshot.ID.String(),
			"product_id":  snapshot.ProductID.String(),
			"tenant_id":   tenantID.String(),
			"created_at":  snapshot.CreatedAt.Format(time.RFC3339),
			"size":        snapshot.ArchiveSize,
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"id":        snapshot.ID.String(),
			"productId": snapshot.ProductID.String(),
			"size":      snapshot.ArchiveSize,
			"createdAt": snapshot.CreatedAt.Format(time.RFC3339),
		},
	})
}

func (h *ProductSourceSnapshotsHandler) List(c *fiber.Ctx) error {
	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "tenant_id is required"})
	}

	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid product id"})
	}

	limit := parseIntWithDefault(c.Query("limit"), productSourceSnapshotDefaultLimit)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid pagination"})
	}

	items, total, err := storage.ListProductSourceSnapshots(c.Context(), h.db, tenantID, productID, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list source snapshots"})
	}

	response := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		response = append(response, map[string]interface{}{
			"id":        item.ID.String(),
			"productId": item.ProductID.String(),
			"size":      item.ArchiveSize,
			"createdAt": item.CreatedAt.Format(time.RFC3339),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *ProductSourceSnapshotsHandler) Latest(c *fiber.Ctx) error {
	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "tenant_id is required"})
	}

	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid product id"})
	}

	item, err := storage.GetLatestProductSourceSnapshot(c.Context(), h.db, tenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch source snapshot"})
	}
	if item == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "source snapshot not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"id":        item.ID.String(),
			"productId": item.ProductID.String(),
			"size":      item.ArchiveSize,
			"createdAt": item.CreatedAt.Format(time.RFC3339),
		},
	})
}

func logSnapshotError(c *fiber.Ctx, tenantID *uuid.UUID, productID uuid.UUID, snapshotID uuid.UUID, message string, err error) {
	requestID := "unknown"
	if value := requestIDFromContext(c); value != nil {
		requestID = *value
	}
	tenantValue := "unknown"
	if tenantID != nil {
		tenantValue = tenantID.String()
	}
	log.Printf("%s request_id=%s tenant_id=%s product_id=%s snapshot_id=%s err=%v", message, requestID, tenantValue, productID.String(), snapshotID.String(), err)
}
