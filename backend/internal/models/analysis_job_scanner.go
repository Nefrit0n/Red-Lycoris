package models

import (
	"time"

	"github.com/google/uuid"
)

// AllScanners is the canonical list of supported scanners.
var AllScanners = []string{
	"opengrep", "trivy", "checkov", "kics", "gitleaks", "grype",
}

// ScannerMeta describes a scanner for validation / UI hints.
type ScannerMeta struct {
	Name     string
	Category string // SAST, SCA, IAC, SECRETS, CONTAINER
}

var ScannerCatalog = map[string]ScannerMeta{
	"opengrep": {Name: "OpenGrep", Category: "SAST"},
	"semgrep":  {Name: "Semgrep", Category: "SAST"},
	"trivy":    {Name: "Trivy", Category: "SCA"},
	"checkov":  {Name: "Checkov", Category: "IAC"},
	"kics":     {Name: "KICS", Category: "IAC"},
	"gitleaks": {Name: "Gitleaks", Category: "SECRETS"},
	"grype":    {Name: "Grype", Category: "SCA"},
}

func IsScannerSupported(name string) bool {
	_, ok := ScannerCatalog[name]
	return ok
}

// AnalysisJobScanner tracks one scanner's execution within an analysis job.
type AnalysisJobScanner struct {
	ID           uuid.UUID  `db:"id"`
	JobID        uuid.UUID  `db:"job_id"`
	Scanner      string     `db:"scanner"`
	Status       string     `db:"status"`
	ArtifactKey  *string    `db:"artifact_key"`
	ImportJobID  *uuid.UUID `db:"import_job_id"`
	ErrorMessage *string    `db:"error_message"`
	StartedAt    *time.Time `db:"started_at"`
	FinishedAt   *time.Time `db:"finished_at"`
	DurationMs   *int       `db:"duration_ms"`
}
