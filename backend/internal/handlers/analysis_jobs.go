package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
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

const (
	analysisScope        = "analysis:run"
	analysisDefaultLimit = 20
)

type AnalysisJobsHandler struct {
	db        *sql.DB
	store     objectstore.Store
	publisher *events.Publisher
	cfg       config.Config
}

type AnalysisJobResponse struct {
	ID                 string   `json:"id"`
	TenantID           *string  `json:"tenantId,omitempty"`
	ProductID          *string  `json:"productId,omitempty"`
	ProductName        *string  `json:"productName,omitempty"`
	EngagementID       *string  `json:"engagementId,omitempty"`
	SourceSnapshotID   *string  `json:"sourceSnapshotId,omitempty"`
	Status             string   `json:"status"`
	Scanners           []string `json:"scanners"`
	SemgrepStatus      string   `json:"semgrepStatus"`
	TrivyStatus        string   `json:"trivyStatus"`
	FindingsTotal      int      `json:"findingsTotal"`
	FindingsNew        int      `json:"findingsNew"`
	DuplicatesTotal    int      `json:"duplicatesTotal"`
	CreatedAt          string   `json:"createdAt"`
	StartedAt          *string  `json:"startedAt,omitempty"`
	FinishedAt         *string  `json:"finishedAt,omitempty"`
	DurationSeconds    *float64 `json:"durationSeconds,omitempty"`
	ArtifactSemgrep    bool     `json:"artifactSemgrep"`
	ArtifactTrivy      bool     `json:"artifactTrivy"`
	SemgrepImportJobID *string  `json:"semgrepImportJobId,omitempty"`
	TrivyImportJobID   *string  `json:"trivyImportJobId,omitempty"`
	ErrorMessage       *string  `json:"errorMessage,omitempty"`
}

type AnalysisJobCreateResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func NewAnalysisJobsHandler(db *sql.DB, store objectstore.Store, publisher *events.Publisher, cfg config.Config) *AnalysisJobsHandler {
	return &AnalysisJobsHandler{db: db, store: store, publisher: publisher, cfg: cfg}
}

func AnalysisScope() string {
	return analysisScope
}

func (h *AnalysisJobsHandler) Create(c *fiber.Ctx) error {
	uploaderID := userIDFromContext(c)
	if uploaderID == nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized: user id missing"})
	}

	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
	if idempotencyKey != "" {
		existing, err := storage.GetAnalysisJobByIdempotencyKey(c.Context(), h.db, idempotencyKey)
		if err == nil && existing != nil {
			resp := mapAnalysisJobDetail(*existing)
			return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
		}
	}

	productIDRaw := strings.TrimSpace(c.FormValue("product_id"))
	if productIDRaw == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "product_id is required"})
	}
	productID, err := uuid.Parse(productIDRaw)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid product_id"})
	}

	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "tenant context is required"})
	}

	exists, err := storage.ProductExistsForTenant(c.Context(), h.db, productID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch product"})
	}
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "product not found"})
	}

	var engagementID *uuid.UUID
	if raw := strings.TrimSpace(c.FormValue("engagement_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid engagement_id"})
		}
		engagementID = &parsed
	}

	scanners := parseScanners(c.FormValue("scanners"))
	if len(scanners) == 0 {
		scanners = []string{"semgrep", "trivy"}
	}
	if err := validateScanners(scanners); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var sourceSnapshotID *uuid.UUID
	if raw := strings.TrimSpace(c.FormValue("source_snapshot_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid source_snapshot_id"})
		}
		sourceSnapshotID = &parsed
	}

	fileHeader, fileErr := c.FormFile("archive")
	hasArchive := fileErr == nil && fileHeader != nil
	hasSnapshot := sourceSnapshotID != nil
	if hasArchive == hasSnapshot {
		if fileErr != nil && errors.Is(fileErr, fiber.ErrRequestEntityTooLarge) {
			return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "archive exceeds request limit"})
		}
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "exactly one of archive or source_snapshot_id must be provided"})
	}

	if hasArchive {
		maxSize := parseInt64WithDefault(h.cfg.AnalysisMaxArchiveBytes, 104857600)
		if fileHeader.Size > maxSize {
			return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": fmt.Sprintf("archive exceeds %d bytes", maxSize)})
		}

		if !isSupportedArchive(fileHeader.Filename) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "unsupported archive type"})
		}
	}

	job := &models.AnalysisJob{
		ProductID:      &productID,
		EngagementID:   engagementID,
		Status:         models.AnalysisJobQueued,
		Scanners:       scanners,
		CreatedBy:      uploaderID,
		IdempotencyKey: nil,
		TenantID:       tenantID,
	}
	if idempotencyKey != "" {
		job.IdempotencyKey = &idempotencyKey
	}
	job.PrepareForInsert()

	if hasSnapshot {
		snapshot, err := storage.GetProductSourceSnapshotByID(c.Context(), h.db, *sourceSnapshotID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load source snapshot"})
		}
		if snapshot == nil {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "source snapshot not found"})
		}
		if snapshot.ProductID != productID {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "source snapshot does not match product"})
		}
		if !snapshot.TenantID.Valid || snapshot.TenantID.UUID != *tenantID {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "source snapshot does not belong to tenant"})
		}
		job.SourceSnapshotID = sourceSnapshotID
		job.ArchiveSize = snapshot.ArchiveSize
	} else {
		job.ArchiveSize = fileHeader.Size
		archiveKey := fmt.Sprintf("analysis/%s/source/archive%s", job.ID.String(), filepath.Ext(fileHeader.Filename))
		job.ArchiveKey = &archiveKey

		file, err := fileHeader.Open()
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "failed to read archive"})
		}
		defer file.Close()

		if err := h.store.PutObject(c.Context(), archiveKey, file, fileHeader.Size, "application/octet-stream"); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store archive"})
		}
	}

	if err := storage.CreateAnalysisJob(c.Context(), h.db, job); err != nil {
		if job.ArchiveKey != nil {
			_ = h.store.DeleteObject(c.Context(), *job.ArchiveKey)
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create analysis job"})
	}

	payload := fiber.Map{
		"job_id":     job.ID.String(),
		"product_id": productID.String(),
		"actor":      uploaderID.String(),
		"scanners":   scanners,
		"status":     job.Status,
		"created_at": job.CreatedAt.Format(time.RFC3339),
	}
	if job.SourceSnapshotID != nil {
		payload["source_snapshot_id"] = job.SourceSnapshotID.String()
	}
	_ = h.publisher.PublishJSON(c.Context(), "analysis.requested", payload)
	_ = h.publisher.PublishJSON(c.Context(), events.AnalysisJobsSubject, payload)

	return c.Status(http.StatusAccepted).JSON(fiber.Map{
		"success": true,
		"data":    AnalysisJobCreateResponse{ID: job.ID.String(), Status: job.Status},
	})
}

