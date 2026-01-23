package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/importing"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	scanUploadScope    = "scan:upload"
	maxScanReportBytes = 10 << 20
)

type ScanUploadRequest struct {
	ScannerType       string `json:"scanner_type" validate:"required,oneof=trivy zap semgrep sarif"`
	Report            json.RawMessage
	ReportBytes       []byte
	EngagementID      *uuid.UUID `json:"engagement_id,omitempty"`
	ProductName       string     `json:"product_name,omitempty"`
	ProductVersion    string     `json:"product_version,omitempty"`
	ProductIdentifier string     `json:"product_identifier,omitempty"`
}

type ScanUploadResponse struct {
	ImportJobID     uuid.UUID  `json:"importJobId"`
	ScanID          uuid.UUID  `json:"scanId"`
	ProductID       *uuid.UUID `json:"productId,omitempty"`
	CreatedFindings int        `json:"createdFindings"`
	Duplicates      int        `json:"duplicates"`
	ProductCreated  bool       `json:"productCreated"`
	Status          string     `json:"status"`
}

type ScanUploadHandler struct {
	db        *sql.DB
	validator *validator.Validate
	publisher *events.Publisher
}

func NewScanUploadHandler(db *sql.DB, publisher *events.Publisher) *ScanUploadHandler {
	return &ScanUploadHandler{
		db:        db,
		validator: validator.New(),
		publisher: publisher,
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

	uploaderID := userIDFromContext(c)
	if uploaderID == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized: user id missing"})
	}

	exists, err := storage.UserExists(c.Context(), h.db, *uploaderID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify user"})
	}
	if !exists {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "user not found"})
	}

	product, productCreated, err := h.resolveProduct(c.Context(), req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve product"})
	}

	var productID *uuid.UUID
	if product != nil {
		productID = &product.ID
	}
	var tenantID *uuid.UUID
	if product != nil && product.TenantID != nil {
		tenantID = product.TenantID
	}

	auditMeta := auditMetadataFromContext(c)

	callbacks := &importing.ImportCallbacks{
		OnImportStarted: func(jobID uuid.UUID) {
			_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "import_job.started",
				TargetType: "import_job",
				TargetID:   stringPointer(jobID.String()),
				Scope:      "global",
			}, map[string]interface{}{
				"status": models.ImportJobRunning,
				"meta":   auditMeta,
			})
		},
		OnFindingCreated: func(finding *models.Finding) {
			_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "finding.created",
				TargetType: "finding",
				TargetID:   stringPointer(finding.ID.String()),
				Scope:      "product",
				ScopeID:    productID,
			}, map[string]interface{}{
				"status":        finding.Status,
				"severity":      finding.Severity,
				"import_job_id": finding.ImportJobID.String(),
				"meta":          auditMeta,
			})
		},
		OnDuplicateCreated: func(finding *models.Finding, masterID uuid.UUID) {
			_ = createFindingEventForID(c.Context(), h.db, masterID, uploaderID, "repeat_detected", fiber.Map{
				"import_job_id": finding.ImportJobID.String(),
			})
			_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "finding.duplicate.created",
				TargetType: "finding",
				TargetID:   stringPointer(finding.ID.String()),
				Scope:      "product",
				ScopeID:    productID,
			}, map[string]interface{}{
				"status":        finding.Status,
				"severity":      finding.Severity,
				"import_job_id": finding.ImportJobID.String(),
				"meta":          auditMeta,
			})
		},
		OnImportFailed: func(jobID uuid.UUID, err error) {
			_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "import_job.failed",
				TargetType: "import_job",
				TargetID:   stringPointer(jobID.String()),
				Scope:      "global",
			}, map[string]interface{}{
				"status": models.ImportJobFailed,
				"error":  err.Error(),
				"meta":   auditMeta,
			})
		},
		OnImportSucceeded: func(jobID uuid.UUID, total, new, duplicates int) {
			scope := "global"
			if productID != nil {
				scope = "product"
			}
			_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "import_job.succeeded",
				TargetType: "import_job",
				TargetID:   stringPointer(jobID.String()),
				Scope:      scope,
				ScopeID:    productID,
			}, map[string]interface{}{
				"status":         models.ImportJobSucceeded,
				"findings_total": total,
				"findings_new":   new,
				"duplicates":     duplicates,
				"meta":           auditMeta,
			})
		},
		OnIdentifiersDetected: func(identifiers []string) {
			if h.publisher == nil || len(identifiers) == 0 {
				return
			}
			var product string
			if productID != nil {
				product = productID.String()
			}
			var productPtr *string
			if product != "" {
				productPtr = &product
			}
			_ = h.publisher.PublishJSON(c.Context(), events.IntelEnrichRequested, events.IntelEnrichRequest{
				Identifiers: identifiers,
				ProductID:   productPtr,
				Source:      "scan_upload",
			})
		},
	}

	result, err := importing.ImportFindings(c.Context(), h.db, importing.ImportParams{
		Scanner:      req.ScannerType,
		Report:       req.ReportBytes,
		SourceType:   "scanner",
		ProductID:    productID,
		EngagementID: req.EngagementID,
		CreatedBy:    uploaderID,
		TenantID:     tenantID,
		Callbacks:    callbacks,
	})
	if err != nil {
		if errors.Is(err, parser.ErrUnsupportedFormat) {
			return c.Status(http.StatusUnsupportedMediaType).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusOK).JSON(ScanUploadResponse{
		ImportJobID:     result.ImportJobID,
		ScanID:          result.ScanID,
		ProductID:       productID,
		CreatedFindings: result.New,
		Duplicates:      result.Duplicates,
		ProductCreated:  productCreated,
		Status:          models.ImportJobSucceeded,
	})
}

