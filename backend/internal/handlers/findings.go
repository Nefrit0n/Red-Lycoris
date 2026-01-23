package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	v1dto "lotus-warden/backend/internal/dto/v1"
	v1mapper "lotus-warden/backend/internal/mapper/v1"
	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// FindingsHandler handles finding-related HTTP requests
type FindingsHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

// Request types

type CreateFindingRequest struct {
	Title       string  `json:"title" validate:"required,max=200"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Severity    string  `json:"severity" validate:"required"`
	Status      string  `json:"status,omitempty"`
	Category    *string `json:"category,omitempty"`
	ProductID   string  `json:"productId" validate:"required,uuid4"`
	TenantID    *string `json:"tenantId,omitempty" validate:"omitempty,uuid4"`
}

type UpdateFindingRequest struct {
	Title       *string `json:"title,omitempty" validate:"omitempty,max=200"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Severity    *string `json:"severity,omitempty"`
	Status      *string `json:"status,omitempty"`
	ProductID   *string `json:"productId,omitempty" validate:"omitempty,uuid4"`
	AssigneeID  *string `json:"assigneeId,omitempty" validate:"omitempty,uuid4"`
}

type CreateCommentRequest struct {
	Body string `json:"body" validate:"required,max=2000"`
}

type BulkActionRequest struct {
	IDs       []string               `json:"ids"`
	SelectAll bool                   `json:"select_all"`
	Filters   *BulkActionFilters     `json:"filters,omitempty"`
	Action    string                 `json:"action" validate:"required"`
	Payload   map[string]interface{} `json:"payload"`
}

type BulkActionFilters struct {
	ProductID        *string `json:"productId,omitempty" validate:"omitempty,uuid4"`
	Product          *string `json:"product,omitempty" validate:"omitempty,max=200"`
	Severity         string  `json:"severity,omitempty"`
	Status           string  `json:"status,omitempty"`
	OccurrenceStatus string  `json:"occurrenceStatus,omitempty"`
	ScannerType      string  `json:"scannerType,omitempty"`
	SourceType       string  `json:"sourceType,omitempty"`
	Query            string  `json:"q,omitempty"`
	ImportJobID      *string `json:"import_job_id,omitempty" validate:"omitempty,uuid4"`
	TenantID         *string `json:"tenantId,omitempty" validate:"omitempty,uuid4"`
	DateFrom         *string `json:"dateFrom,omitempty"`
	DateTo           *string `json:"dateTo,omitempty"`
	CanonicalOnly    *bool   `json:"canonicalOnly,omitempty"`
	IncludeRepeats   *bool   `json:"includeRepeats,omitempty"`
}

type BulkActionResponse struct {
	AffectedCount int64            `json:"affectedCount"`
	SampleIDs     []string         `json:"sampleIds,omitempty"`
	PrevStatuses  []BulkPrevStatus `json:"prevStatuses,omitempty"`
}

type BulkPrevStatus struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// NewFindingsHandler creates a new FindingsHandler
func NewFindingsHandler(db *sql.DB) *FindingsHandler {
	return &FindingsHandler{db: db, validator: validator.New()}
}

// List returns a paginated list of findings
// @Summary List findings
// @Description Get paginated findings list
// @Tags findings
// @Produce json
// @Param page query int false "Page number"
// @Param pageSize query int false "Page size"
// @Param severity query string false "Severity"
// @Param status query string false "Status"
// @Param productId query string false "Product ID"
// @Param sortField query string false "Sort field"
// @Param sortOrder query string false "Sort order"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /api/v1/findings [get]
func (h *FindingsHandler) List(c *fiber.Ctx) error {
	limit, offset, err := parsePagination(c)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	filterParams, err := parseFindingFiltersFromQuery(c, h.db)
	if err != nil {
		return respondWithFilterError(c, err)
	}

	filters := filterParams.toStorageFilters(limit, offset)
	items, total, err := storage.ListFindings(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch findings"})
	}

	ids := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	intelSummaries, err := storage.GetIntelSummaries(c.Context(), h.db, ids)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch intel summaries"})
	}

	response := make([]v1dto.FindingListItemDTO, 0, len(items))
	for _, item := range items {
		mapped := v1mapper.FindingListItem(item)
		if summary, ok := intelSummaries[item.ID]; ok {
			mapped.IntelSummary = v1mapper.IntelSummary(summary)
		}
		response = append(response, mapped)
	}

		severityCounts, err := storage.CountFindingsBySeverity(
		c.Context(),
		h.db,
		filterParams.toStorageFilters(1, 0),
	)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to compute findings stats"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    response,
		"total":   total,
		"meta": fiber.Map{
			"severityCounts": severityCounts,
		},
	})
}