func (h *AnalysisJobsHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), analysisDefaultLimit)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	items, total, err := storage.ListAnalysisJobs(c.Context(), h.db, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch analysis jobs"})
	}

	response := make([]AnalysisJobResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapAnalysisJobListItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *AnalysisJobsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid analysis job id"})
	}

	job, err := storage.GetAnalysisJobByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch analysis job"})
	}
	if job == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "analysis job not found"})
	}

	resp := mapAnalysisJobDetail(*job)
	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

func (h *AnalysisJobsHandler) DownloadArtifact(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid analysis job id"})
	}
	artifact := strings.ToLower(strings.TrimSpace(c.Params("artifact")))

	job, err := storage.GetAnalysisJobByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch analysis job"})
	}
	if job == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "analysis job not found"})
	}

	var key *string
	var filename string
	switch artifact {
	case "semgrep":
		if job.ArtifactSemgrep.Valid {
			key = &job.ArtifactSemgrep.String
		}
		filename = "result_semgrep.json"
	case "trivy":
		if job.ArtifactTrivy.Valid {
			key = &job.ArtifactTrivy.String
		}
		filename = "trivy_result.json"
	default:
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "unknown artifact"})
	}

	if key == nil || *key == "" {
		return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "artifact not ready"})
	}

	reader, err := h.store.GetObject(c.Context(), *key)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "artifact not found"})
	}
	defer reader.Close()

	c.Set("Content-Type", "application/json")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	return c.SendStream(reader, -1)
}

func mapAnalysisJobListItem(item storage.AnalysisJobListItem) AnalysisJobResponse {
	resp := AnalysisJobResponse{
		ID:              item.ID.String(),
		Status:          item.Status,
		Scanners:        item.Scanners,
		SemgrepStatus:   item.SemgrepStatus,
		TrivyStatus:     item.TrivyStatus,
		FindingsTotal:   item.FindingsTotal,
		FindingsNew:     item.FindingsNew,
		DuplicatesTotal: item.DuplicatesTotal,
		CreatedAt:       item.CreatedAt.Format(time.RFC3339),
	}
	if item.TenantID.Valid {
		value := item.TenantID.UUID.String()
		resp.TenantID = &value
	}
	if item.ProductID.Valid {
		value := item.ProductID.UUID.String()
		resp.ProductID = &value
	}
	if item.ProductName.Valid {
		value := item.ProductName.String
		resp.ProductName = &value
	}
	if item.EngagementID.Valid {
		value := item.EngagementID.UUID.String()
		resp.EngagementID = &value
	}
	if item.SourceSnapshotID.Valid {
		value := item.SourceSnapshotID.UUID.String()
		resp.SourceSnapshotID = &value
	}
	if item.StartedAt.Valid {
		value := item.StartedAt.Time.Format(time.RFC3339)
		resp.StartedAt = &value
	}
	if item.FinishedAt.Valid {
		value := item.FinishedAt.Time.Format(time.RFC3339)
		resp.FinishedAt = &value
		delta := item.FinishedAt.Time.Sub(item.CreatedAt).Seconds()
		resp.DurationSeconds = &delta
	}
	return resp
}

func mapAnalysisJobDetail(item storage.AnalysisJobDetail) AnalysisJobResponse {
	resp := mapAnalysisJobListItem(item.AnalysisJobListItem)
	resp.ArtifactSemgrep = item.ArtifactSemgrep.Valid
	resp.ArtifactTrivy = item.ArtifactTrivy.Valid
	if item.SemgrepImportJob.Valid {
		value := item.SemgrepImportJob.UUID.String()
		resp.SemgrepImportJobID = &value
	}
	if item.TrivyImportJob.Valid {
		value := item.TrivyImportJob.UUID.String()
		resp.TrivyImportJobID = &value
	}
	if item.ErrorMessage.Valid {
		value := item.ErrorMessage.String
		resp.ErrorMessage = &value
	}
	return resp
}

func parseScanners(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	output := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.ToLower(strings.TrimSpace(part))
		if value != "" {
			output = append(output, value)
		}
	}
	return output
}

func validateScanners(scanners []string) error {
	for _, scanner := range scanners {
		switch scanner {
		case "semgrep", "trivy":
		default:
			return fmt.Errorf("unsupported scanner: %s", scanner)
		}
	}
	return nil
}

func isSupportedArchive(filename string) bool {
	lower := strings.ToLower(filename)
	return strings.HasSuffix(lower, ".zip") || strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz")
}

func parseInt64WithDefault(raw string, fallback int64) int64 {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
