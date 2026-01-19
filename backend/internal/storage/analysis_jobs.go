package storage

import (
	"context"
	"database/sql"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type AnalysisJobListItem struct {
	ID              uuid.UUID
	ProductID       uuid.NullUUID
	ProductName     sql.NullString
	EngagementID    uuid.NullUUID
	Status          string
	Scanners        []string
	SemgrepStatus   string
	TrivyStatus     string
	FindingsTotal   int
	FindingsNew     int
	DuplicatesTotal int
	CreatedAt       time.Time
	StartedAt       sql.NullTime
	FinishedAt      sql.NullTime
}

type AnalysisJobDetail struct {
	AnalysisJobListItem
	ArchiveKey       sql.NullString
	ArchiveSize      int64
	ArtifactSemgrep  sql.NullString
	ArtifactTrivy    sql.NullString
	SemgrepImportJob uuid.NullUUID
	TrivyImportJob   uuid.NullUUID
	ErrorMessage     sql.NullString
	CreatedBy        uuid.NullUUID
	IdempotencyKey   sql.NullString
}

func CreateAnalysisJob(ctx context.Context, db *sql.DB, job *models.AnalysisJob) error {
	if err := job.Validate(); err != nil {
		return err
	}
	job.PrepareForInsert()

	var productID interface{}
	if job.ProductID != nil {
		productID = *job.ProductID
	}
	var engagementID interface{}
	if job.EngagementID != nil {
		engagementID = *job.EngagementID
	}
	var archiveKey sql.NullString
	if job.ArchiveKey != nil {
		archiveKey = sql.NullString{String: *job.ArchiveKey, Valid: true}
	}
	var artifactSemgrep sql.NullString
	if job.ArtifactSemgrep != nil {
		artifactSemgrep = sql.NullString{String: *job.ArtifactSemgrep, Valid: true}
	}
	var artifactTrivy sql.NullString
	if job.ArtifactTrivy != nil {
		artifactTrivy = sql.NullString{String: *job.ArtifactTrivy, Valid: true}
	}
	var idempotencyKey sql.NullString
	if job.IdempotencyKey != nil {
		idempotencyKey = sql.NullString{String: *job.IdempotencyKey, Valid: true}
	}
	var errorMessage sql.NullString
	if job.ErrorMessage != nil {
		errorMessage = sql.NullString{String: *job.ErrorMessage, Valid: true}
	}
	var createdBy sql.NullString
	if job.CreatedBy != nil {
		createdBy = sql.NullString{String: job.CreatedBy.String(), Valid: true}
	}
	var semgrepImportJob interface{}
	if job.SemgrepImportJob != nil {
		semgrepImportJob = *job.SemgrepImportJob
	}
	var trivyImportJob interface{}
	if job.TrivyImportJob != nil {
		trivyImportJob = *job.TrivyImportJob
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO analysis_jobs (
			id,
			product_id,
			engagement_id,
			status,
			scanners,
			semgrep_status,
			trivy_status,
			findings_total,
			findings_new,
			duplicates_total,
			archive_key,
			archive_size,
			artifact_semgrep_key,
			artifact_trivy_key,
			semgrep_import_job_id,
			trivy_import_job_id,
			idempotency_key,
			error_message,
			created_by,
			created_at,
			started_at,
			finished_at
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
		)`,
		job.ID,
		productID,
		engagementID,
		job.Status,
		pq.Array(job.Scanners),
		job.SemgrepStatus,
		job.TrivyStatus,
		job.FindingsTotal,
		job.FindingsNew,
		job.DuplicatesTotal,
		archiveKey,
		job.ArchiveSize,
		artifactSemgrep,
		artifactTrivy,
		semgrepImportJob,
		trivyImportJob,
		idempotencyKey,
		errorMessage,
		createdBy,
		job.CreatedAt,
		job.StartedAt,
		job.FinishedAt,
	)
	return err
}

func GetAnalysisJobByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*AnalysisJobDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT aj.id,
			aj.product_id,
			p.name,
			aj.engagement_id,
			aj.status,
			aj.scanners,
			aj.semgrep_status,
			aj.trivy_status,
			aj.findings_total,
			aj.findings_new,
			aj.duplicates_total,
			aj.created_at,
			aj.started_at,
			aj.finished_at,
			aj.archive_key,
			aj.archive_size,
			aj.artifact_semgrep_key,
			aj.artifact_trivy_key,
			aj.semgrep_import_job_id,
			aj.trivy_import_job_id,
			aj.error_message,
			aj.created_by,
			aj.idempotency_key
		 FROM analysis_jobs aj
		 LEFT JOIN products p ON p.id = aj.product_id
		 WHERE aj.id = $1`,
		id,
	)
	return scanAnalysisJobDetail(row)
}

func GetAnalysisJobByIdempotencyKey(ctx context.Context, db *sql.DB, key string) (*AnalysisJobDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT aj.id,
			aj.product_id,
			p.name,
			aj.engagement_id,
			aj.status,
			aj.scanners,
			aj.semgrep_status,
			aj.trivy_status,
			aj.findings_total,
			aj.findings_new,
			aj.duplicates_total,
			aj.created_at,
			aj.started_at,
			aj.finished_at,
			aj.archive_key,
			aj.archive_size,
			aj.artifact_semgrep_key,
			aj.artifact_trivy_key,
			aj.semgrep_import_job_id,
			aj.trivy_import_job_id,
			aj.error_message,
			aj.created_by,
			aj.idempotency_key
		 FROM analysis_jobs aj
		 LEFT JOIN products p ON p.id = aj.product_id
		 WHERE aj.idempotency_key = $1`,
		key,
	)
	return scanAnalysisJobDetail(row)
}

func UpdateAnalysisJobStatus(ctx context.Context, db *sql.DB, id uuid.UUID, status string, startedAt *time.Time, finishedAt *time.Time, errorMessage *string) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE analysis_jobs
		 SET status = $1,
		     started_at = COALESCE($2, started_at),
		     finished_at = COALESCE($3, finished_at),
		     error_message = $4
		 WHERE id = $5`,
		status,
		startedAt,
		finishedAt,
		anyStringPtr(errorMessage),
		id,
	)
	return err
}

