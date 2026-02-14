package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type auditDiff struct {
	Before interface{} `json:"before,omitempty"`
	After  interface{} `json:"after,omitempty"`
}

type auditEntryInput struct {
	Action         string
	TargetType     string
	TargetID       *string
	Scope          string
	ScopeID        *uuid.UUID
	ActorID        *uuid.UUID
	ActorType      string
	ActorEmail     *string
	Diff           auditDiff
	Metadata       map[string]interface{}
	TenantID       uuid.UUID
	RequestID      *string
	IdempotencyKey *string
	IP             *string
	UserAgent      *string
}

// backward-compatible helper used by non-admin handlers.
func writeAuditEntry(ctx context.Context, db *sql.DB, entry auditEntryInput, meta map[string]interface{}) {
	payload := map[string]interface{}{}
	if entry.Diff.Before != nil || entry.Diff.After != nil {
		payload["diff"] = map[string]interface{}{
			"before": entry.Diff.Before,
			"after":  entry.Diff.After,
		}
	}
	if meta != nil {
		payload["meta"] = meta
	}

	_ = createAuditLog(ctx, db, &models.AuditLog{
		TenantID:   entry.TenantID,
		ActorID:    entry.ActorID,
		ActorType:  entry.ActorType,
		Action:     entry.Action,
		TargetType: entry.TargetType,
		TargetID:   entry.TargetID,
		Scope:      entry.Scope,
		ScopeID:    entry.ScopeID,
	}, payload)
}

func writeAdminAuditAndEvent(ctx context.Context, db *sql.DB, publisher *events.Publisher, entry auditEntryInput, meta map[string]interface{}) {
	metadata := map[string]interface{}{}
	for k, v := range meta {
		metadata[k] = v
	}
	for k, v := range entry.Metadata {
		metadata[k] = v
	}

	var diffObj map[string]interface{}
	if entry.Diff.Before != nil || entry.Diff.After != nil {
		diffObj = map[string]interface{}{"before": entry.Diff.Before, "after": entry.Diff.After}
	}
	diffRaw, _ := json.Marshal(diffObj)
	metadataRaw, _ := json.Marshal(metadata)

	audit := &models.AuditLog{
		TenantID:       entry.TenantID,
		ActorID:        entry.ActorID,
		ActorType:      entry.ActorType,
		ActorEmail:     entry.ActorEmail,
		Action:         entry.Action,
		TargetType:     entry.TargetType,
		TargetID:       entry.TargetID,
		Scope:          entry.Scope,
		ScopeID:        entry.ScopeID,
		RequestID:      entry.RequestID,
		IdempotencyKey: entry.IdempotencyKey,
		IP:             entry.IP,
		UserAgent:      entry.UserAgent,
		OccurredAt:     time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
		DiffJSON:       diffRaw,
		MetadataJSON:   metadataRaw,
		Payload:        metadataRaw,
	}
	if err := createAuditLog(ctx, db, audit, metadata); err != nil {
		return
	}

	evt := events.AdminAuditEvent{
		EventID:        audit.ID,
		OccurredAt:     audit.CreatedAt,
		TenantID:       entry.TenantID,
		Action:         entry.Action,
		RequestID:      deref(entry.RequestID),
		IdempotencyKey: entry.IdempotencyKey,
		Target:         events.AdminAuditTarget{Type: entry.TargetType, ID: entry.TargetID},
		Actor:          events.AdminAuditActor{Type: entry.ActorType, Email: entry.ActorEmail},
		Metadata:       metadata,
	}
	if entry.ActorID != nil {
		id := entry.ActorID.String()
		evt.Actor.ID = &id
	}
	if diffObj != nil {
		evt.Diff = diffObj
	}
	_ = events.PublishAdminEvent(ctx, publisher, entry.Action, evt)
}

func policyAuditEntry(c *fiber.Ctx, db *sql.DB, publisher *events.Publisher, action, targetType string, targetID uuid.UUID, diff auditDiff) {
	tenantID := tenantIDFromContext(c)
	if tenantID == nil {
		return
	}
	meta := auditMetadataFromContext(c)
	writeAdminAuditAndEvent(c.Context(), db, publisher, auditEntryInput{
		Action:         action,
		TargetType:     targetType,
		TargetID:       stringPointer(targetID.String()),
		Scope:          "policy",
		ScopeID:        &targetID,
		ActorID:        userIDFromContext(c),
		ActorType:      "user",
		Diff:           diff,
		TenantID:       *tenantID,
		RequestID:      requestIDFromContext(c),
		IdempotencyKey: idempotencyKeyFromContext(c),
		IP:             optionalMetaString(meta["ip"]),
		UserAgent:      optionalMetaString(meta["user_agent"]),
	}, meta)
}

func idempotencyKeyFromContext(c *fiber.Ctx) *string {
	key := strings.TrimSpace(c.Get("Idempotency-Key"))
	if key == "" {
		return nil
	}
	return &key
}

func optionalMetaString(value interface{}) *string {
	s, ok := value.(string)
	if !ok || strings.TrimSpace(s) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(s)
	return &trimmed
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
