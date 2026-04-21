package domain

import (
	"time"

	"github.com/google/uuid"
)

type ScanStatus string

const (
	ScanStatusRunning   ScanStatus = "running"
	ScanStatusCompleted ScanStatus = "completed"
	ScanStatusFailed    ScanStatus = "failed"
)

type Scan struct {
	ID               uuid.UUID  `json:"id"`
	ProjectID        uuid.UUID  `json:"project_id"`
	CommitSHA        string     `json:"commit_sha"`
	Branch           string     `json:"branch"`
	Scanner          string     `json:"scanner"`
	ScannerVersion   *string    `json:"scanner_version,omitempty"`
	CIJobURL         *string    `json:"ci_job_url,omitempty"`
	StartedAt        time.Time  `json:"started_at"`
	FinishedAt       *time.Time `json:"finished_at,omitempty"`
	FindingsImported int        `json:"findings_imported"`
	FindingsUpdated  int        `json:"findings_updated"`
	Status           ScanStatus `json:"status"`
	TokenID          *uuid.UUID `json:"token_id,omitempty"`
	TriggeredByUser  *uuid.UUID `json:"triggered_by_user_id,omitempty"`
	AssetHint        *string    `json:"asset_hint,omitempty"`
	RawReportSize    *int       `json:"raw_report_size,omitempty"`
}

type ScanFinding struct {
	Finding
	IsNew bool `json:"is_new"`
}
