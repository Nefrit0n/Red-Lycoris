package storage

import (
	"context"
	"database/sql"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

// CreateAnalysisJobScanner inserts a pending scanner row for a job.
func CreateAnalysisJobScanner(ctx context.Context, db *sql.DB, jobID uuid.UUID, scanner string) (*models.AnalysisJobScanner, error) {
	row := &models.AnalysisJobScanner{
		ID:      uuid.New(),
		JobID:   jobID,
		Scanner: scanner,
		Status:  models.AnalysisScannerPending,
	}
	_, err := db.ExecContext(ctx,
		`INSERT INTO analysis_job_scanners (id, job_id, scanner, status)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (job_id, scanner) DO NOTHING`,
		row.ID, row.JobID, row.Scanner, row.Status,
	)
	if err != nil {
		return nil, err
	}
	return row, nil
}

// CreateAnalysisJobScannersBatch inserts pending rows for all scanners in one batch.
func CreateAnalysisJobScannersBatch(ctx context.Context, db *sql.DB, jobID uuid.UUID, scannerNames []string) error {
	for _, s := range scannerNames {
		if _, err := CreateAnalysisJobScanner(ctx, db, jobID, s); err != nil {
			return err
		}
	}
	return nil
}

// UpdateAnalysisJobScannerStatus updates a scanner row's status + timing.
func UpdateAnalysisJobScannerStatus(ctx context.Context, db *sql.DB, jobID uuid.UUID, scanner string, status string, artifactKey *string, importJobID *uuid.UUID, errorMsg *string, startedAt *time.Time, finishedAt *time.Time, durationMs *int) error {
	_, err := db.ExecContext(ctx,
		`UPDATE analysis_job_scanners
		 SET status       = $1,
		     artifact_key = COALESCE($2, artifact_key),
		     import_job_id = COALESCE($3, import_job_id),
		     error_message = $4,
		     started_at   = COALESCE($5, started_at),
		     finished_at  = COALESCE($6, finished_at),
		     duration_ms  = COALESCE($7, duration_ms)
		 WHERE job_id = $8 AND scanner = $9`,
		status,
		anyStringPtr(artifactKey),
		anyUUIDPtr(importJobID),
		anyStringPtr(errorMsg),
		startedAt,
		finishedAt,
		durationMs,
		jobID,
		scanner,
	)
	return err
}

// ListAnalysisJobScanners returns all scanner rows for a given job.
func ListAnalysisJobScanners(ctx context.Context, db *sql.DB, jobID uuid.UUID) ([]models.AnalysisJobScanner, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, job_id, scanner, status, artifact_key, import_job_id, error_message, started_at, finished_at, duration_ms
		 FROM analysis_job_scanners
		 WHERE job_id = $1
		 ORDER BY scanner`,
		jobID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.AnalysisJobScanner
	for rows.Next() {
		var s models.AnalysisJobScanner
		if err := rows.Scan(
			&s.ID, &s.JobID, &s.Scanner, &s.Status,
			&s.ArtifactKey, &s.ImportJobID, &s.ErrorMessage,
			&s.StartedAt, &s.FinishedAt, &s.DurationMs,
		); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}
