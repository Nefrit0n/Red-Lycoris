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
	ID               uuid.UUID `json:"id"`
	Title            string    `json:"title"`
	Description      string    `json:"description,omitempty"`
	Severity         int       `json:"severity"`
	Confidence       int       `json:"confidence"`
	Status           int       `json:"status"`
	FilePath         string    `json:"file_path,omitempty"`
	LineStart        int       `json:"line_start,omitempty"`
	LineEnd          int       `json:"line_end,omitempty"`
	Component        string    `json:"component,omitempty"`
	ComponentVersion string    `json:"component_version,omitempty"`
	CVEIDs           []string  `json:"cve_ids"`
	CWEIDs           []int     `json:"cwe_ids"`
	CPEURI           string    `json:"cpe_uri,omitempty"`
	Fingerprint      string    `json:"fingerprint"`
	FirstSeen        time.Time `json:"first_seen"`
	LastSeen         time.Time `json:"last_seen"`
	TimesSeen        int       `json:"times_seen"`
	ProjectID        uuid.UUID `json:"project_id"`
	SourceType       string    `json:"source_type"`
	PriorityScore    *float64  `json:"priority_score,omitempty"`
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
