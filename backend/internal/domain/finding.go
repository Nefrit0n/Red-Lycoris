package domain

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	SeverityInfo     = 0
	SeverityLow      = 1
	SeverityMedium   = 2
	SeverityHigh     = 3
	SeverityCritical = 4
)

const (
	StatusOpen         = 0
	StatusConfirmed    = 1
	StatusFP           = 2
	StatusResolved     = 3
	StatusRiskAccepted = 4
)

type Finding struct {
	ID               uuid.UUID       `json:"id"`
	Kind             FindingKind     `json:"kind"`
	Title            string          `json:"title"`
	Description      string          `json:"description,omitempty"`
	Severity         int             `json:"severity"`
	Confidence       int             `json:"confidence"`
	Status           int             `json:"status"`
	FilePath         string          `json:"file_path,omitempty"`
	LineStart        int             `json:"line_start,omitempty"`
	LineEnd          int             `json:"line_end,omitempty"`
	Component        string          `json:"component,omitempty"`
	ComponentVersion string          `json:"component_version,omitempty"`
	CVEIDs           []string        `json:"cve_ids"`
	CWEIDs           []int           `json:"cwe_ids"`
	CPEURI           string          `json:"cpe_uri,omitempty"`
	Fingerprint      string          `json:"fingerprint"`
	FirstSeen        time.Time       `json:"first_seen"`
	LastSeen         time.Time       `json:"last_seen"`
	TimesSeen        int             `json:"times_seen"`
	ProjectID        uuid.UUID       `json:"project_id"`
	SourceType       string          `json:"source_type"`
	FixedVersion     *string         `json:"fixed_version,omitempty"`
	PackageEcosystem *string         `json:"package_ecosystem,omitempty"`
	Purl             *string         `json:"purl,omitempty"`
	CodeSnippet      *string         `json:"code_snippet,omitempty"`
	CodeFlow         json.RawMessage `json:"code_flow,omitempty"`
	URL              *string         `json:"url,omitempty"`
	HttpMethod       *string         `json:"http_method,omitempty"`
	HttpParam        *string         `json:"http_param,omitempty"`
	HttpEvidence     json.RawMessage `json:"http_evidence,omitempty"`
	IacResource      *string         `json:"iac_resource,omitempty"`
	IacProvider      *string         `json:"iac_provider,omitempty"`
	SecretKind       *string         `json:"secret_kind,omitempty"`
	CommitSHA        *string         `json:"commit_sha,omitempty"`
	RuleID           *string         `json:"rule_id,omitempty"`
	RuleName         *string         `json:"rule_name,omitempty"`
	PriorityScore    *float64        `json:"priority_score,omitempty"`
	ClosureReasonID  *int16          `json:"closure_reason_id,omitempty"`
	ClosureNote      *string         `json:"closure_note,omitempty"`
	ClosedAt         *time.Time      `json:"closed_at,omitempty"`
	ClosedBy         *uuid.UUID      `json:"closed_by,omitempty"`
	AssignedTo       *uuid.UUID      `json:"assigned_to,omitempty"`
	AssigneeEmail    string          `json:"assignee_email,omitempty"`

	// Joined badge fields — populated only by list queries.
	InKEV       bool     `json:"in_kev,omitempty"`
	InBDU       bool     `json:"in_bdu,omitempty"`
	MaxEPSS     *float64 `json:"max_epss,omitempty"`
	MaxCVSS     *float64 `json:"max_cvss,omitempty"`
	ProjectName string   `json:"project_name,omitempty"`
}

func (f *Finding) Validate() error {
	if f.Title == "" {
		return errors.New("title is required")
	}
	if f.Severity < SeverityInfo || f.Severity > SeverityCritical {
		return errors.New("severity must be between 0 and 4")
	}
	if f.Confidence < 0 || f.Confidence > 3 {
		return errors.New("confidence must be between 0 and 3")
	}
	if f.Status < StatusOpen || f.Status > StatusRiskAccepted {
		return errors.New("status must be between 0 and 4")
	}
	if f.ProjectID == uuid.Nil {
		return errors.New("project_id is required")
	}
	if f.SourceType == "" {
		return errors.New("source_type is required")
	}
	if f.Fingerprint == "" {
		return errors.New("fingerprint is required")
	}
	return nil
}

// FindingGroup is an aggregate bucket produced by grouped list queries
// (group_by = cve | component | rule).
type FindingGroup struct {
	GroupKey      string      `json:"group_key"`
	FindingsCount int         `json:"findings_count"`
	ProjectsCount int         `json:"projects_count"`
	MaxSeverity   int         `json:"max_severity"`
	FirstSeen     time.Time   `json:"first_seen"`
	ProjectIDs    []uuid.UUID `json:"project_ids"`
	SampleIDs     []uuid.UUID `json:"sample_ids"`
	InKEV         bool        `json:"in_kev"`
	MaxEPSS       *float64    `json:"max_epss,omitempty"`
	MaxCVSS       *float64    `json:"max_cvss,omitempty"`
}

type FindingEnrichment struct {
	FindingID  uuid.UUID       `json:"finding_id"`
	Source     string          `json:"source"`
	Data       json.RawMessage `json:"data"`
	EnrichedAt time.Time       `json:"enriched_at"`
}

type FindingScore struct {
	FindingID      uuid.UUID `json:"finding_id"`
	BaseScore      float64   `json:"base_score"`
	EPSSScore      float64   `json:"epss_score"`
	EPSSPercentile float64   `json:"epss_percentile"`
	IsKEV          bool      `json:"is_kev"`
	IsBDU          bool      `json:"is_bdu"`
	PriorityScore  float64   `json:"priority_score"`
	CalculatedAt   time.Time `json:"calculated_at"`
}