func UpdateAnalysisJobStats(ctx context.Context, db *sql.DB, id uuid.UUID, findingsTotal int, findingsNew int, duplicates int) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE analysis_jobs
		 SET findings_total = $1,
		     findings_new = $2,
		     duplicates_total = $3
		 WHERE id = $4`,
		findingsTotal,
		findingsNew,
		duplicates,
		id,
	)
	return err
}

func UpdateAnalysisJobArchiveKey(ctx context.Context, db *sql.DB, id uuid.UUID, archiveKey *string, archiveSize int64) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE analysis_jobs
		 SET archive_key = $1,
		     archive_size = $2
		 WHERE id = $3`,
		anyStringPtr(archiveKey),
		archiveSize,
		id,
	)
	return err
}

func UpdateAnalysisJobScanner(ctx context.Context, db *sql.DB, id uuid.UUID, scanner string, status string, importJobID *uuid.UUID, artifactKey *string) error {
	columnStatus := ""
	columnImport := ""
	columnArtifact := ""
	switch scanner {
	case "semgrep":
		columnStatus = "semgrep_status"
		columnImport = "semgrep_import_job_id"
		columnArtifact = "artifact_semgrep_key"
	case "trivy":
		columnStatus = "trivy_status"
		columnImport = "trivy_import_job_id"
		columnArtifact = "artifact_trivy_key"
	default:
		return nil
	}
	_, err := db.ExecContext(
		ctx,
		`UPDATE analysis_jobs
		 SET `+columnStatus+` = $1,
		     `+columnImport+` = $2,
		     `+columnArtifact+` = $3
		 WHERE id = $4`,
		status,
		anyUUIDPtr(importJobID),
		anyStringPtr(artifactKey),
		id,
	)
	return err
}

