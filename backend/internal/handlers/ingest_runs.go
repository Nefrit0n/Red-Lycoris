package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"path/filepath"
	"time"

	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/objectstore"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type IngestRunsHandler struct {
	db        *sql.DB
	publisher *events.Publisher
	store     objectstore.Store
}

func NewIngestRunsHandler(db *sql.DB, publisher *events.Publisher, store objectstore.Store) *IngestRunsHandler {
	return &IngestRunsHandler{db: db, publisher: publisher, store: store}
}

type ingestInitReq struct {
	Provider  string                   `json:"provider"`
	Metadata  map[string]any           `json:"metadata"`
	Artifacts []storage.IngestArtifact `json:"artifacts"`
}

func (h *IngestRunsHandler) Init(c *fiber.Ctx) error {
	idKey := c.Get("X-Idempotency-Key")
	if idKey == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "X-Idempotency-Key required"})
	}
	orgID := c.Locals("integration_org_id").(uuid.UUID)
	projectID, ok := c.Locals("integration_project_id").(uuid.UUID)
	if !ok || projectID == uuid.Nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "project-scoped token required"})
	}
	var req ingestInitReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Provider != "gitlab" || len(req.Artifacts) == 0 {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "invalid ingest payload"})
	}
	metaRaw := storage.EncodeJSON(req.Metadata)
	sum := sha256.Sum256(metaRaw)
	metaHash := hex.EncodeToString(sum[:])
	existing, err := storage.FindIngestRunByIdempotency(c.Context(), h.db, orgID, projectID, idKey)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "idempotency lookup failed"})
	}
	if existing != nil {
		arts, _ := storage.ListRunArtifacts(c.Context(), h.db, existing.RunID)
		plan := h.buildUploadPlan(c, existing.RunID, arts)
		c.Set("X-Idempotency-Replayed", "true")
		return c.JSON(fiber.Map{"run_id": existing.RunID, "state": existing.Status, "upload_plan": plan})
	}
	runID := uuid.New()
	now := time.Now().UTC()
	run := storage.IngestRun{RunID: runID, OrgID: orgID, ProjectID: projectID, Status: "INIT", XIdempotencyKey: idKey, MetadataJSONB: metaRaw, MetadataSHA256: metaHash, CreatedAt: now}
	artifacts := make([]storage.IngestArtifact, 0, len(req.Artifacts))
	for _, a := range req.Artifacts {
		a.ID = uuid.New()
		a.RunID = runID
		a.OrgID = orgID
		a.ProjectID = projectID
		a.ObjectKey = filepath.Join("ingest", orgID.String(), projectID.String(), runID.String(), a.Path)
		artifacts = append(artifacts, a)
	}
	if err := storage.CreateIngestRunWithArtifacts(c.Context(), h.db, run, artifacts); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "create run failed"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"run_id": runID, "state": "UPLOADING", "upload_plan": h.buildUploadPlan(c, runID, artifacts)})
}

func (h *IngestRunsHandler) buildUploadPlan(c *fiber.Ctx, runID uuid.UUID, arts []storage.IngestArtifact) []fiber.Map {
	plan := make([]fiber.Map, 0, len(arts))
	for _, a := range arts {
		if a.SizeBytes <= 64*1024*1024 {
			u, _ := h.store.PresignPut(c.Context(), a.ObjectKey, 15*time.Minute)
			plan = append(plan, fiber.Map{"artifact_path": a.Path, "object_key": a.ObjectKey, "upload_mode": "presigned_put", "put_url": u})
			continue
		}
		parts := int((a.SizeBytes + (16*1024*1024 - 1)) / (16 * 1024 * 1024))
		uploadID, completeURL, abortURL, partURLs, _ := h.store.CreateMultipartPlan(c.Context(), a.ObjectKey, parts, 30*time.Minute)
		pp := make([]fiber.Map, 0, len(partURLs))
		for _, p := range partURLs {
			pp = append(pp, fiber.Map{"part_number": p.PartNumber, "url": p.URL})
		}
		plan = append(plan, fiber.Map{"artifact_path": a.Path, "object_key": a.ObjectKey, "upload_mode": "multipart", "multipart": fiber.Map{"upload_id": uploadID, "complete_url": completeURL, "abort_url": abortURL, "parts": pp}})
	}
	return plan
}

func (h *IngestRunsHandler) Get(c *fiber.Ctx) error {
	runID, err := uuid.Parse(c.Params("run_id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid run_id"})
	}
	r, err := storage.GetIngestRun(c.Context(), h.db, runID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "lookup failed"})
	}
	if r == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(r)
}

func (h *IngestRunsHandler) Commit(c *fiber.Ctx) error {
	runID, err := uuid.Parse(c.Params("run_id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid run_id"})
	}
	run, err := storage.GetIngestRun(c.Context(), h.db, runID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "lookup failed"})
	}
	if run == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	arts, err := storage.ListRunArtifacts(c.Context(), h.db, runID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "artifacts lookup failed"})
	}
	for _, a := range arts {
		sz, _, err := h.store.StatObject(c.Context(), a.ObjectKey)
		if err != nil || sz != a.SizeBytes {
			return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "artifact missing or inconsistent", "path": a.Path})
		}
	}
	committedAt, err := storage.MarkRunCommitted(c.Context(), h.db, runID)
	if err != nil {
		return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "cannot commit"})
	}
	_ = h.publisher.PublishJSON(c.Context(), "ingest.run_committed.v1", map[string]any{"run_id": runID, "org_id": run.OrgID, "project_id": run.ProjectID, "committed_at": committedAt})
	return c.JSON(fiber.Map{"run_id": runID, "status": "COMMITTED", "committed_at": committedAt})
}
