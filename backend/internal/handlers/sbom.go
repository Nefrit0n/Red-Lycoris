package handlers

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const maxSbomBytes = 20 << 20

type SbomHandler struct {
	db    *sql.DB
	store objectstore.Store
}

func NewSbomHandler(db *sql.DB, store objectstore.Store) *SbomHandler {
	return &SbomHandler{db: db, store: store}
}

func (h *SbomHandler) Upload(c *fiber.Ctx) error {
	productIDRaw := strings.TrimSpace(c.FormValue("productId"))
	if productIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "productId is required"})
	}
	productID, err := uuid.Parse(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "file is required"})
	}
	if fileHeader.Size <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "empty file"})
	}
	if fileHeader.Size > maxSbomBytes {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": fmt.Sprintf("file exceeds %d bytes", maxSbomBytes)})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "failed to read file"})
	}
	defer file.Close()

	payload, err := io.ReadAll(file)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "failed to read file"})
	}

	format, err := detectSbomFormat(fileHeader.Filename, payload)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	sum := sha256.Sum256(payload)
	sha := fmt.Sprintf("%x", sum[:])

	objectKey := fmt.Sprintf("sboms/%s/%s/%s", productID.String(), uuid.NewString(), sanitizeFilename(fileHeader.Filename))
	contentType := contentTypeForSbom(fileHeader.Filename, format)

	if err := h.store.PutObject(c.Context(), objectKey, bytes.NewReader(payload), int64(len(payload)), contentType); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to store sbom"})
	}

	sbom := &models.Sbom{
		ProductID:        productID,
		Format:           format,
		ObjectKey:        objectKey,
		SHA256:           sha,
		OriginalFilename: fileHeader.Filename,
		SizeBytes:        int64(len(payload)),
	}
	if err := storage.CreateSbom(c.Context(), h.db, sbom); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to save sbom"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": map[string]interface{}{
			"id":               sbom.ID.String(),
			"format":           sbom.Format,
			"sha256":           sbom.SHA256,
			"originalFilename": sbom.OriginalFilename,
			"sizeBytes":        sbom.SizeBytes,
			"createdAt":        sbom.CreatedAt.Format(time.RFC3339),
		},
	})
}

func (h *SbomHandler) List(c *fiber.Ctx) error {
	productIDRaw := strings.TrimSpace(c.Query("productId"))
	if productIDRaw == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "productId is required"})
	}
	productID, err := uuid.Parse(productIDRaw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
	}

	items, err := storage.ListSbomsByProduct(c.Context(), h.db, productID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list sboms"})
	}

	response := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		var createdAt *string
		if item.CreatedAt.Valid {
			value := item.CreatedAt.Time.Format(time.RFC3339)
			createdAt = &value
		}
		response = append(response, map[string]interface{}{
			"id":               item.ID.String(),
			"format":           item.Format,
			"sha256":           item.SHA256,
			"originalFilename": item.OriginalFilename,
			"sizeBytes":        item.SizeBytes,
			"createdAt":        createdAt,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

func (h *SbomHandler) Download(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid sbom id"})
	}

	item, err := storage.GetSbomByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom"})
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom not found"})
	}

	object, err := h.store.GetObject(c.Context(), item.ObjectKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom object"})
	}
	defer object.Close()

	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", item.OriginalFilename))
	c.Type(contentTypeForSbom(item.OriginalFilename, item.Format))

	return c.SendStream(object)
}

func detectSbomFormat(filename string, payload []byte) (string, error) {
	lower := strings.ToLower(filename)
	if strings.HasSuffix(lower, ".spdx.json") || strings.HasSuffix(lower, ".spdx-json") {
		return models.SbomFormatSPDXJSON, nil
	}
	if strings.HasSuffix(lower, ".spdx") {
		return models.SbomFormatSPDX, nil
	}
	if strings.Contains(lower, "cyclonedx") || strings.HasSuffix(lower, ".cdx") {
		return models.SbomFormatCycloneDX, nil
	}

	trimmed := strings.TrimSpace(string(payload))
	if trimmed == "" {
		return "", fmt.Errorf("empty sbom payload")
	}

	if json.Valid(payload) {
		var meta map[string]interface{}
		if err := json.Unmarshal(payload, &meta); err != nil {
			return "", fmt.Errorf("invalid sbom json")
		}
		if format, ok := meta["bomFormat"].(string); ok && strings.EqualFold(format, "CycloneDX") {
			return models.SbomFormatCycloneDX, nil
		}
		if _, ok := meta["spdxVersion"]; ok {
			return models.SbomFormatSPDXJSON, nil
		}
	}

	lowerPayload := strings.ToLower(trimmed)
	if strings.Contains(lowerPayload, "cyclonedx") || strings.Contains(lowerPayload, "<bom") {
		return models.SbomFormatCycloneDX, nil
	}
	if strings.Contains(lowerPayload, "spdxversion") || strings.Contains(lowerPayload, "spdxid") {
		return models.SbomFormatSPDX, nil
	}

	return "", fmt.Errorf("unsupported sbom format")
}

func sanitizeFilename(name string) string {
	base := filepath.Base(name)
	if base == "." || base == string(filepath.Separator) || base == "" {
		return "sbom"
	}
	return base
}

func contentTypeForSbom(filename string, format string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != "" {
		if value := mime.TypeByExtension(ext); value != "" {
			return value
		}
	}
	switch format {
	case models.SbomFormatCycloneDX:
		return "application/xml"
	case models.SbomFormatSPDXJSON:
		return "application/json"
	case models.SbomFormatSPDX:
		return "text/plain"
	default:
		return "application/octet-stream"
	}
}