func ListAnalysisJobs(ctx context.Context, db *sql.DB, limit int, offset int) ([]AnalysisJobListItem, int, error) {
	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM analysis_jobs`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := db.QueryContext(
		ctx,
		`SELECT aj.id,
			aj.product_id,
			p.name,
			aj.engagement_id,
			aj.status,
			aj.scanners,
			aj.semgrep_status,
			aj.trivy_status,
			aj.findings_total,
			aj.findings_new,
			aj.duplicates_total,
			aj.created_at,
			aj.started_at,
			aj.finished_at
		 FROM analysis_jobs aj
		 LEFT JOIN products p ON p.id = aj.product_id
		 ORDER BY aj.created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit,
		offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []AnalysisJobListItem{}
	for rows.Next() {
		var item AnalysisJobListItem
		var scanners []string
		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductName,
			&item.EngagementID,
			&item.Status,
			pq.Array(&scanners),
			&item.SemgrepStatus,
			&item.TrivyStatus,
			&item.FindingsTotal,
			&item.FindingsNew,
			&item.DuplicatesTotal,
			&item.CreatedAt,
			&item.StartedAt,
			&item.FinishedAt,
		); err != nil {
			return nil, 0, err
		}
		item.Scanners = scanners
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// scanner is implemented by both *sql.Row and *sql.Rows
type scanner interface {
	Scan(dest ...interface{}) error
}

func scanAnalysisJobDetailRow(s scanner) (*AnalysisJobDetail, error) {
	var item AnalysisJobDetail
	var scanners []string
	if err := s.Scan(
		&item.ID,
		&item.ProductID,
		&item.ProductName,
		&item.EngagementID,
		&item.Status,
		pq.Array(&scanners),
		&item.SemgrepStatus,
		&item.TrivyStatus,
		&item.FindingsTotal,
		&item.FindingsNew,
		&item.DuplicatesTotal,
		&item.CreatedAt,
		&item.StartedAt,
		&item.FinishedAt,
		&item.ArchiveKey,
		&item.ArchiveSize,
		&item.ArtifactSemgrep,
		&item.ArtifactTrivy,
		&item.SemgrepImportJob,
		&item.TrivyImportJob,
		&item.ErrorMessage,
		&item.CreatedBy,
		&item.IdempotencyKey,
	); err != nil {
		return nil, err
	}
	item.Scanners = scanners
	return &item, nil
}

func scanAnalysisJobDetail(row *sql.Row) (*AnalysisJobDetail, error) {
	return scanAnalysisJobDetailRow(row)
}

func ListAnalysisJobsWithArchiveCleanup(ctx context.Context, db *sql.DB, olderThan time.Time, limit int) ([]AnalysisJobDetail, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT aj.id,
			aj.product_id,
			p.name,
			aj.engagement_id,
			aj.status,
			aj.scanners,
			aj.semgrep_status,
			aj.trivy_status,
			aj.findings_total,
			aj.findings_new,
			aj.duplicates_total,
			aj.created_at,
			aj.started_at,
			aj.finished_at,
			aj.archive_key,
			aj.archive_size,
			aj.artifact_semgrep_key,
			aj.artifact_trivy_key,
			aj.semgrep_import_job_id,
			aj.trivy_import_job_id,
			aj.error_message,
			aj.created_by,
			aj.idempotency_key
		 FROM analysis_jobs aj
		 LEFT JOIN products p ON p.id = aj.product_id
		 WHERE aj.archive_key IS NOT NULL
		   AND aj.finished_at IS NOT NULL
		   AND aj.finished_at < $1
		 ORDER BY aj.finished_at ASC
		 LIMIT $2`,
		olderThan,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AnalysisJobDetail{}
	for rows.Next() {
		item, err := scanAnalysisJobDetailRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
