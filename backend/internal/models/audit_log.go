package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID             uuid.UUID
	TenantID       uuid.UUID
	OccurredAt     time.Time
	CreatedAt      time.Time
	ActorID        *uuid.UUID
	ActorType      string
	ActorEmail     *string
	Action         string
	TargetType     string
	TargetID       *string
	Scope          string
	ScopeID        *uuid.UUID
	RequestID      *string
	IdempotencyKey *string
	IP             *string
	UserAgent      *string
	DiffJSON       json.RawMessage
	MetadataJSON   json.RawMessage
	Payload        json.RawMessage
}

func (a *AuditLog) Validate() error {
	if a.Action == "" {
		return fmt.Errorf("action is required")
	}
	if a.TargetType == "" {
		return fmt.Errorf("target_type is required")
	}
	if a.Scope == "" {
		return fmt.Errorf("scope is required")
	}
	return nil
}

func (a *AuditLog) PrepareForInsert() {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.OccurredAt.IsZero() {
		a.OccurredAt = time.Now().UTC()
	}
	if len(a.DiffJSON) == 0 {
		a.DiffJSON = nil
	}
	if len(a.Payload) == 0 {
		a.Payload = []byte("{}")
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = a.OccurredAt
	}
	if len(a.MetadataJSON) == 0 {
		a.MetadataJSON = []byte("{}")
	}
}
