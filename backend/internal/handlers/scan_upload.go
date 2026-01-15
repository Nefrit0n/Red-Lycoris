package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"lotus-warden/backend/internal/dedup"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const scanUploadScope = "scan:upload"

type ReportPayload struct {
	Raw json.RawMessage
}

func (r *ReportPayload) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("report is required")
	}
	if data[0] == '"' {
		var rawString string
		if err := json.Unmarshal(data, &rawString); err != nil {
			return fmt.Errorf("invalid report payload")
		}
		if !json.Valid([]byte(rawString)) {
			return fmt.Errorf("report must be valid json")
		}
		r.Raw = json.RawMessage(rawString)
		return nil
	}
	if !json.Valid(data) {
		return fmt.Errorf("report must be valid json")
	}
	r.Raw = json.RawMessage(data)
	return nil
}

type ScanUploadRequest struct {
	ScannerType  string        `json:"scanner_type" validate:"required,oneof=sast dast sca"`
	Report       ReportPayload `json:"report" validate:"required"`
	EngagementID *uuid.UUID    `json:"engagement_id,omitempty"`
}

type ScanUploadResponse struct {
	Status            string    `json:"status"`
	ScanID            uuid.UUID `json:"scan_id"`
	FindingsProcessed int       `json:"findings_processed"`
	Duplicates        int       `json:"duplicates"`
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
	var req ScanUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if len(req.Report.Raw) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "report is required"})
	}

	findings, err := parser.ParseReport(req.ScannerType, req.Report.Raw)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	ctx := context.Background()
	scan := &models.ScanResult{
		EngagementID: req.EngagementID,
		Scanner:      req.ScannerType,
		RawReport:    req.Report.Raw,
	}
	if err := storage.CreateScanResult(ctx, h.db, scan); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store scan result"})
	}

	duplicates := 0
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
			ScanResultID: scan.ID,
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
	}

	resp := ScanUploadResponse{
		Status:            "ok",
		ScanID:            scan.ID,
		FindingsProcessed: len(findings),
		Duplicates:        duplicates,
	}
	return c.Status(http.StatusOK).JSON(resp)
}

func ScanUploadScope() string {
	return scanUploadScope
}