func ScanUploadScope() string {
	return scanUploadScope
}

type scanUploadJSONPayload struct {
	ScannerType       string          `json:"scanner_type" validate:"required,oneof=trivy zap semgrep sarif"`
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
	if len(raw) > maxScanReportBytes {
		return ScanUploadRequest{}, fmt.Errorf("report exceeds maximum size of %d bytes", maxScanReportBytes)
	}
	if !json.Valid(raw) {
		return ScanUploadRequest{}, fmt.Errorf("report must be valid json")
	}

	return ScanUploadRequest{
		ScannerType:       strings.ToLower(strings.TrimSpace(payload.ScannerType)),
		Report:            raw,
		ReportBytes:       []byte(raw),
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
		if fileHeader.Size > maxScanReportBytes {
			return ScanUploadRequest{}, fmt.Errorf("report exceeds maximum size of %d bytes", maxScanReportBytes)
		}
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
	if len(reportData) > maxScanReportBytes {
		return ScanUploadRequest{}, fmt.Errorf("report exceeds maximum size of %d bytes", maxScanReportBytes)
	}
	if !json.Valid(reportData) {
		return ScanUploadRequest{}, fmt.Errorf("report must be valid json")
	}

	return ScanUploadRequest{
		ScannerType:       scannerType,
		Report:            json.RawMessage(reportData),
		ReportBytes:       reportData,
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
		product, err := storage.FindProductByIdentifier(ctx, h.db, identifier, nil)
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
		product, err := storage.FindProductByNameVersion(ctx, h.db, name, versionPtr, nil)
		if err != nil {
			return nil, false, err
		}
		if product != nil {
			return product, false, nil
		}
		return h.createProduct(ctx, name, version, nil)
	}

	unassigned, err := storage.FindProductBySlug(ctx, h.db, "unassigned", nil)
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
		existing, err := storage.FindProductBySlug(ctx, h.db, slug, nil)
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

func createFindingEventForID(ctx context.Context, db *sql.DB, findingID uuid.UUID, actorID *uuid.UUID, eventType string, payload fiber.Map) error {
	var rawPayload []byte
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		rawPayload = data
	}
	event := &models.FindingEvent{
		FindingID: findingID,
		ActorID:   actorID,
		EventType: eventType,
		Payload:   rawPayload,
	}
	return storage.CreateFindingEvent(ctx, db, event)
}
