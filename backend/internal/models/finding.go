package models

import (
	"encoding/json"
	"fmt"
	"strings"
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
	CategorySAST      = "SAST"
	CategorySCA       = "SCA"
	CategorySecrets   = "SECRETS"
	CategoryConfig    = "CONFIG"
	CategoryDAST      = "DAST"
	CategoryLicense   = "LICENSE"
	CategoryIAC       = "IAC"
	CategoryContainer = "CONTAINER"
	CategoryUnknown   = "UNKNOWN"
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

var FindingOpenStatuses = []string{
	StatusNew,
	StatusUnderReview,
	StatusConfirmed,
}

var FindingClosedStatuses = []string{
	StatusMitigated,
	StatusFalsePositive,
	StatusOutOfScope,
	StatusRiskAccepted,
	StatusDuplicate,
}

func NormalizeFindingStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

func IsClosedFindingStatus(status string) bool {
	normalized := NormalizeFindingStatus(status)
	for _, candidate := range FindingClosedStatuses {
		if normalized == candidate {
			return true
		}
	}
	return false
}

type Finding struct {
	ID             uuid.UUID       `db:"id"`
	TenantID       *uuid.UUID      `db:"tenant_id"`
	ScanResultID   *uuid.UUID      `db:"scan_result_id"`
	ProductID      *uuid.UUID      `db:"product_id"`
	Fingerprint    string          `db:"fingerprint"`
	Category       string          `db:"category"`
	Title          string          `db:"title"`
	Description    *string         `db:"description"`
	Severity       string          `db:"severity"`
	Status         string          `db:"status"`
	DuplicateID    *uuid.UUID      `db:"duplicate_id"`
	AssigneeID     *uuid.UUID      `db:"assignee_id"`
	ImportJobID    *uuid.UUID      `db:"import_job_id"`
	FirstSeenAt    time.Time       `db:"first_seen_at"`
	LastSeenAt     time.Time       `db:"last_seen_at"`
	RepeatCount    int             `db:"repeat_count"`
	SLADueAt       *time.Time      `db:"sla_due_at"`
	SLABreached    bool            `db:"sla_breached"`
	SLABreachedAt  *time.Time      `db:"sla_breached_at"`
	SLAProfile     *string         `db:"sla_profile"`
	SLASource      *string         `db:"sla_source"`
	SourceType     *string         `db:"source_type"`
	SourceVersion  *string         `db:"source_version"`
	EndpointMethod *string         `db:"endpoint_method"`
	EndpointPath   *string         `db:"endpoint_path"`
	Evidence       json.RawMessage `db:"evidence"`
	CWE            []string        `db:"cwe"`
	OWASP          []string        `db:"owasp"`
	RawData        json.RawMessage `db:"raw_data"`
	CreatedAt      time.Time       `db:"created_at"`
	UpdatedAt      time.Time       `db:"updated_at"`
	DeletedAt      *time.Time      `db:"deleted_at"`
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

	switch f.Category {
	case CategorySAST, CategorySCA, CategorySecrets, CategoryConfig, CategoryDAST, CategoryLicense, CategoryIAC, CategoryContainer, CategoryUnknown:
		// ok
	default:
		return fmt.Errorf("category must be one of SAST, SCA, SECRETS, CONFIG, DAST, LICENSE, IAC, CONTAINER, UNKNOWN")
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
	if f.Category == "" {
		f.Category = CategorySAST
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
