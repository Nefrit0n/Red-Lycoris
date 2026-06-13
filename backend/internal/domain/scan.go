package domain

import (
	"time"

	"github.com/google/uuid"
)

type ScanStatus string

const (
	ScanStatusOpen      ScanStatus = "open"
	ScanStatusCompleted ScanStatus = "completed"
	ScanStatusTimedOut  ScanStatus = "timed_out"
)

// ScanToolRunSummary — компактное представление tool-run для встраивания в список сканов.
type ScanToolRunSummary struct {
	Scanner        string  `json:"scanner"`
	ScannerVersion *string `json:"scanner_version,omitempty"`
	Status         string  `json:"status"` // success | failed
}

type Scan struct {
	ID               uuid.UUID            `json:"id"`
	ProjectID        uuid.UUID            `json:"project_id"`
	CIPipelineID     *string              `json:"ci_pipeline_id,omitempty"`
	CommitSHA        *string              `json:"commit_sha,omitempty"`
	Branch           *string              `json:"branch,omitempty"`
	CIJobURL         *string              `json:"ci_job_url,omitempty"`
	Status           ScanStatus           `json:"status"`
	Completion       *string              `json:"completion,omitempty"`
	StartedAt        time.Time            `json:"started_at"`
	CompletedAt      *time.Time           `json:"completed_at,omitempty"`
	FindingsImported int                  `json:"findings_imported"`
	FindingsUpdated  int                  `json:"findings_updated"`
	TokenID          *uuid.UUID           `json:"token_id,omitempty"`
	AssetHint        *string              `json:"asset_hint,omitempty"`
	ToolRuns         []ScanToolRunSummary `json:"tool_runs,omitempty"`
}

type ScanToolRun struct {
	ID               uuid.UUID `json:"id"`
	ScanID           uuid.UUID `json:"scan_id"`
	Scanner          string    `json:"scanner"`
	ScannerVersion   *string   `json:"scanner_version,omitempty"`
	ReportFormat     string    `json:"report_format"`
	Status           string    `json:"status"`
	Error            *string   `json:"error,omitempty"`
	FindingsImported int       `json:"findings_imported"`
	FindingsUpdated  int       `json:"findings_updated"`
	StartedAt        time.Time `json:"started_at"`
	FinishedAt       time.Time `json:"finished_at"`
}

type ScanFinding struct {
	Finding
	ToolRunID *uuid.UUID `json:"tool_run_id,omitempty"`
	IsNew     bool       `json:"is_new"`
}
