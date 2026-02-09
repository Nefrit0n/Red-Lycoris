package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AuditLogHandler struct {
	db *sql.DB
}

type AuditLogResponse struct {
	ID         string                 `json:"id"`
	OccurredAt string                 `json:"occurredAt"`
	ActorID    *string                `json:"actorId,omitempty"`
	ActorName  *string                `json:"actorName,omitempty"`
	ActorType  *string                `json:"actorType,omitempty"`
	Action     string                 `json:"action"`
	TargetType string                 `json:"targetType"`
	TargetID   *string                `json:"targetId,omitempty"`
	Scope      string                 `json:"scope"`
	ScopeID    *string                `json:"scopeId,omitempty"`
	Payload    map[string]interface{} `json:"payload"`
}

func NewAuditLogHandler(db *sql.DB) *AuditLogHandler {
	return &AuditLogHandler{db: db}
}

func (h *AuditLogHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), 50)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	filters := storage.AuditLogFilters{
		Limit:  limit,
		Offset: offset,
		Query:  strings.TrimSpace(c.Query("q")),
	}

	if fromRaw := strings.TrimSpace(c.Query("from")); fromRaw != "" {
		from, err := time.Parse(time.RFC3339, fromRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid from timestamp"})
		}
		filters.From = &from
	}
	if toRaw := strings.TrimSpace(c.Query("to")); toRaw != "" {
		to, err := time.Parse(time.RFC3339, toRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid to timestamp"})
		}
		filters.To = &to
	}
	if actorRaw := strings.TrimSpace(c.Query("actor_id")); actorRaw != "" {
		parsed, err := uuid.Parse(actorRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid actor_id"})
		}
		filters.ActorID = &parsed
	}
	if scopeRaw := strings.TrimSpace(c.Query("scope_id")); scopeRaw != "" {
		parsed, err := uuid.Parse(scopeRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid scope_id"})
		}
		filters.ScopeID = &parsed
	}

	filters.TargetType = strings.TrimSpace(c.Query("target_type"))
	filters.Action = strings.TrimSpace(c.Query("action"))

	items, total, err := storage.ListAuditLogs(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch audit logs"})
	}

	response := make([]AuditLogResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapAuditLogItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func mapAuditLogItem(item storage.AuditLogItem) AuditLogResponse {
	var actorID *string
	if item.ActorID.Valid {
		value := item.ActorID.UUID.String()
		actorID = &value
	}
	var actorName *string
	if item.ActorName.Valid {
		value := item.ActorName.String
		actorName = &value
	}
	var actorType *string
	if item.ActorType.Valid {
		value := item.ActorType.String
		actorType = &value
	}
	var targetID *string
	if item.TargetID.Valid {
		value := item.TargetID.String
		targetID = &value
	}
	var scopeID *string
	if item.ScopeID.Valid {
		value := item.ScopeID.UUID.String()
		scopeID = &value
	}
	payload := map[string]interface{}{}
	if len(item.Payload) > 0 {
		_ = json.Unmarshal(item.Payload, &payload)
	}

	return AuditLogResponse{
		ID:         item.ID.String(),
		OccurredAt: item.OccurredAt.Format(time.RFC3339),
		ActorID:    actorID,
		ActorName:  actorName,
		ActorType:  actorType,
		Action:     item.Action,
		TargetType: item.TargetType,
		TargetID:   targetID,
		Scope:      item.Scope,
		ScopeID:    scopeID,
		Payload:    payload,
	}
}

func createAuditLog(ctx context.Context, db *sql.DB, entry *models.AuditLog, payload map[string]interface{}) error {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	if entry.Payload == nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		entry.Payload = raw
	}
	return storage.CreateAuditLog(ctx, db, entry)
}

func auditMetadataFromContext(c *fiber.Ctx) map[string]interface{} {
	meta := map[string]interface{}{
		"ip":         c.IP(),
		"user_agent": c.Get("User-Agent"),
	}
	if requestID := strings.TrimSpace(c.Get("X-Request-Id")); requestID != "" {
		meta["request_id"] = requestID
	}
	return meta
}
