package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

const (
	StatusNew           = "new"
	StatusUnderReview   = "under_review"
	StatusConfirmed     = "confirmed"
	StatusFalsePositive = "false_positive"
	StatusOutOfScope    = "out_of_scope"
	StatusRiskAccepted  = "risk_accepted"
	StatusMitigated     = "mitigated"
	StatusDuplicate     = "duplicate"
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
	AssigneeID   *uuid.UUID `db:"assignee_id"`
	ImportJobID  *uuid.UUID `db:"import_job_id"`
	FirstSeenAt  time.Time  `db:"first_seen_at"`
	LastSeenAt   time.Time  `db:"last_seen_at"`
	RepeatCount  int        `db:"repeat_count"`
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
	case SeverityLow, SeverityMedium, SeverityHigh, SeverityCritical:
		// ok
	default:
		return fmt.Errorf("severity must be one of low, medium, high, critical")
	}

	switch f.Status {
	case StatusNew,
		StatusUnderReview,
		StatusConfirmed,
		StatusFalsePositive,
		StatusOutOfScope,
		StatusRiskAccepted,
		StatusMitigated,
		StatusDuplicate:
		return nil
	default:
		return fmt.Errorf("status must be one of new, under_review, confirmed, false_positive, out_of_scope, risk_accepted, mitigated, duplicate")
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
	if f.FirstSeenAt.IsZero() {
		f.FirstSeenAt = f.CreatedAt
	}
	if f.LastSeenAt.IsZero() {
		f.LastSeenAt = f.UpdatedAt
	}
}

func (f *Finding) PrepareForUpdate() {
	f.UpdatedAt = time.Now().UTC()
}