// Get returns a single finding by ID
// @Summary Get finding
// @Description Get a finding by ID
// @Tags findings
// @Produce json
// @Param id path string true "Finding ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Router /api/v1/findings/{id} [get]
func (h *FindingsHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	finding, err := storage.GetFindingByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch finding"})
	}
	if finding == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	masterID := finding.ID
	if finding.DuplicateID.Valid {
		masterID = finding.DuplicateID.UUID
		if masterID != finding.ID {
			masterFinding, err := storage.GetFindingByID(c.Context(), h.db, masterID)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch finding"})
			}
			if masterFinding == nil {
				return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
			}
			finding = masterFinding
		}
	}

	comments, err := storage.ListFindingComments(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch comments"})
	}
	events, err := storage.ListFindingEvents(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch events"})
	}
	duplicates, err := storage.GetFindingDuplicateGroup(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch duplicates"})
	}
	occurrences, err := storage.ListFindingOccurrences(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch occurrences"})
	}
	scaDetail, err := storage.GetScaFindingDetail(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch sca details"})
	}
	intelDetail, err := storage.GetIntelDetail(c.Context(), h.db, masterID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch intel details"})
	}
	intelSummaryMap, err := storage.GetIntelSummaries(c.Context(), h.db, []uuid.UUID{masterID})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch intel summary"})
	}

	mappedEvents := v1mapper.FindingEvents(events)
	mappedFinding := v1mapper.FindingDetail(*finding)
	evidence := v1mapper.DecodeEvidencePayload(finding.Evidence)
	if evidence == nil {
		evidence = v1mapper.LatestImportedEvidence(mappedEvents)
	}
	if summary, ok := intelSummaryMap[masterID]; ok {
		mappedFinding.IntelSummary = v1mapper.IntelSummary(summary)
	}

	resp := v1dto.FindingDetailDTO{
		FindingListItemDTO: mappedFinding.FindingListItemDTO,
		Description:        mappedFinding.Description,
		Fingerprint:        mappedFinding.Fingerprint,
		SourceType:         mappedFinding.SourceType,
		SourceVersion:      mappedFinding.SourceVersion,
		EndpointMethod:     mappedFinding.EndpointMethod,
		EndpointPath:       mappedFinding.EndpointPath,
		DeletedAt:          mappedFinding.DeletedAt,
		Comments:           v1mapper.FindingComments(comments),
		Events:             mappedEvents,
		Occurrences:        v1mapper.FindingOccurrences(occurrences),
		Duplicates:         v1mapper.DuplicateGroup(duplicates),
		Evidence:           evidence,
		Details:            v1mapper.FindingCategoryDetails(mappedFinding.Category, evidence, scaDetail),
		ScaDetails:         v1mapper.ScaDetail(scaDetail, evidence),
		IntelDetails:       v1mapper.IntelDetail(intelDetail),
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

// Neighbors returns the previous and next finding IDs within the same filtered list
// @Summary Get finding neighbors
// @Description Get previous/next finding IDs within the same filtered list
// @Tags findings
// @Produce json
// @Param id path string true "Finding ID"
// @Param severity query string false "Severity"
// @Param status query string false "Status"
// @Param productId query string false "Product ID"
// @Param product query string false "Product identifier"
// @Param sortField query string false "Sort field"
// @Param sortOrder query string false "Sort order"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Router /api/v1/findings/{id}/neighbors [get]
func (h *FindingsHandler) Neighbors(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	filterParams, err := parseFindingFiltersFromQuery(c, h.db)
	if err != nil {
		return respondWithFilterError(c, err)
	}

	filters := filterParams.toStorageFiltersWithoutPagination()
	neighbors, err := storage.GetFindingNeighbors(c.Context(), h.db, id, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch neighbors"})
	}
	if neighbors == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	resp := v1dto.FindingNeighbors{
		Position: neighbors.Position,
		Total:    neighbors.Total,
	}
	if neighbors.PrevID != nil {
		value := neighbors.PrevID.String()
		resp.PrevID = &value
	}
	if neighbors.NextID != nil {
		value := neighbors.NextID.String()
		resp.NextID = &value
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

// Create creates a new finding
// @Summary Create finding
// @Description Create a new finding
// @Tags findings
// @Accept json
// @Produce json
// @Param payload body CreateFindingRequest true "Finding payload"
// @Success 201 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Router /api/v1/findings [post]
func (h *FindingsHandler) Create(c *fiber.Ctx) error {
	var req CreateFindingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	if err := validateFindingSeverity(req.Severity); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	category := models.CategorySAST
	if req.Category != nil && strings.TrimSpace(*req.Category) != "" {
		category = strings.TrimSpace(*req.Category)
		if err := validateFindingCategory(category); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "new"
	}
	if err := validateFindingStatus(status); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	productID := uuid.MustParse(req.ProductID)
	finding := &models.Finding{
		ProductID:   &productID,
		Title:       req.Title,
		Description: req.Description,
		Severity:    req.Severity,
		Status:      status,
		Category:    category,
		Fingerprint: uuid.NewString(),
	}
	if req.TenantID != nil && strings.TrimSpace(*req.TenantID) != "" {
		if parsed, err := uuid.Parse(strings.TrimSpace(*req.TenantID)); err == nil {
			finding.TenantID = &parsed
		}
	}

	if err := storage.CreateFinding(c.Context(), h.db, finding); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create finding"})
	}

	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Action:     "finding.created",
		TargetType: "finding",
		TargetID:   stringPointer(finding.ID.String()),
		Scope:      "product",
		ScopeID:    finding.ProductID,
	}, map[string]interface{}{
		"title":    finding.Title,
		"severity": finding.Severity,
		"status":   finding.Status,
		"meta":     auditMetadataFromContext(c),
	})

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data":    v1mapper.FindingFromModel(*finding),
	})
}

