package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type RiskRescoreJob struct {
	JobID             uuid.UUID
	TenantID          *uuid.UUID
	ModelVersion      string
	Status            string
	CursorLastFinding *uuid.UUID
	StartedAt         time.Time
	FinishedAt        *time.Time
	Stats             RiskRescoreStats
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type RiskRescoreStats struct {
	Processed int `json:"processed"`
	Enqueued  int `json:"enqueued"`
	Errors    int `json:"errors"`
}

func CreateRiskRescoreJob(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, modelVersion string, startedAt time.Time) (*RiskRescoreJob, error) {
	stats := RiskRescoreStats{}
	statsPayload, err := json.Marshal(stats)
	if err != nil {
		return nil, err
	}
	var job RiskRescoreJob
	query := `
		INSERT INTO risk_rescore_jobs (tenant_id, model_version, status, started_at, stats)
		VALUES ($1, $2, 'running', $3, $4)
		RETURNING job_id, tenant_id, model_version, status, cursor_last_finding_id, started_at, finished_at, stats, created_at, updated_at`
	row := db.QueryRowContext(ctx, query, anyUUIDPtr(tenantID), modelVersion, startedAt, statsPayload)
	var rawStats []byte
	if err := row.Scan(
		&job.JobID,
		&job.TenantID,
		&job.ModelVersion,
		&job.Status,
		&job.CursorLastFinding,
		&job.StartedAt,
		&job.FinishedAt,
		&rawStats,
		&job.CreatedAt,
		&job.UpdatedAt,
	); err != nil {
		return nil, err
	}
	_ = json.Unmarshal(rawStats, &job.Stats)
	return &job, nil
}

func GetRunningRiskRescoreJob(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, modelVersion string) (*RiskRescoreJob, error) {
	query := `
		SELECT job_id, tenant_id, model_version, status, cursor_last_finding_id, started_at, finished_at, stats, created_at, updated_at
		FROM risk_rescore_jobs
		WHERE tenant_id IS NOT DISTINCT FROM $1 AND model_version = $2 AND status = 'running'
		ORDER BY created_at DESC
		LIMIT 1`
	row := db.QueryRowContext(ctx, query, anyUUIDPtr(tenantID), modelVersion)
	var job RiskRescoreJob
	var rawStats []byte
	if err := row.Scan(
		&job.JobID,
		&job.TenantID,
		&job.ModelVersion,
		&job.Status,
		&job.CursorLastFinding,
		&job.StartedAt,
		&job.FinishedAt,
		&rawStats,
		&job.CreatedAt,
		&job.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	_ = json.Unmarshal(rawStats, &job.Stats)
	return &job, nil
}

func UpdateRiskRescoreJobProgress(ctx context.Context, db *sql.DB, jobID uuid.UUID, cursorLastFinding *uuid.UUID, stats RiskRescoreStats) error {
	statsPayload, err := json.Marshal(stats)
	if err != nil {
		return err
	}
	query := `
		UPDATE risk_rescore_jobs
		SET cursor_last_finding_id = $1, stats = $2, updated_at = NOW()
		WHERE job_id = $3`
	_, err = db.ExecContext(ctx, query, anyUUIDPtr(cursorLastFinding), statsPayload, jobID)
	return err
}

func UpdateRiskRescoreJobStatus(ctx context.Context, db *sql.DB, jobID uuid.UUID, status string, finishedAt *time.Time, stats RiskRescoreStats) error {
	statsPayload, err := json.Marshal(stats)
	if err != nil {
		return err
	}
	query := `
		UPDATE risk_rescore_jobs
		SET status = $1, finished_at = $2, stats = $3, updated_at = NOW()
		WHERE job_id = $4`
	_, err = db.ExecContext(ctx, query, status, finishedAt, statsPayload, jobID)
	return err
}

func ListRiskRescoreJobs(ctx context.Context, db *sql.DB, status string, limit int) ([]RiskRescoreJob, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT job_id, tenant_id, model_version, status, cursor_last_finding_id, started_at, finished_at, stats, created_at, updated_at
		FROM risk_rescore_jobs`
	args := []any{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := []RiskRescoreJob{}
	for rows.Next() {
		var job RiskRescoreJob
		var rawStats []byte
		if err := rows.Scan(
			&job.JobID,
			&job.TenantID,
			&job.ModelVersion,
			&job.Status,
			&job.CursorLastFinding,
			&job.StartedAt,
			&job.FinishedAt,
			&rawStats,
			&job.CreatedAt,
			&job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(rawStats, &job.Stats)
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func ListFindingsForRescore(ctx context.Context, db *sql.DB, tenantID uuid.UUID, afterID uuid.UUID, limit int) ([]uuid.UUID, error) {
	if limit <= 0 || limit > maxRiskSchedulerBatch {
		limit = maxRiskSchedulerBatch
	}
	query := `
		SELECT f.id
		FROM findings f
		WHERE f.tenant_id = $1
			AND f.deleted_at IS NULL
			AND f.status NOT IN ('resolved', 'accepted', 'mitigated')
			AND f.id > $2
		ORDER BY f.id
		LIMIT $3`
	rows, err := db.QueryContext(ctx, query, tenantID, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0, limit)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func TryRiskRescoreLock(ctx context.Context, db *sql.DB, key string) (bool, error) {
	var locked bool
	if err := db.QueryRowContext(ctx, "SELECT pg_try_advisory_lock(hashtext($1))", key).Scan(&locked); err != nil {
		return false, err
	}
	return locked, nil
}

func ReleaseRiskRescoreLock(ctx context.Context, db *sql.DB, key string) error {
	_, err := db.ExecContext(ctx, "SELECT pg_advisory_unlock(hashtext($1))", key)
	return err
}

func CountFindingsMissingCurrentRiskModel(ctx context.Context, db *sql.DB) (int64, error) {
	query := `
		SELECT COUNT(*)
		FROM findings f
		LEFT JOIN risk_models rm
			ON rm.tenant_id IS NOT DISTINCT FROM f.tenant_id AND rm.is_active
		LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		WHERE f.deleted_at IS NULL
			AND f.status NOT IN ('resolved', 'accepted', 'mitigated')
			AND (rm.version IS NULL OR fr.model_version IS DISTINCT FROM rm.version)`
	var count int64
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}
