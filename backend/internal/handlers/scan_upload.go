package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"lotus-warden/backend/internal/dedup"
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
	ScannerType       string `json:"scanner_type" validate:"required,oneof=trivy zap semgrep"`
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

	uploaderID := userIDFromContext(c)
	if uploaderID == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized: user id missing",
		})
	}

	exists, err := storage.UserExists(c.Context(), h.db, *uploaderID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to verify user",
		})
	}
	if !exists {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	checksum := computeChecksum(req.ReportBytes)

	productName := strings.TrimSpace(req.ProductName)
	productVersion := strings.TrimSpace(req.ProductVersion)
	productIdentifier := strings.TrimSpace(req.ProductIdentifier)

	job := &models.ImportJob{
		Scanner:   req.ScannerType,
		Status:    models.ImportJobQueued,
		Checksum:  checksum,
		CreatedBy: uploaderID, // ✅ ТЕПЕРЬ КОРРЕКТНО
	}

	if productName != "" {
		job.ProductName = &productName
	}
	if productVersion != "" {
		job.ProductVersion = &productVersion
	}
	if productIdentifier != "" {
		job.ProductIdentifier = &productIdentifier
	}
	if err := storage.CreateImportJob(c.Context(), h.db, job); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create import job"})
	}

	auditMeta := auditMetadataFromContext(c)
	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Action:     "import_job.created",
		TargetType: "import_job",
		TargetID:   stringPointer(job.ID.String()),
		Scope:      "global",
	}, map[string]interface{}{
		"scanner": job.Scanner,
		"status":  job.Status,
		"meta":    auditMeta,
	})

	resp, status, err := h.processImportJob(
		c.Context(),
		req,
		job,
		uploaderID,
		auditMeta,
	)
	if err != nil {
		return c.Status(status).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusOK).JSON(resp)
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

