package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Finding struct {
	ID           uuid.UUID  `db:"id"`
	ScanResultID uuid.UUID  `db:"scan_result_id"`
	Fingerprint  string     `db:"fingerprint"`
	Title        string     `db:"title"`
	Description  *string    `db:"description"`
	Severity     string     `db:"severity"`
	Status       string     `db:"status"`
	DuplicateID  *uuid.UUID `db:"duplicate_id"`
	CreatedAt    time.Time  `db:"created_at"`
}

func (f *Finding) Validate() error {
	if f.ScanResultID == uuid.Nil {
		return fmt.Errorf("scan_result_id is required")
	}
	if err := validateRequired(f.Title, "title"); err != nil {
		return err
	}
	if err := validateMaxLen(f.Title, 200, "title"); err != nil {
		return err
	}
	if err := validateRequired(f.Fingerprint, "fingerprint"); err != nil {
		return err
	}
	switch f.Severity {
	case "low", "medium", "high", "critical":
		// ok
	default:
		return fmt.Errorf("severity must be one of low, medium, high, critical")
	}
	switch f.Status {
	case "new", "duplicate":
		return nil
	default:
		return fmt.Errorf("status must be one of new, duplicate")
	}
}

func (f *Finding) PrepareForInsert() {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
}
