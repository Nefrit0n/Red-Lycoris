package domain

import (
	"time"

	"github.com/google/uuid"
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
