package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"lotus-warden/backend/internal/middleware"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Bulk handles bulk operations on findings
func (h *FindingsHandler) Bulk(c *fiber.Ctx) error {
	// Parse and validate request
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

	// Check authorization
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

	// Parse IDs if provided
	var ids []uuid.UUID
	if len(req.IDs) > 0 {
		var err error
		ids, err = parseIDs(req.IDs)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	// Parse filters for select_all mode
	filters, err := parseBulkFilters(c, h.db, req.Filters)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	// Fetch snapshots for event/audit logging
	snapshots, totalMatches, err := fetchBulkSnapshots(
		c.Context(),
		h.db,
		req,
		filters,
		ids,
		maxUndoSnapshots,
		sampleSnapshotLimit,
	)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	// Execute the bulk action
	var affectedCount int64
	switch req.Action {
	case "set_status":
		affectedCount, err = executeBulkSetStatus(c, h.db, req, filters, ids, snapshots)
	case "assign":
		affectedCount, err = executeBulkAssign(c, h.db, req, filters, ids, snapshots)
	case "dismiss":
		affectedCount, err = executeBulkDismiss(c, h.db, req, filters, ids, snapshots)
	default:
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "unsupported action"})
	}

	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	// Build response
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

// fetchBulkSnapshots retrieves snapshots for bulk operations based on request parameters
func fetchBulkSnapshots(
	ctx context.Context,
	db *sql.DB,
	req BulkActionRequest,
	filters storage.FindingFilters,
	ids []uuid.UUID,
	maxUndoSnapshots int,
	sampleSnapshotLimit int,
) ([]storage.FindingSnapshot, int, error) {
	var snapshots []storage.FindingSnapshot
	var totalMatches int

	if req.SelectAll {
		count, err := storage.CountFindingsByFilters(ctx, db, filters)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to count findings")
		}
		totalMatches = count

		if totalMatches > 0 {
			limit := sampleSnapshotLimit
			if totalMatches <= maxUndoSnapshots {
				limit = totalMatches
			}
			snapshots, err = storage.ListFindingsByFilters(ctx, db, filters, limit)
			if err != nil {
				return nil, 0, fmt.Errorf("failed to fetch findings")
			}
		}
	} else {
		var err error
		snapshots, err = storage.ListFindingsByIDs(ctx, db, ids)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to fetch findings")
		}
		totalMatches = len(snapshots)
	}

	return snapshots, totalMatches, nil
}

// executeBulkSetStatus handles the set_status bulk action
func executeBulkSetStatus(
	c *fiber.Ctx,
	db *sql.DB,
	req BulkActionRequest,
	filters storage.FindingFilters,
	ids []uuid.UUID,
	snapshots []storage.FindingSnapshot,
) (int64, error) {
	statusValue, _ := req.Payload["status"].(string)
	statusValue = strings.TrimSpace(statusValue)

	if err := validateFindingStatus(statusValue); err != nil {
		return 0, fmt.Errorf("invalid status")
	}

	var affectedCount int64
	var err error
	if req.SelectAll {
		affectedCount, err = storage.BulkUpdateFindingStatusByFilters(c.Context(), db, filters, statusValue)
	} else {
		affectedCount, err = storage.BulkUpdateFindingStatus(c.Context(), db, ids, statusValue)
	}
	if err != nil {
		return 0, fmt.Errorf("failed to update findings")
	}

	for _, snapshot := range snapshots {
		recordStatusChange(c, db, snapshot, statusValue)
	}

	return affectedCount, nil
}

// executeBulkAssign handles the assign bulk action
func executeBulkAssign(
	c *fiber.Ctx,
	db *sql.DB,
	req BulkActionRequest,
	filters storage.FindingFilters,
	ids []uuid.UUID,
	snapshots []storage.FindingSnapshot,
) (int64, error) {
	var assigneeID *uuid.UUID
	if value, ok := req.Payload["userId"].(string); ok && strings.TrimSpace(value) != "" {
		parsed, err := uuid.Parse(value)
		if err != nil {
			return 0, fmt.Errorf("invalid userId")
		}
		assigneeID = &parsed
	}

	var affectedCount int64
	var err error
	if req.SelectAll {
		affectedCount, err = storage.BulkUpdateFindingAssigneeByFilters(c.Context(), db, filters, assigneeID)
	} else {
		affectedCount, err = storage.BulkUpdateFindingAssignee(c.Context(), db, ids, assigneeID)
	}
	if err != nil {
		return 0, fmt.Errorf("failed to update assignee")
	}

	for _, snapshot := range snapshots {
		recordAssigneeChange(c, db, snapshot, assigneeID)
	}

	return affectedCount, nil
}

// executeBulkDismiss handles the dismiss bulk action
func executeBulkDismiss(
	c *fiber.Ctx,
	db *sql.DB,
	req BulkActionRequest,
	filters storage.FindingFilters,
	ids []uuid.UUID,
	snapshots []storage.FindingSnapshot,
) (int64, error) {
	statusValue, _ := req.Payload["status"].(string)
	statusValue = strings.TrimSpace(statusValue)
	if statusValue == "" {
		statusValue = models.StatusFalsePositive
	}

	if statusValue != models.StatusFalsePositive && statusValue != models.StatusOutOfScope {
		return 0, fmt.Errorf("invalid dismiss status")
	}

	var affectedCount int64
	var err error
	if req.SelectAll {
		affectedCount, err = storage.BulkUpdateFindingStatusByFilters(c.Context(), db, filters, statusValue)
	} else {
		affectedCount, err = storage.BulkUpdateFindingStatus(c.Context(), db, ids, statusValue)
	}
	if err != nil {
		return 0, fmt.Errorf("failed to update findings")
	}

	for _, snapshot := range snapshots {
		recordStatusChange(c, db, snapshot, statusValue)
	}

	return affectedCount, nil
}

// recordStatusChange creates event and audit log for status changes
func recordStatusChange(c *fiber.Ctx, db *sql.DB, snapshot storage.FindingSnapshot, newStatus string) {
	if snapshot.Status == newStatus {
		return
	}

	_ = createFindingEvent(c, db, snapshot.ID, "status_changed", fiber.Map{
		"from": snapshot.Status,
		"to":   newStatus,
		"bulk": true,
	})

	_ = createAuditLog(c.Context(), db, &models.AuditLog{
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
				"to":   newStatus,
			},
		},
		"bulk": true,
		"meta": auditMetadataFromContext(c),
	})
}

// recordAssigneeChange creates event and audit log for assignee changes
func recordAssigneeChange(c *fiber.Ctx, db *sql.DB, snapshot storage.FindingSnapshot, newAssigneeID *uuid.UUID) {
	prevAssignee := ""
	if snapshot.AssigneeID.Valid {
		prevAssignee = snapshot.AssigneeID.UUID.String()
	}

	nextAssignee := ""
	if newAssigneeID != nil {
		nextAssignee = newAssigneeID.String()
	}

	if prevAssignee == nextAssignee {
		return
	}

	_ = createFindingEvent(c, db, snapshot.ID, "assignee_changed", fiber.Map{
		"from": prevAssignee,
		"to":   nextAssignee,
		"bulk": true,
	})

	_ = createAuditLog(c.Context(), db, &models.AuditLog{
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

// buildFindingAuditChanges builds a map of changes for audit logging
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

// createFindingEvent creates a finding event record
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
