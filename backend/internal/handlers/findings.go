package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type FindingsHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

type FindingResponse struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Fingerprint *string `json:"fingerprint,omitempty"`
	Severity    string  `json:"severity"`
	Status      string  `json:"status"`
	ProductID   *string `json:"productId,omitempty"`
	ProductName *string `json:"productName,omitempty"`
	AssigneeID  *string `json:"assigneeId,omitempty"`
	ImportJobID *string `json:"importJobId,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	DeletedAt   *string `json:"deletedAt,omitempty"`
}

type FindingCommentResponse struct {
	ID        string  `json:"id"`
	AuthorID  *string `json:"authorId,omitempty"`
	Author    *string `json:"author,omitempty"`
	Body      string  `json:"body"`
	CreatedAt string  `json:"createdAt"`
}

type FindingEventResponse struct {
	ID        string                 `json:"id"`
	ActorID   *string                `json:"actorId,omitempty"`
	Actor     *string                `json:"actor,omitempty"`
	EventType string                 `json:"eventType"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt string                 `json:"createdAt"`
}

type FindingDetailResponse struct {
	FindingResponse
	Comments   []FindingCommentResponse `json:"comments"`
	Events     []FindingEventResponse   `json:"events"`
	Duplicates *DuplicateGroupResponse  `json:"duplicates,omitempty"`
}

type DuplicateGroupResponse struct {
	Master     FindingResponse   `json:"master"`
	Duplicates []FindingResponse `json:"duplicates"`
}