func computeChecksum(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func (h *ScanUploadHandler) processImportJob(ctx context.Context, req ScanUploadRequest, job *models.ImportJob, uploaderID *uuid.UUID, auditMeta map[string]interface{}) (ScanUploadResponse, int, error) {
	startedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, h.db, job.ID, models.ImportJobRunning, &startedAt, nil, nil); err != nil {
		return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to start import job")
	}
	_ = createAuditLog(ctx, h.db, &models.AuditLog{
		ActorID:    uploaderID,
		ActorType:  "user",
		Action:     "import_job.started",
		TargetType: "import_job",
		TargetID:   stringPointer(job.ID.String()),
		Scope:      "global",
	}, map[string]interface{}{
		"status": models.ImportJobRunning,
		"meta":   auditMeta,
	})

	findings, err := parser.ParseReport(req.ScannerType, req.Report)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, h.db, job.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		_ = createAuditLog(ctx, h.db, &models.AuditLog{
			ActorID:    uploaderID,
			ActorType:  "user",
			Action:     "import_job.failed",
			TargetType: "import_job",
			TargetID:   stringPointer(job.ID.String()),
			Scope:      "global",
		}, map[string]interface{}{
			"status":  models.ImportJobFailed,
			"error":   errMsg,
			"meta":    auditMeta,
			"scanner": req.ScannerType,
		})
		if errors.Is(err, parser.ErrUnsupportedFormat) {
			return ScanUploadResponse{}, http.StatusUnsupportedMediaType, err
		}
		return ScanUploadResponse{}, http.StatusBadRequest, err
	}

	product, productCreated, err := h.resolveProduct(ctx, req)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := "failed to resolve product"
		_ = storage.UpdateImportJobStatus(ctx, h.db, job.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		_ = createAuditLog(ctx, h.db, &models.AuditLog{
			ActorID:    uploaderID,
			ActorType:  "user",
			Action:     "import_job.failed",
			TargetType: "import_job",
			TargetID:   stringPointer(job.ID.String()),
			Scope:      "global",
		}, map[string]interface{}{
			"status": models.ImportJobFailed,
			"error":  errMsg,
			"meta":   auditMeta,
		})
		return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to resolve product")
	}
	var productID *uuid.UUID
	if product != nil {
		productID = &product.ID
	}

	scan := &models.ScanResult{
		EngagementID: req.EngagementID,
		ProductID:    productID,
		UploaderID:   uploaderID,
		ImportJobID:  &job.ID,
		Scanner:      req.ScannerType,
		RawReport:    req.Report,
	}
	if err := storage.CreateScanResult(ctx, h.db, scan); err != nil {
		finishedAt := time.Now().UTC()
		errMsg := "failed to store scan result"
		_ = storage.UpdateImportJobStatus(ctx, h.db, job.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		_ = createAuditLog(ctx, h.db, &models.AuditLog{
			ActorID:    uploaderID,
			ActorType:  "user",
			Action:     "import_job.failed",
			TargetType: "import_job",
			TargetID:   stringPointer(job.ID.String()),
			Scope:      "global",
			ScopeID:    productID,
		}, map[string]interface{}{
			"status": models.ImportJobFailed,
			"error":  errMsg,
			"meta":   auditMeta,
		})
		return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to store scan result")
	}

	duplicates := 0
	createdFindings := 0
	seenAt := time.Now().UTC()
	for _, finding := range findings {
		fingerprint := dedup.ComputeFingerprint(req.ScannerType, finding)

		tx, err := h.db.BeginTx(ctx, nil)
		if err != nil {
			return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to start finding transaction")
		}

		var masterID uuid.UUID
		var repeatCount int
		query := `SELECT id, repeat_count
		 FROM findings
		 WHERE fingerprint = $1
		   AND duplicate_id IS NULL
		   AND deleted_at IS NULL`
		args := []interface{}{fingerprint}
		if productID != nil {
			query += " AND product_id = $2"
			args = append(args, *productID)
		} else {
			query += " AND product_id IS NULL"
		}
		query += " LIMIT 1 FOR UPDATE"
		err = tx.QueryRowContext(ctx, query, args...).Scan(&masterID, &repeatCount)
		if err != nil && err != sql.ErrNoRows {
			_ = tx.Rollback()
			return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to deduplicate finding")
		}

		if err == sql.ErrNoRows {
			model := &models.Finding{
				ScanResultID: &scan.ID,
				ProductID:    productID,
				Fingerprint:  fingerprint,
				Title:        finding.Title,
				Description:  finding.Description,
				Severity:     finding.Severity,
				Status:       models.StatusNew,
				ImportJobID:  &job.ID,
				FirstSeenAt:  seenAt,
				LastSeenAt:   seenAt,
				RepeatCount:  0,
			}
			if err := storage.CreateFindingTx(ctx, tx, model); err != nil {
				_ = tx.Rollback()
				return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to store finding")
			}
			if err := tx.Commit(); err != nil {
				return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to finalize finding")
			}
			_ = createAuditLog(ctx, h.db, &models.AuditLog{
				ActorID:    uploaderID,
				ActorType:  "user",
				Action:     "finding.created",
				TargetType: "finding",
				TargetID:   stringPointer(model.ID.String()),
				Scope:      "product",
				ScopeID:    productID,
			}, map[string]interface{}{
				"status":        model.Status,
				"severity":      model.Severity,
				"import_job_id": job.ID.String(),
				"meta":          auditMeta,
			})
			createdFindings++
			continue
		}

		duplicate := &models.Finding{
			ScanResultID: &scan.ID,
			ProductID:    productID,
			Fingerprint:  fingerprint,
			Title:        finding.Title,
			Description:  finding.Description,
			Severity:     finding.Severity,
			Status:       models.StatusDuplicate,
			DuplicateID:  &masterID,
			ImportJobID:  &job.ID,
			FirstSeenAt:  seenAt,
			LastSeenAt:   seenAt,
			RepeatCount:  0,
		}
		if err := storage.CreateFindingTx(ctx, tx, duplicate); err != nil {
			_ = tx.Rollback()
			return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to store finding")
		}
		if _, err := tx.ExecContext(
			ctx,
			`UPDATE findings
			 SET repeat_count = $1,
			     last_seen_at = $2,
			     updated_at = $2
			 WHERE id = $3`,
			repeatCount+1,
			seenAt,
			masterID,
		); err != nil {
			_ = tx.Rollback()
			return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to update master finding")
		}
		if err := tx.Commit(); err != nil {
			return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to finalize finding")
		}

		_ = createFindingEventForID(ctx, h.db, masterID, uploaderID, "repeat_detected", fiber.Map{
			"import_job_id": job.ID.String(),
		})
		_ = createAuditLog(ctx, h.db, &models.AuditLog{
			ActorID:    uploaderID,
			ActorType:  "user",
			Action:     "finding.duplicate.created",
			TargetType: "finding",
			TargetID:   stringPointer(duplicate.ID.String()),
			Scope:      "product",
			ScopeID:    productID,
		}, map[string]interface{}{
			"status":        duplicate.Status,
			"severity":      duplicate.Severity,
			"import_job_id": job.ID.String(),
			"meta":          auditMeta,
		})
		duplicates++
	}

	if productID != nil {
		_ = storage.UpdateImportJobProductID(ctx, h.db, job.ID, *productID)
	}

	if err := storage.UpdateImportJobStats(ctx, h.db, job.ID, len(findings), createdFindings, duplicates); err != nil {
		return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to update import job stats")
	}

	finishedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, h.db, job.ID, models.ImportJobSucceeded, nil, &finishedAt, nil); err != nil {
		return ScanUploadResponse{}, http.StatusInternalServerError, fmt.Errorf("failed to finalize import job")
	}
	scope := "global"
	if productID != nil {
		scope = "product"
	}
	_ = createAuditLog(ctx, h.db, &models.AuditLog{
		ActorID:    uploaderID,
		ActorType:  "user",
		Action:     "import_job.succeeded",
		TargetType: "import_job",
		TargetID:   stringPointer(job.ID.String()),
		Scope:      scope,
		ScopeID:    productID,
	}, map[string]interface{}{
		"status":         models.ImportJobSucceeded,
		"findings_total": len(findings),
		"findings_new":   createdFindings,
		"duplicates":     duplicates,
		"meta":           auditMeta,
	})

	return ScanUploadResponse{
		ImportJobID:     job.ID,
		ScanID:          scan.ID,
		ProductID:       productID,
		CreatedFindings: createdFindings,
		Duplicates:      duplicates,
		ProductCreated:  productCreated,
		Status:          models.ImportJobSucceeded,
	}, http.StatusOK, nil
}
