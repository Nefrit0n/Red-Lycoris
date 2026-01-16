package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type FindingComment struct {
	ID        uuid.UUID  `db:"id"`
	FindingID uuid.UUID  `db:"finding_id"`
	AuthorID  *uuid.UUID `db:"author_id"`
	Body      string     `db:"body"`
	CreatedAt time.Time  `db:"created_at"`
}

func (c *FindingComment) Validate() error {
	if err := validateRequired(c.Body, "body"); err != nil {
		return err
	}
	if err := validateMaxLen(c.Body, 2000, "body"); err != nil {
		return err
	}
	if c.FindingID == uuid.Nil {
		return fmt.Errorf("finding_id is required")
	}
	return nil
}

func (c *FindingComment) PrepareForInsert() {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.CreatedAt.IsZero() {
		c.CreatedAt = time.Now().UTC()
	}
}