// Update updates a finding by ID
// @Summary Update finding
// @Description Update finding by ID
// @Tags findings
// @Accept json
// @Produce json
// @Param id path string true "Finding ID"
// @Param payload body UpdateFindingRequest true "Finding payload"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Router /api/v1/findings/{id} [put]
func (h *FindingsHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	var req UpdateFindingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	isAdmin := middleware.HasRole(c, "admin")
	isAnalyst := middleware.HasRole(c, "analyst")
	if !isAdmin && !isAnalyst {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}

	if !isAdmin {
		if req.Title != nil || req.Severity != nil || req.ProductID != nil || req.AssigneeID != nil {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "analyst can only update status or description"})
		}
	}

	if req.Severity != nil {
		if err := validateFindingSeverity(*req.Severity); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}
	if req.Status != nil {
		if err := validateFindingStatus(*req.Status); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	var productID *uuid.UUID
	if req.ProductID != nil {
		parsed := uuid.MustParse(*req.ProductID)
		productID = &parsed
	}
	var assigneeID *uuid.UUID
	if req.AssigneeID != nil {
		parsed := uuid.MustParse(*req.AssigneeID)
		assigneeID = &parsed
	}

	current, err := storage.GetFindingByID(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch finding"})
	}
	if current == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	updated, err := storage.UpdateFinding(c.Context(), h.db, id, storage.UpdateFindingParams{
		Title:       req.Title,
		Description: req.Description,
		Severity:    req.Severity,
		Status:      req.Status,
		ProductID:   productID,
		AssigneeID:  assigneeID,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update finding"})
	}
	if updated == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	if req.Status != nil && *req.Status != current.Status {
		_ = createFindingEvent(c, h.db, id, "status_changed", fiber.Map{
			"from": current.Status,
			"to":   *req.Status,
		})
	}
	if req.AssigneeID != nil {
		prevAssignee := ""
		if current.AssigneeID.Valid {
			prevAssignee = current.AssigneeID.UUID.String()
		}
		nextAssignee := ""
		if assigneeID != nil {
			nextAssignee = assigneeID.String()
		}
		if prevAssignee != nextAssignee {
			_ = createFindingEvent(c, h.db, id, "assignee_changed", fiber.Map{
				"from": prevAssignee,
				"to":   nextAssignee,
			})
		}
	}

	if auditPayload := buildFindingAuditChanges(current, req, false); auditPayload != nil {
		scopeID := updated.ProductID
		_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
			ActorID:    userIDFromContext(c),
			ActorType:  "user",
			Action:     "finding.updated",
			TargetType: "finding",
			TargetID:   stringPointer(updated.ID.String()),
			Scope:      "product",
			ScopeID:    scopeID,
		}, map[string]interface{}{
			"changes": auditPayload,
			"meta":    auditMetadataFromContext(c),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": v1mapper.FindingFromModel(*updated)})
}

// Delete soft deletes a finding
// @Summary Delete finding
// @Description Soft delete a finding
// @Tags findings
// @Produce json
// @Param id path string true "Finding ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Router /api/v1/findings/{id} [delete]
func (h *FindingsHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	deleted, err := storage.SoftDeleteFinding(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to delete finding"})
	}
	if deleted == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	_ = createFindingEvent(c, h.db, id, "deleted", fiber.Map{
		"deleted_at": deleted.DeletedAt.Format(timeFormatRFC3339()),
	})
	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Action:     "finding.deleted",
		TargetType: "finding",
		TargetID:   stringPointer(deleted.ID.String()),
		Scope:      "product",
		ScopeID:    deleted.ProductID,
	}, map[string]interface{}{
		"deleted_at": deleted.DeletedAt.Format(timeFormatRFC3339()),
		"meta":       auditMetadataFromContext(c),
	})

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": v1mapper.FindingFromModel(*deleted)})
}

