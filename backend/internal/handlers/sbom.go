package handlers

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
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
	if fileHeader.Size > int64(maxSbomBytes) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fmt.Sprintf("file exceeds %d bytes", maxSbomBytes),
		})
	}

	f, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "failed to read file"})
	}
	defer f.Close()

	// Safety: even if fileHeader.Size is wrong, we hard-cap reads.
	payload, err := io.ReadAll(io.LimitReader(f, int64(maxSbomBytes)+1))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "failed to read file"})
	}
	if int64(len(payload)) > int64(maxSbomBytes) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fmt.Sprintf("file exceeds %d bytes", maxSbomBytes),
		})
	}

	format, err := detectSbomFormat(fileHeader.Filename, payload)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	sum := sha256.Sum256(payload)
	sha := fmt.Sprintf("%x", sum[:])

	encoding := detectEncoding(fileHeader.Filename, payload)
	contentType := contentTypeForSbomUpload(fileHeader.Filename, format, encoding)

	objectKey := fmt.Sprintf("sboms/%s/%s/%s", productID.String(), uuid.NewString(), sanitizeFilename(fileHeader.Filename))

	if err := h.store.PutObject(c.Context(), objectKey, bytes.NewReader(payload), int64(len(payload)), contentType); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to store sbom"})
	}

	// Optional metadata (helps Download() set correct Content-Type later)
	meta := fiber.Map{
		"contentType": contentType,
		"encoding":    encoding, // json|xml|text|unknown
		"detected":    format,
	}
	metaBytes, _ := json.Marshal(meta)

	sbom := &models.Sbom{
		ProductID:        productID,
		Format:           format,
		ObjectKey:        objectKey,
		SHA256:           sha,
		OriginalFilename: fileHeader.Filename,
		SizeBytes:        int64(len(payload)),
	}
	if len(metaBytes) > 0 {
		sbom.Metadata = metaBytes
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
		rid := getRequestID(c)
		fmt.Printf("sbom list failed request_id=%s product_id=%s err=%v\n", rid, productID.String(), err)

		resp := fiber.Map{"success": false, "error": "failed to list sboms"}
		if rid != "" {
			resp["requestId"] = rid
		}
		if debugErrorsEnabled() {
			resp["details"] = err.Error()
		}
		return c.Status(fiber.StatusInternalServerError).JSON(resp)
	}

	response := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		var createdAt *string
		if item.CreatedAt.Valid {
			v := item.CreatedAt.Time.Format(time.RFC3339)
			createdAt = &v
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
		rid := getRequestID(c)
		fmt.Printf("sbom get failed request_id=%s sbom_id=%s err=%v\n", rid, id.String(), err)

		resp := fiber.Map{"success": false, "error": "failed to fetch sbom"}
		if rid != "" {
			resp["requestId"] = rid
		}
		if debugErrorsEnabled() {
			resp["details"] = err.Error()
		}
		return c.Status(fiber.StatusInternalServerError).JSON(resp)
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": "sbom not found"})
	}

	object, err := h.store.GetObject(c.Context(), item.ObjectKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sbom object"})
	}
	defer object.Close()

	filename := sanitizeFilename(item.OriginalFilename)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// Prefer stored contentType in metadata (if present), else guess from filename/format.
	if ct := contentTypeFromMetadata(item.Metadata); ct != "" {
		c.Set("Content-Type", ct)
	} else {
		c.Type(contentTypeForSbomGuess(filename, item.Format))
	}

	return c.SendStream(object)
}

func detectSbomFormat(filename string, payload []byte) (string, error) {
	lower := strings.ToLower(filename)

	// SPDX
	if strings.HasSuffix(lower, ".spdx.json") || strings.HasSuffix(lower, ".spdx-json") || strings.HasSuffix(lower, ".spdxjson") {
		return models.SbomFormatSPDXJSON, nil
	}
	if strings.HasSuffix(lower, ".spdx") {
		return models.SbomFormatSPDX, nil
	}

	// CycloneDX conventional patterns (*.cdx.json, *.cdx.xml, *.cdx) :contentReference[oaicite:2]{index=2}
	if strings.HasSuffix(lower, ".cdx.json") || strings.HasSuffix(lower, ".cdx.xml") || strings.HasSuffix(lower, ".cdx") {
		return models.SbomFormatCycloneDX, nil
	}
	// Some tools use "cyclonedx" in name
	if strings.Contains(lower, "cyclonedx") {
		return models.SbomFormatCycloneDX, nil
	}

	trimmed := strings.TrimSpace(string(payload))
	if trimmed == "" {
		return "", fmt.Errorf("empty sbom payload")
	}

	// JSON heuristics
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

	// XML / Tag-Value heuristics
	lowerPayload := strings.ToLower(trimmed)
	if strings.Contains(lowerPayload, "cyclonedx") || strings.Contains(lowerPayload, "<bom") {
		return models.SbomFormatCycloneDX, nil
	}
	if strings.Contains(lowerPayload, "spdxversion") || strings.Contains(lowerPayload, "spdxid") {
		return models.SbomFormatSPDX, nil
	}

	return "", fmt.Errorf("unsupported sbom format")
}

func detectEncoding(filename string, payload []byte) string {
	lower := strings.ToLower(filename)
	if strings.HasSuffix(lower, ".json") || strings.HasSuffix(lower, ".cdx.json") || strings.HasSuffix(lower, ".spdx.json") {
		return "json"
	}
	if strings.HasSuffix(lower, ".xml") || strings.HasSuffix(lower, ".cdx.xml") {
		return "xml"
	}
	trim := strings.TrimSpace(string(payload))
	if trim == "" {
		return "unknown"
	}
	if json.Valid(payload) {
		return "json"
	}
	if strings.HasPrefix(trim, "<") || strings.Contains(strings.ToLower(trim), "<bom") {
		return "xml"
	}
	return "text"
}

func sanitizeFilename(name string) string {
	base := filepath.Base(name)
	if base == "." || base == string(filepath.Separator) || base == "" {
		return "sbom"
	}
	return base
}

func contentTypeForSbomUpload(filename string, format string, encoding string) string {
	// Prefer real encoding when known
	switch encoding {
	case "json":
		return "application/json"
	case "xml":
		return "application/xml"
	case "text":
		return "text/plain"
	}

	// fallback to extension sniff
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != "" {
		if v := mime.TypeByExtension(ext); v != "" {
			return v
		}
	}

	// last resort by format
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

func contentTypeForSbomGuess(filename string, format string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != "" {
		if v := mime.TypeByExtension(ext); v != "" {
			return v
		}
	}
	switch format {
	case models.SbomFormatCycloneDX:
		// Could be JSON or XML; without metadata, default XML.
		return "application/xml"
	case models.SbomFormatSPDXJSON:
		return "application/json"
	case models.SbomFormatSPDX:
		return "text/plain"
	default:
		return "application/octet-stream"
	}
}

func contentTypeFromMetadata(meta json.RawMessage) string {
	if len(meta) == 0 {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(meta, &m); err != nil {
		return ""
	}
	if v, ok := m["contentType"].(string); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return ""
}

func getRequestID(c *fiber.Ctx) string {
	if v := c.Locals("request_id"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	if v := c.Locals("requestid"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	if rid := strings.TrimSpace(c.Get("X-Request-ID")); rid != "" {
		return rid
	}
	return ""
}

func debugErrorsEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("LW_DEBUG_ERRORS")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}