type CreateFindingRequest struct {
	Title       string  `json:"title" validate:"required,max=200"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
	Severity    string  `json:"severity" validate:"required"`
	Status      string  `json:"status,omitempty"`
	ProductID   string  `json:"productId" validate:"required,uuid4"`
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
	ProductID   *string `json:"productId,omitempty" validate:"omitempty,uuid4"`
	Product     *string `json:"product,omitempty" validate:"omitempty,max=200"`
	Severity    string  `json:"severity,omitempty"`
	Status      string  `json:"status,omitempty"`
	Query       string  `json:"q,omitempty"`
	ImportJobID *string `json:"import_job_id,omitempty" validate:"omitempty,uuid4"`
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

func NewFindingsHandler(db *sql.DB) *FindingsHandler {
	return &FindingsHandler{db: db, validator: validator.New()}
}

func resolveProductFilter(ctx context.Context, db *sql.DB, productIDParam string, productParam string) (*uuid.UUID, error) {
	if productIDParam != "" {
		parsed, err := uuid.Parse(productIDParam)
		if err != nil {
			return nil, fmt.Errorf("invalid product id")
		}
		return &parsed, nil
	}

	if productParam == "" {
		return nil, nil
	}

	if parsed, err := uuid.Parse(productParam); err == nil {
		return &parsed, nil
	}

	if product, err := storage.FindProductByIdentifier(ctx, db, productParam); err != nil {
		return nil, err
	} else if product != nil {
		return &product.ID, nil
	}

	if product, err := storage.FindProductBySlug(ctx, db, productParam); err != nil {
		return nil, err
	} else if product != nil {
		return &product.ID, nil
	}

	return nil, fmt.Errorf("product not found")
}

// ListFindings godoc
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
	limit := parseIntWithDefault(c.Query("limit"), 20)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		page := parseIntWithDefault(c.Query("page"), 1)
		pageSize := parseIntWithDefault(c.Query("pageSize"), 20)
		if page < 1 || pageSize < 1 || pageSize > 200 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
		}
		limit = pageSize
		offset = (page - 1) * pageSize
	}

	productID, err := resolveProductFilter(
		c.Context(),
		h.db,
		strings.TrimSpace(c.Query("productId")),
		strings.TrimSpace(c.Query("product")),
	)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	var importJobID *uuid.UUID
	if importJobParam := strings.TrimSpace(c.Query("import_job_id")); importJobParam != "" {
		parsed, err := uuid.Parse(importJobParam)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid import_job_id"})
		}
		importJobID = &parsed
	}

	filters := storage.FindingFilters{
		Severity:    strings.TrimSpace(c.Query("severity")),
		Status:      strings.TrimSpace(c.Query("status")),
		ProductID:   productID,
		ImportJobID: importJobID,
		Query:       strings.TrimSpace(c.Query("q")),
		SortField:   strings.TrimSpace(c.Query("sortField")),
		SortOrder:   strings.TrimSpace(c.Query("sortOrder")),
		Limit:       limit,
		Offset:      offset,
	}

	items, total, err := storage.ListFindings(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch findings"})
	}

	response := make([]FindingResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapFindingListItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

// GetFinding godoc
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

	comments, err := storage.ListFindingComments(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch comments"})
	}
	events, err := storage.ListFindingEvents(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch events"})
	}
	duplicates, err := storage.GetFindingDuplicateGroup(c.Context(), h.db, id)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch duplicates"})
	}

	resp := FindingDetailResponse{
		FindingResponse: mapFindingDetail(*finding),
		Comments:        mapFindingComments(comments),
		Events:          mapFindingEvents(events),
		Duplicates:      mapDuplicateGroup(duplicates),
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": resp})
}

// CreateFinding godoc
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
		Fingerprint: uuid.NewString(),
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
		"data":    mapFindingModel(*finding),
	})
}

// UpdateFinding godoc
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

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapFindingModel(*updated)})
}

// DeleteFinding godoc
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

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapFindingModel(*deleted)})
}

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

func (h *FindingsHandler) Bulk(c *fiber.Ctx) error {
	var req BulkActionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	if req.Filters != nil {
		if err := h.validator.Struct(req.Filters); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	isAdmin := middleware.HasRole(c, "admin")
	isAnalyst := middleware.HasRole(c, "analyst")
	if !isAdmin && !isAnalyst {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}

	if !req.SelectAll && len(req.IDs) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "ids or select_all required"})
	}

	const maxUndoSnapshots = 500
	const sampleSnapshotLimit = 25

	ids := []uuid.UUID{}
	if len(req.IDs) > 0 {
		for _, raw := range req.IDs {
			parsed, err := uuid.Parse(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid id in ids"})
			}
			ids = append(ids, parsed)
		}
	}

	var snapshots []storage.FindingSnapshot
	var filters storage.FindingFilters
	var totalMatches int

	if req.SelectAll {
		filterInput := req.Filters
		var productIDParam string
		var productParam string
		if filterInput != nil {
			if filterInput.ProductID != nil {
				productIDParam = strings.TrimSpace(*filterInput.ProductID)
			}
			if filterInput.Product != nil {
				productParam = strings.TrimSpace(*filterInput.Product)
			}
			filters.Severity = strings.TrimSpace(filterInput.Severity)
			filters.Status = strings.TrimSpace(filterInput.Status)
			filters.Query = strings.TrimSpace(filterInput.Query)
		}
		var err error
		filters.ProductID, err = resolveProductFilter(c.Context(), h.db, productIDParam, productParam)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		if filterInput != nil && filterInput.ImportJobID != nil && strings.TrimSpace(*filterInput.ImportJobID) != "" {
			parsed, err := uuid.Parse(strings.TrimSpace(*filterInput.ImportJobID))
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid import_job_id"})
			}
			filters.ImportJobID = &parsed
		}

		count, err := storage.CountFindingsByFilters(c.Context(), h.db, filters)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to count findings"})
		}
		totalMatches = count
		if totalMatches > 0 {
			limit := sampleSnapshotLimit
			if totalMatches <= maxUndoSnapshots {
				limit = totalMatches
			}
			snapshots, err = storage.ListFindingsByFilters(c.Context(), h.db, filters, limit)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch findings"})
			}
		}
	} else {
		var err error
		snapshots, err = storage.ListFindingsByIDs(c.Context(), h.db, ids)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch findings"})
		}
		totalMatches = len(snapshots)
	}

	var affectedCount int64
	switch req.Action {
	case "set_status":
		statusValue, _ := req.Payload["status"].(string)
		statusValue = strings.TrimSpace(statusValue)
		if err := validateFindingStatus(statusValue); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid status"})
		}
		var err error
		if req.SelectAll {
			affectedCount, err = storage.BulkUpdateFindingStatusByFilters(c.Context(), h.db, filters, statusValue)
		} else {
			affectedCount, err = storage.BulkUpdateFindingStatus(c.Context(), h.db, ids, statusValue)
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update findings"})
		}
		for _, snapshot := range snapshots {
			if snapshot.Status != statusValue {
				_ = createFindingEvent(c, h.db, snapshot.ID, "status_changed", fiber.Map{
					"from": snapshot.Status,
					"to":   statusValue,
					"bulk": true,
				})
				_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
					ActorID:    userIDFromContext(c),
					ActorType:  "user",
					Action:     "finding.updated",
					TargetType: "finding",
					TargetID:   stringPointer(snapshot.ID.String()),
					Scope:      "product",
					ScopeID:    nil,
				}, map[string]interface{}{
					"changes": map[string]interface{}{
						"status": map[string]interface{}{
							"from": snapshot.Status,
							"to":   statusValue,
						},
					},
					"bulk": true,
					"meta": auditMetadataFromContext(c),
				})
			}
		}
	case "assign":
		var assigneeID *uuid.UUID
		if value, ok := req.Payload["userId"].(string); ok && strings.TrimSpace(value) != "" {
			parsed, err := uuid.Parse(value)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid userId"})
			}
			assigneeID = &parsed
		}
		var err error
		if req.SelectAll {
			affectedCount, err = storage.BulkUpdateFindingAssigneeByFilters(c.Context(), h.db, filters, assigneeID)
		} else {
			affectedCount, err = storage.BulkUpdateFindingAssignee(c.Context(), h.db, ids, assigneeID)
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update assignee"})
		}
		for _, snapshot := range snapshots {
			prevAssignee := ""
			if snapshot.AssigneeID.Valid {
				prevAssignee = snapshot.AssigneeID.UUID.String()
			}
			nextAssignee := ""
			if assigneeID != nil {
				nextAssignee = assigneeID.String()
			}
			if prevAssignee != nextAssignee {
				_ = createFindingEvent(c, h.db, snapshot.ID, "assignee_changed", fiber.Map{
					"from": prevAssignee,
					"to":   nextAssignee,
					"bulk": true,
				})
				_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
					ActorID:    userIDFromContext(c),
					ActorType:  "user",
					Action:     "finding.updated",
					TargetType: "finding",
					TargetID:   stringPointer(snapshot.ID.String()),
					Scope:      "product",
					ScopeID:    nil,
				}, map[string]interface{}{
					"changes": map[string]interface{}{
						"assignee_id": map[string]interface{}{
							"from": prevAssignee,
							"to":   nextAssignee,
						},
					},
					"bulk": true,
					"meta": auditMetadataFromContext(c),
				})
			}
		}
	case "dismiss":
		statusValue, _ := req.Payload["status"].(string)
		statusValue = strings.TrimSpace(statusValue)
		if statusValue == "" {
			statusValue = models.StatusFalsePositive
		}
		if statusValue != models.StatusFalsePositive && statusValue != models.StatusOutOfScope {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid dismiss status"})
		}
		var err error
		if req.SelectAll {
			affectedCount, err = storage.BulkUpdateFindingStatusByFilters(c.Context(), h.db, filters, statusValue)
		} else {
			affectedCount, err = storage.BulkUpdateFindingStatus(c.Context(), h.db, ids, statusValue)
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update findings"})
		}
		for _, snapshot := range snapshots {
			if snapshot.Status != statusValue {
				_ = createFindingEvent(c, h.db, snapshot.ID, "status_changed", fiber.Map{
					"from": snapshot.Status,
					"to":   statusValue,
					"bulk": true,
				})
				_ = createAuditLog(c.Context(), h.db, &models.AuditLog{
					ActorID:    userIDFromContext(c),
					ActorType:  "user",
					Action:     "finding.updated",
					TargetType: "finding",
					TargetID:   stringPointer(snapshot.ID.String()),
					Scope:      "product",
					ScopeID:    nil,
				}, map[string]interface{}{
					"changes": map[string]interface{}{
						"status": map[string]interface{}{
							"from": snapshot.Status,
							"to":   statusValue,
						},
					},
					"bulk": true,
					"meta": auditMetadataFromContext(c),
				})
			}
		}
	default:
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "unsupported action"})
	}

	response := BulkActionResponse{
		AffectedCount: affectedCount,
	}
	if len(snapshots) > 0 {
		for _, snapshot := range snapshots {
			response.SampleIDs = append(response.SampleIDs, snapshot.ID.String())
		}
	}
	if req.Action == "set_status" || req.Action == "dismiss" {
		if !req.SelectAll || totalMatches <= maxUndoSnapshots {
			for _, snapshot := range snapshots {
				response.PrevStatuses = append(response.PrevStatuses, BulkPrevStatus{
					ID:     snapshot.ID.String(),
					Status: snapshot.Status,
				})
			}
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

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

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": mapDuplicateGroup(group)})
}

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

func mapFindingListItem(item storage.FindingListItem) FindingResponse {
	var productID *string
	if item.ProductID.Valid {
		value := item.ProductID.UUID.String()
		productID = &value
	}
	var productName *string
	if item.ProductName.Valid {
		value := item.ProductName.String
		productName = &value
	}
	var assigneeID *string
	if item.AssigneeID.Valid {
		value := item.AssigneeID.UUID.String()
		assigneeID = &value
	}
	var importJobID *string
	if item.ImportJobID.Valid {
		value := item.ImportJobID.UUID.String()
		importJobID = &value
	}
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		ProductName: productName,
		AssigneeID:  assigneeID,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
	}
}

func mapFindingDetail(item storage.FindingDetail) FindingResponse {
	var productID *string
	if item.ProductID.Valid {
		value := item.ProductID.UUID.String()
		productID = &value
	}
	var productName *string
	if item.ProductName.Valid {
		value := item.ProductName.String
		productName = &value
	}
	var deletedAt *string
	if item.DeletedAt.Valid {
		value := item.DeletedAt.Time.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	var assigneeID *string
	if item.AssigneeID.Valid {
		value := item.AssigneeID.UUID.String()
		assigneeID = &value
	}
	var importJobID *string
	if item.ImportJobID.Valid {
		value := item.ImportJobID.UUID.String()
		importJobID = &value
	}
	var description *string
	if item.Description.Valid {
		value := item.Description.String
		description = &value
	}
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: description,
		Fingerprint: &item.Fingerprint,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		ProductName: productName,
		AssigneeID:  assigneeID,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

func mapFindingModel(item models.Finding) FindingResponse {
	var productID *string
	if item.ProductID != nil {
		value := item.ProductID.String()
		productID = &value
	}
	var assigneeID *string
	if item.AssigneeID != nil {
		value := item.AssigneeID.String()
		assigneeID = &value
	}
	var importJobID *string
	if item.ImportJobID != nil {
		value := item.ImportJobID.String()
		importJobID = &value
	}
	var deletedAt *string
	if item.DeletedAt != nil {
		value := item.DeletedAt.Format(timeFormatRFC3339())
		deletedAt = &value
	}
	return FindingResponse{
		ID:          item.ID.String(),
		Title:       item.Title,
		Description: item.Description,
		Fingerprint: &item.Fingerprint,
		Severity:    item.Severity,
		Status:      item.Status,
		ProductID:   productID,
		AssigneeID:  assigneeID,
		ImportJobID: importJobID,
		CreatedAt:   item.CreatedAt.Format(timeFormatRFC3339()),
		UpdatedAt:   item.UpdatedAt.Format(timeFormatRFC3339()),
		DeletedAt:   deletedAt,
	}
}

func parseIntWithDefault(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func validateFindingSeverity(severity string) error {
	switch severity {
	case "low", "medium", "high", "critical":
		return nil
	default:
		return fmt.Errorf("invalid severity")
	}
}

func validateFindingStatus(status string) error {
	switch status {
	case "new",
		"under_review",
		"confirmed",
		"false_positive",
		"out_of_scope",
		"risk_accepted",
		"mitigated",
		"duplicate":
		return nil
	default:
		return fmt.Errorf("invalid status")
	}
}

func mapFindingComments(items []storage.FindingCommentItem) []FindingCommentResponse {
	comments := make([]FindingCommentResponse, 0, len(items))
	for _, item := range items {
		var authorID *string
		if item.AuthorID.Valid {
			value := item.AuthorID.UUID.String()
			authorID = &value
		}
		var author *string
		if item.AuthorUsername.Valid {
			value := item.AuthorUsername.String
			author = &value
		}
		comments = append(comments, FindingCommentResponse{
			ID:        item.ID.String(),
			AuthorID:  authorID,
			Author:    author,
			Body:      item.Body,
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
		})
	}
	return comments
}

func mapFindingCommentItem(item storage.FindingCommentItem) FindingCommentResponse {
	var authorID *string
	if item.AuthorID.Valid {
		value := item.AuthorID.UUID.String()
		authorID = &value
	}
	var author *string
	if item.AuthorUsername.Valid {
		value := item.AuthorUsername.String
		author = &value
	}
	return FindingCommentResponse{
		ID:        item.ID.String(),
		AuthorID:  authorID,
		Author:    author,
		Body:      item.Body,
		CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
	}
}

func mapFindingEvents(items []storage.FindingEventItem) []FindingEventResponse {
	events := make([]FindingEventResponse, 0, len(items))
	for _, item := range items {
		var actorID *string
		if item.ActorID.Valid {
			value := item.ActorID.UUID.String()
			actorID = &value
		}
		var actor *string
		if item.ActorUsername.Valid {
			value := item.ActorUsername.String
			actor = &value
		}
		payload := map[string]interface{}{}
		if len(item.Payload) > 0 {
			_ = json.Unmarshal(item.Payload, &payload)
		}
		events = append(events, FindingEventResponse{
			ID:        item.ID.String(),
			ActorID:   actorID,
			Actor:     actor,
			EventType: item.EventType,
			Payload:   payload,
			CreatedAt: item.CreatedAt.Format(timeFormatRFC3339()),
		})
	}
	return events
}

func mapDuplicateGroup(group *storage.DuplicateGroup) *DuplicateGroupResponse {
	if group == nil {
		return nil
	}
	duplicates := make([]FindingResponse, 0, len(group.Duplicates))
	for _, item := range group.Duplicates {
		duplicates = append(duplicates, mapFindingDetail(item))
	}
	return &DuplicateGroupResponse{
		Master:     mapFindingDetail(group.Master),
		Duplicates: duplicates,
	}
}

func createFindingEvent(c *fiber.Ctx, db *sql.DB, findingID uuid.UUID, eventType string, payload fiber.Map) error {
	actorID := userIDFromContext(c)
	jsonPayload, _ := json.Marshal(payload)
	event := &models.FindingEvent{
		FindingID: findingID,
		ActorID:   actorID,
		EventType: eventType,
		Payload:   jsonPayload,
	}
	return storage.CreateFindingEvent(c.Context(), db, event)
}

func stringPointer(value string) *string {
	return &value
}

func nullableUUID(value uuid.NullUUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	return &value.UUID
}

func buildFindingAuditChanges(current *storage.FindingDetail, req UpdateFindingRequest, isBulk bool) map[string]interface{} {
	changes := map[string]interface{}{}

	if req.Title != nil && current.Title != *req.Title {
		changes["title"] = map[string]interface{}{"from": current.Title, "to": *req.Title}
	}
	if req.Description != nil {
		currentDescription := ""
		if current.Description.Valid {
			currentDescription = current.Description.String
		}
		if currentDescription != *req.Description {
			changes["description"] = map[string]interface{}{"from": currentDescription, "to": *req.Description}
		}
	}
	if req.Severity != nil && current.Severity != *req.Severity {
		changes["severity"] = map[string]interface{}{"from": current.Severity, "to": *req.Severity}
	}
	if req.Status != nil && current.Status != *req.Status {
		changes["status"] = map[string]interface{}{"from": current.Status, "to": *req.Status}
	}
	if req.ProductID != nil {
		currentProductID := ""
		if current.ProductID.Valid {
			currentProductID = current.ProductID.UUID.String()
		}
		if currentProductID != *req.ProductID {
			changes["product_id"] = map[string]interface{}{"from": currentProductID, "to": *req.ProductID}
		}
	}
	if req.AssigneeID != nil {
		currentAssignee := ""
		if current.AssigneeID.Valid {
			currentAssignee = current.AssigneeID.UUID.String()
		}
		if currentAssignee != *req.AssigneeID {
			changes["assignee_id"] = map[string]interface{}{"from": currentAssignee, "to": *req.AssigneeID}
		}
	}
	if len(changes) == 0 {
		return nil
	}
	if isBulk {
		changes["bulk"] = true
	}
	return changes
}

func timeFormatRFC3339() string {
	return time.RFC3339
}
