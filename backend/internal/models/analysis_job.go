package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	AnalysisJobQueued     = "queued"
	AnalysisJobProcessing = "processing"
	AnalysisJobSucceeded  = "succeeded"
	AnalysisJobFailed     = "failed"
)

const (
	AnalysisScannerPending   = "pending"
	AnalysisScannerSucceeded = "succeeded"
	AnalysisScannerFailed    = "failed"
)

type AnalysisJob struct {
	ID               uuid.UUID  `db:"id"`
	ProductID        *uuid.UUID `db:"product_id"`
	EngagementID     *uuid.UUID `db:"engagement_id"`
	Status           string     `db:"status"`
	Scanners         []string   `db:"scanners"`
	SemgrepStatus    string     `db:"semgrep_status"`
	TrivyStatus      string     `db:"trivy_status"`
	FindingsTotal    int        `db:"findings_total"`
	FindingsNew      int        `db:"findings_new"`
	DuplicatesTotal  int        `db:"duplicates_total"`
	ArchiveKey       *string    `db:"archive_key"`
	ArchiveSize      int64      `db:"archive_size"`
	ArtifactSemgrep  *string    `db:"artifact_semgrep_key"`
	ArtifactTrivy    *string    `db:"artifact_trivy_key"`
	SemgrepImportJob *uuid.UUID `db:"semgrep_import_job_id"`
	TrivyImportJob   *uuid.UUID `db:"trivy_import_job_id"`
	IdempotencyKey   *string    `db:"idempotency_key"`
	ErrorMessage     *string    `db:"error_message"`
	CreatedBy        *uuid.UUID `db:"created_by"`
	CreatedAt        time.Time  `db:"created_at"`
	StartedAt        *time.Time `db:"started_at"`
	FinishedAt       *time.Time `db:"finished_at"`
}

func (j *AnalysisJob) Validate() error {
	switch j.Status {
	case AnalysisJobQueued, AnalysisJobProcessing, AnalysisJobSucceeded, AnalysisJobFailed:
	default:
		return fmt.Errorf("status must be one of queued, processing, succeeded, failed")
	}
	if len(j.Scanners) == 0 {
		return fmt.Errorf("scanners must not be empty")
	}
	return nil
}

func (j *AnalysisJob) PrepareForInsert() {
	if j.ID == uuid.Nil {
		j.ID = uuid.New()
	}
	if j.CreatedAt.IsZero() {
		j.CreatedAt = time.Now().UTC()
	}
	if j.SemgrepStatus == "" {
		j.SemgrepStatus = AnalysisScannerPending
	}
	if j.TrivyStatus == "" {
		j.TrivyStatus = AnalysisScannerPending
	}
}