// AddComment adds a comment to a finding
func (h *FindingsHandler) AddComment(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	var req CreateCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	authorID := userIDFromContext(c)
	comment := &models.FindingComment{
		FindingID: id,
		AuthorID:  authorID,
		Body:      strings.TrimSpace(req.Body),
	}
	if err := storage.CreateFindingComment(c.Context(), h.db, comment); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create comment"})
	}
	_ = createFindingEvent(c, h.db, id, "comment_added", fiber.Map{
		"comment_id": comment.ID.String(),
	})
	scopeID := (*uuid.UUID)(nil)
	if finding, err := storage.GetFindingByID(c.Context(), h.db, id); err == nil && finding != nil && finding.ProductID.Valid {
		scopeID = &finding.ProductID.UUID
	}
	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    authorID,
		ActorType:  "user",
		Action:     "finding.comment.created",
		TargetType: "finding",
		TargetID:   stringPointer(id.String()),
		Scope:      "product",
		ScopeID:    scopeID,
	}, map[string]interface{}{
		"comment_id": comment.ID.String(),
		"meta":       auditMetadataFromContext(c),
	})

	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true})
}

// GetDuplicates returns the duplicate group for a finding
func (h *FindingsHandler) GetDuplicates(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	group, err := storage.GetFindingDuplicateGroup(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch duplicates"})
	}
	if group == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": v1mapper.DuplicateGroup(group)})
}

// MakeMaster promotes a duplicate finding to be the master of its group
func (h *FindingsHandler) MakeMaster(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	isAdmin := middleware.HasRole(c, "admin")
	isAnalyst := middleware.HasRole(c, "analyst")
	if !isAdmin && !isAnalyst {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}

	tx, err := h.db.BeginTx(c.Context(), nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to start transaction"})
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var duplicateID uuid.NullUUID
	row := tx.QueryRowContext(c.Context(), `SELECT duplicate_id FROM findings WHERE id = $1 AND deleted_at IS NULL`, id)
	if scanErr := row.Scan(&duplicateID); scanErr != nil {
		if scanErr == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch finding"})
	}

	if !duplicateID.Valid {
		return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "message": "already master"})
	}

	oldMasterID := duplicateID.UUID
	if _, err = tx.ExecContext(c.Context(), `UPDATE findings SET duplicate_id = NULL, status = $1 WHERE id = $2`, models.StatusUnderReview, id); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to promote master"})
	}
	if _, err = tx.ExecContext(c.Context(), `UPDATE findings SET duplicate_id = $1, status = $2 WHERE duplicate_id = $3 AND id <> $1`, id, models.StatusDuplicate, oldMasterID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to reassign duplicates"})
	}
	if _, err = tx.ExecContext(c.Context(), `UPDATE findings SET duplicate_id = $1, status = $2 WHERE id = $3`, id, models.StatusDuplicate, oldMasterID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to reassign master"})
	}

	if err = tx.Commit(); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to save master"})
	}

	_ = createFindingEvent(c, h.db, id, "duplicate_promoted", fiber.Map{
		"previous_master": oldMasterID.String(),
	})
	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Action:     "finding.duplicate.promoted",
		TargetType: "finding",
		TargetID:   stringPointer(id.String()),
		Scope:      "product",
		ScopeID:    nil,
	}, map[string]interface{}{
		"previous_master": oldMasterID.String(),
		"meta":            auditMetadataFromContext(c),
	})

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true})
}

// UnlinkDuplicate removes a finding from its duplicate group
func (h *FindingsHandler) UnlinkDuplicate(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid finding id"})
	}

	isAdmin := middleware.HasRole(c, "admin")
	isAnalyst := middleware.HasRole(c, "analyst")
	if !isAdmin && !isAnalyst {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}

	result, err := h.db.ExecContext(c.Context(), `UPDATE findings SET duplicate_id = NULL, status = $1 WHERE id = $2 AND deleted_at IS NULL`, models.StatusUnderReview, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to unlink duplicate"})
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "finding not found"})
	}

	_ = createFindingEvent(c, h.db, id, "duplicate_unlinked", fiber.Map{})
	_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Action:     "finding.duplicate.unlinked",
		TargetType: "finding",
		TargetID:   stringPointer(id.String()),
		Scope:      "product",
		ScopeID:    nil,
	}, map[string]interface{}{
		"meta": auditMetadataFromContext(c),
	})

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true})
}
