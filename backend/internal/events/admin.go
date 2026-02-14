package events

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const (
	AdminSubjectPrefix = "admin.>"
)

type AdminAuditEvent struct {
	EventID        uuid.UUID              `json:"event_id"`
	OccurredAt     time.Time              `json:"occurred_at"`
	TenantID       uuid.UUID              `json:"tenant_id"`
	Actor          AdminAuditActor        `json:"actor"`
	Action         string                 `json:"action"`
	Target         AdminAuditTarget       `json:"target"`
	RequestID      string                 `json:"request_id,omitempty"`
	IdempotencyKey *string                `json:"idempotency_key,omitempty"`
	Diff           map[string]interface{} `json:"diff,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type AdminAuditActor struct {
	Type  string  `json:"type"`
	ID    *string `json:"id,omitempty"`
	Email *string `json:"email,omitempty"`
}

type AdminAuditTarget struct {
	Type string  `json:"type"`
	ID   *string `json:"id,omitempty"`
}

func PublishAdminEvent(ctx context.Context, publisher *Publisher, subject string, event AdminAuditEvent) error {
	if publisher == nil {
		return nil
	}
	return publisher.PublishJSONWithMsgID(ctx, subject, event.EventID.String(), event)
}
