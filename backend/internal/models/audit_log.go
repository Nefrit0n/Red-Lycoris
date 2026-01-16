package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID         uuid.UUID
	OccurredAt time.Time
	ActorID    *uuid.UUID
	ActorType  string
	Action     string
	TargetType string
	TargetID   *string
	Scope      string
	ScopeID    *uuid.UUID
	Payload    json.RawMessage
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
	if len(a.Payload) == 0 {
		a.Payload = []byte("{}")
	}
}
