package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"lotus-warden/backend/internal/dedup"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const scanUploadScope = "scan:upload"

type ScanUploadRequest struct {
	ScannerType       string `json:"scanner_type" validate:"required,oneof=trivy zap semgrep"`
	Report            json.RawMessage
	EngagementID      *uuid.UUID `json:"engagement_id,omitempty"`
	ProductName       string     `json:"product_name,omitempty"`
	ProductVersion    string     `json:"product_version,omitempty"`
	ProductIdentifier string     `json:"product_identifier,omitempty"`
}

type ScanUploadResponse struct {
	ScanID          uuid.UUID  `json:"scanId"`
	ProductID       *uuid.UUID `json:"productId,omitempty"`
	CreatedFindings int        `json:"createdFindings"`
	Duplicates      int        `json:"duplicates"`
	ProductCreated  bool       `json:"productCreated"`
}

type ScanUploadHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

func NewScanUploadHandler(db *sql.DB) *ScanUploadHandler {
	return &ScanUploadHandler{
		db:        db,
		validator: validator.New(),
	}
}

func (h *ScanUploadHandler) Handle(c *fiber.Ctx) error {
	req, err := h.parseRequest(c)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	findings, err := parser.ParseReport(req.ScannerType, req.Report)
	if err != nil {
		status := http.StatusBadRequest
		if err == parser.ErrUnsupportedFormat {
			status = http.StatusUnsupportedMediaType
		}
		return c.Status(status).JSON(fiber.Map{"error": err.Error()})
	}

	ctx := c.Context()
	product, productCreated, err := h.resolveProduct(ctx, req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve product"})
	}
	var productID *uuid.UUID
	if product != nil {
		productID = &product.ID
	}

	scan := &models.ScanResult{
		EngagementID: req.EngagementID,
		ProductID:    productID,
		UploaderID:   userIDFromContext(c),
		Scanner:      req.ScannerType,
		RawReport:    req.Report,
	}
	if err := storage.CreateScanResult(ctx, h.db, scan); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store scan result"})
	}

	duplicates := 0
	createdFindings := 0
	for _, finding := range findings {
		fingerprint := dedup.ComputeFingerprint(req.ScannerType, finding)
		existing, err := storage.FindFindingIDByFingerprint(ctx, h.db, fingerprint)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to deduplicate finding"})
		}

		status := "new"
		var duplicateID *uuid.UUID
		if existing != nil {
			status = "duplicate"
			duplicates++
			duplicateID = &existing.ID
		}

		model := &models.Finding{
			ScanResultID: &scan.ID,
			ProductID:    productID,
			Fingerprint:  fingerprint,
			Title:        finding.Title,
			Description:  finding.Description,
			Severity:     finding.Severity,
			Status:       status,
			DuplicateID:  duplicateID,
		}
		if err := storage.CreateFinding(ctx, h.db, model); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store finding"})
		}
		createdFindings++
	}

	resp := ScanUploadResponse{
		ScanID:          scan.ID,
		ProductID:       productID,
		CreatedFindings: createdFindings,
		Duplicates:      duplicates,
		ProductCreated:  productCreated,
	}
	return c.Status(http.StatusOK).JSON(resp)
}

func ScanUploadScope() string {
	return scanUploadScope
}

type scanUploadJSONPayload struct {
	ScannerType       string          `json:"scanner_type" validate:"required,oneof=trivy zap semgrep"`
	Report            json.RawMessage `json:"report"`
	EngagementID      *uuid.UUID      `json:"engagement_id,omitempty"`
	ProductName       string          `json:"product_name,omitempty"`
	ProductVersion    string          `json:"product_version,omitempty"`
	ProductIdentifier string          `json:"product_identifier,omitempty"`
}

func (h *ScanUploadHandler) parseRequest(c *fiber.Ctx) (ScanUploadRequest, error) {
	contentType := strings.ToLower(c.Get("Content-Type"))
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return h.parseMultipartRequest(c)
	}

	var payload scanUploadJSONPayload
	if err := c.BodyParser(&payload); err != nil {
		return ScanUploadRequest{}, fmt.Errorf("invalid request body")
	}

	report := strings.TrimSpace(string(payload.Report))
	if report == "" {
		return ScanUploadRequest{}, fmt.Errorf("report is required")
	}

	raw := json.RawMessage(payload.Report)
	if !json.Valid(raw) {
		return ScanUploadRequest{}, fmt.Errorf("report must be valid json")
	}

	return ScanUploadRequest{
		ScannerType:       strings.ToLower(strings.TrimSpace(payload.ScannerType)),
		Report:            raw,
		EngagementID:      payload.EngagementID,
		ProductName:       strings.TrimSpace(payload.ProductName),
		ProductVersion:    strings.TrimSpace(payload.ProductVersion),
		ProductIdentifier: strings.TrimSpace(payload.ProductIdentifier),
	}, nil
}

