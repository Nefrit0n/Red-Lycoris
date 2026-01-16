package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type FindingEvent struct {
	ID        uuid.UUID  `db:"id"`
	FindingID uuid.UUID  `db:"finding_id"`
	ActorID   *uuid.UUID `db:"actor_id"`
	EventType string     `db:"event_type"`
	Payload   []byte     `db:"payload"`
	CreatedAt time.Time  `db:"created_at"`
}

func (e *FindingEvent) Validate() error {
	if e.FindingID == uuid.Nil {
		return fmt.Errorf("finding_id is required")
	}
	if err := validateRequired(e.EventType, "event_type"); err != nil {
		return err
	}
	if err := validateMaxLen(e.EventType, 100, "event_type"); err != nil {
		return err
	}
	return nil
}

func (e *FindingEvent) PrepareForInsert() {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
}
