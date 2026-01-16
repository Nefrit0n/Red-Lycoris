package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Finding struct {
	ID           uuid.UUID  `db:"id"`
	ScanResultID *uuid.UUID `db:"scan_result_id"`
	ProductID    *uuid.UUID `db:"product_id"`
	Fingerprint  string     `db:"fingerprint"`
	Title        string     `db:"title"`
	Description  *string    `db:"description"`
	Severity     string     `db:"severity"`
	Status       string     `db:"status"`
	DuplicateID  *uuid.UUID `db:"duplicate_id"`
	CreatedAt    time.Time  `db:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at"`
	DeletedAt    *time.Time `db:"deleted_at"`
}

func (f *Finding) Validate() error {
	if f.ScanResultID == nil && f.ProductID == nil {
		return fmt.Errorf("scan_result_id or product_id is required")
	}
	if err := validateRequired(f.Title, "title"); err != nil {
		return err
	}
	if err := validateMaxLen(f.Title, 200, "title"); err != nil {
		return err
	}
	if f.Fingerprint == "" && f.ScanResultID != nil {
		return fmt.Errorf("fingerprint is required")
	}
	switch f.Severity {
	case "low", "medium", "high", "critical":
		// ok
	default:
		return fmt.Errorf("severity must be one of low, medium, high, critical")
	}
	switch f.Status {
	case "new", "duplicate", "resolved", "ignored":
		return nil
	default:
		return fmt.Errorf("status must be one of new, duplicate, resolved, ignored")
	}
}

func (f *Finding) PrepareForInsert() {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
	if f.UpdatedAt.IsZero() {
		f.UpdatedAt = f.CreatedAt
	}
}

func (f *Finding) PrepareForUpdate() {
	f.UpdatedAt = time.Now().UTC()
}
