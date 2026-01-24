package handlers

import (
	"context"
	"database/sql"

	"lotus-warden/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type auditDiff struct {
	Before interface{} `json:"before,omitempty"`
	After  interface{} `json:"after,omitempty"`
}

type auditEntryInput struct {
	Action     string
	TargetType string
	TargetID   *string
	Scope      string
	ScopeID    *uuid.UUID
	ActorID    *uuid.UUID
	ActorType  string
	Diff       auditDiff
}

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
		ActorID:    entry.ActorID,
		ActorType:  entry.ActorType,
		Action:     entry.Action,
		TargetType: entry.TargetType,
		TargetID:   entry.TargetID,
		Scope:      entry.Scope,
		ScopeID:    entry.ScopeID,
	}, payload)
}

func policyAuditEntry(c *fiber.Ctx, db *sql.DB, action, targetType string, targetID uuid.UUID, diff auditDiff) {
	writeAuditEntry(c.Context(), db, auditEntryInput{
		Action:     action,
		TargetType: targetType,
		TargetID:   stringPointer(targetID.String()),
		Scope:      "policy",
		ScopeID:    &targetID,
		ActorID:    userIDFromContext(c),
		ActorType:  "user",
		Diff:       diff,
	}, auditMetadataFromContext(c))
}