func (h *ScanUploadHandler) parseMultipartRequest(c *fiber.Ctx) (ScanUploadRequest, error) {
	scannerType := strings.ToLower(strings.TrimSpace(c.FormValue("scanner_type")))
	if scannerType == "" {
		return ScanUploadRequest{}, fmt.Errorf("scanner_type is required")
	}
	var reportData []byte
	fileHeader, err := c.FormFile("report")
	if err == nil && fileHeader != nil {
		file, err := fileHeader.Open()
		if err != nil {
			return ScanUploadRequest{}, fmt.Errorf("failed to read report file")
		}
		defer file.Close()

		reportData, err = io.ReadAll(file)
		if err != nil {
			return ScanUploadRequest{}, fmt.Errorf("failed to read report file")
		}
	}

	if len(reportData) == 0 {
		reportValue := strings.TrimSpace(c.FormValue("report"))
		if reportValue != "" {
			reportData = []byte(reportValue)
		}
	}

	if len(reportData) == 0 {
		return ScanUploadRequest{}, fmt.Errorf("report is required")
	}

	if !json.Valid(reportData) {
		return ScanUploadRequest{}, fmt.Errorf("report must be valid json")
	}

	return ScanUploadRequest{
		ScannerType:       scannerType,
		Report:            json.RawMessage(reportData),
		ProductName:       strings.TrimSpace(c.FormValue("product_name")),
		ProductVersion:    strings.TrimSpace(c.FormValue("product_version")),
		ProductIdentifier: strings.TrimSpace(c.FormValue("product_identifier")),
	}, nil
}

func (h *ScanUploadHandler) resolveProduct(ctx context.Context, req ScanUploadRequest) (*models.Product, bool, error) {
	identifier := strings.TrimSpace(req.ProductIdentifier)
	name := strings.TrimSpace(req.ProductName)
	version := strings.TrimSpace(req.ProductVersion)

	if name == "" && identifier == "" {
		name = inferProductName(req.ScannerType, req.Report)
	}

	if identifier != "" {
		product, err := storage.FindProductByIdentifier(ctx, h.db, identifier)
		if err != nil {
			return nil, false, err
		}
		if product != nil {
			return product, false, nil
		}
		if name == "" {
			name = identifier
		}
		return h.createProduct(ctx, name, version, &identifier)
	}

	if name != "" {
		var versionPtr *string
		if version != "" {
			versionPtr = &version
		}
		product, err := storage.FindProductByNameVersion(ctx, h.db, name, versionPtr)
		if err != nil {
			return nil, false, err
		}
		if product != nil {
			return product, false, nil
		}
		return h.createProduct(ctx, name, version, nil)
	}

	unassigned, err := storage.FindProductBySlug(ctx, h.db, "unassigned")
	if err != nil {
		return nil, false, err
	}
	if unassigned != nil {
		return unassigned, false, nil
	}
	return h.createProduct(ctx, "Unassigned", "", nil)
}

func (h *ScanUploadHandler) createProduct(ctx context.Context, name, version string, identifier *string) (*models.Product, bool, error) {
	slug := slugify(name)
	if version != "" {
		slug = slugify(fmt.Sprintf("%s-%s", name, version))
	}
	baseSlug := slug
	for i := 1; i <= 5; i++ {
		existing, err := storage.FindProductBySlug(ctx, h.db, slug)
		if err != nil {
			return nil, false, err
		}
		if existing == nil {
			break
		}
		slug = fmt.Sprintf("%s-%d", baseSlug, i)
	}

	product := &models.Product{
		Name:       name,
		Slug:       slug,
		Identifier: identifier,
	}
	if version != "" {
		product.Version = &version
	}

	if err := storage.CreateProduct(ctx, h.db, product); err != nil {
		return nil, false, err
	}
	return product, true, nil
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "_", "-")
	value = strings.ReplaceAll(value, " ", "-")
	value = strings.ReplaceAll(value, ".", "-")
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.Trim(value, "-")
	if value == "" {
		value = "product"
	}
	return value
}

func inferProductName(scannerType string, data []byte) string {
	if !json.Valid(data) {
		return ""
	}
	var payload map[string]any
	if err := json.Unmarshal(data, &payload); err != nil {
		return ""
	}
	switch strings.ToLower(scannerType) {
	case "trivy":
		if value, ok := payload["ArtifactName"].(string); ok {
			return value
		}
	case "zap":
		if sites, ok := payload["site"].([]any); ok && len(sites) > 0 {
			if site, ok := sites[0].(map[string]any); ok {
				if name, ok := site["name"].(string); ok {
					return name
				}
			}
		}
	case "semgrep":
		if value, ok := payload["version"].(string); ok && value != "" {
			return "semgrep-" + value
		}
	}
	if value, ok := payload["target"].(string); ok {
		return value
	}
	return ""
}

func userIDFromContext(c *fiber.Ctx) *uuid.UUID {
	userID := strings.TrimSpace(fmt.Sprint(c.Locals("user_id")))
	if userID == "" {
		return nil
	}
	parsed, err := uuid.Parse(userID)
	if err != nil {
		return nil
	}
	return &parsed
}
