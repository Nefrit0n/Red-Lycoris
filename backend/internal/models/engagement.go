package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Engagement struct {
	ID         uuid.UUID  `db:"id"`
	ProductID  uuid.UUID  `db:"product_id"`
	StartedAt  *time.Time `db:"started_at"`
	FinishedAt *time.Time `db:"finished_at"`
	Status     string     `db:"status"`
	CreatedAt  time.Time  `db:"created_at"`
}

func (e *Engagement) Validate() error {
	if e.ProductID == uuid.Nil {
		return fmt.Errorf("product_id is required")
	}
	if err := validateRequired(e.Status, "status"); err != nil {
		return err
	}
	switch e.Status {
	case "pending", "running", "done", "failed":
		return nil
	default:
		return fmt.Errorf("status must be one of pending, running, done, failed")
	}
}

func (e *Engagement) PrepareForInsert() {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	if e.Status == "" {
		e.Status = "pending"
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
}
