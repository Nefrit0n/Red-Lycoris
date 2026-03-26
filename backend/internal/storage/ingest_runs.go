package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type IngestRun struct {
	RunID           uuid.UUID
	OrgID           uuid.UUID
	ProjectID       uuid.UUID
	Status          string
	XIdempotencyKey string
	MetadataJSONB   []byte
	MetadataSHA256  string
	CreatedAt       time.Time
	CommittedAt     sql.NullTime
	PipelineID      sql.NullString
	JobID           sql.NullString
	CommitSHA       sql.NullString
	RefName         sql.NullString
}

type IngestArtifact struct {
	ID         uuid.UUID
	RunID      uuid.UUID
	OrgID      uuid.UUID
	ProjectID  uuid.UUID
	Path       string
	SHA256     string
	SizeBytes  int64
	MediaType  string
	FormatHint string
	ObjectKey  string
	UploadedAt sql.NullTime
	VerifiedAt sql.NullTime
	ETag       sql.NullString
}

func FindIngestRunByIdempotency(ctx context.Context, db *sql.DB, orgID, projectID uuid.UUID, key string) (*IngestRun, error) {
	var r IngestRun
	err := db.QueryRowContext(ctx, `
		SELECT run_id, org_id, project_id, status, x_idempotency_key, metadata_jsonb, metadata_sha256, created_at, committed_at,
		COALESCE(pipeline_id,''), COALESCE(job_id,''), COALESCE(commit_sha,''), COALESCE(ref_name,'')
		FROM ingest_runs WHERE org_id=$1 AND project_id=$2 AND x_idempotency_key=$3
	`, orgID, projectID, key).Scan(&r.RunID, &r.OrgID, &r.ProjectID, &r.Status, &r.XIdempotencyKey, &r.MetadataJSONB, &r.MetadataSHA256, &r.CreatedAt, &r.CommittedAt, &r.PipelineID, &r.JobID, &r.CommitSHA, &r.RefName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func CreateIngestRunWithArtifacts(ctx context.Context, db *sql.DB, run IngestRun, artifacts []IngestArtifact) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO ingest_runs (run_id, org_id, project_id, status, x_idempotency_key, metadata_jsonb, metadata_sha256, created_at, pipeline_id, job_id, commit_sha, ref_name)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, run.RunID, run.OrgID, run.ProjectID, run.Status, run.XIdempotencyKey, string(run.MetadataJSONB), run.MetadataSHA256, run.CreatedAt,
		nullString(run.PipelineID), nullString(run.JobID), nullString(run.CommitSHA), nullString(run.RefName))
	if err != nil {
		return err
	}
	if len(artifacts) > 0 {
		valueStrings := make([]string, 0, len(artifacts))
		valueArgs := make([]interface{}, 0, len(artifacts)*10)
		for i, a := range artifacts {
			base := i * 10
			valueStrings = append(valueStrings, fmt.Sprintf(
				"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
				base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9, base+10,
			))
			valueArgs = append(valueArgs, a.ID, run.RunID, run.OrgID, run.ProjectID, a.Path, a.SHA256, a.SizeBytes, a.MediaType, a.FormatHint, a.ObjectKey)
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO ingest_artifacts (id, run_id, org_id, project_id, path, sha256, size_bytes, media_type, format_hint, object_key)
			VALUES `+strings.Join(valueStrings, ","), valueArgs...)
		if err != nil {
			return err
		}
	}
	_, _ = tx.ExecContext(ctx, `UPDATE ingest_runs SET status='UPLOADING' WHERE run_id=$1`, run.RunID)
	return tx.Commit()
}

func GetIngestRun(ctx context.Context, db *sql.DB, runID uuid.UUID) (*IngestRun, error) {
	var r IngestRun
	err := db.QueryRowContext(ctx, `
		SELECT run_id, org_id, project_id, status, x_idempotency_key, metadata_jsonb, metadata_sha256, created_at, committed_at,
		COALESCE(pipeline_id,''), COALESCE(job_id,''), COALESCE(commit_sha,''), COALESCE(ref_name,'')
		FROM ingest_runs WHERE run_id=$1
	`, runID).Scan(&r.RunID, &r.OrgID, &r.ProjectID, &r.Status, &r.XIdempotencyKey, &r.MetadataJSONB, &r.MetadataSHA256, &r.CreatedAt, &r.CommittedAt, &r.PipelineID, &r.JobID, &r.CommitSHA, &r.RefName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func ListRunArtifacts(ctx context.Context, db *sql.DB, runID uuid.UUID) ([]IngestArtifact, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, run_id, org_id, project_id, path, sha256, size_bytes, media_type, format_hint, object_key, uploaded_at, verified_at, COALESCE(etag,'')
		FROM ingest_artifacts WHERE run_id=$1 ORDER BY path
	`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []IngestArtifact{}
	for rows.Next() {
		var a IngestArtifact
		if err := rows.Scan(&a.ID, &a.RunID, &a.OrgID, &a.ProjectID, &a.Path, &a.SHA256, &a.SizeBytes, &a.MediaType, &a.FormatHint, &a.ObjectKey, &a.UploadedAt, &a.VerifiedAt, &a.ETag); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func MarkRunCommitted(ctx context.Context, db *sql.DB, runID uuid.UUID) (time.Time, error) {
	var committed time.Time
	err := db.QueryRowContext(ctx, `
		UPDATE ingest_runs
		SET status='COMMITTED', committed_at=NOW()
		WHERE run_id=$1 AND status IN ('INIT','UPLOADING')
		RETURNING committed_at
	`, runID).Scan(&committed)
	return committed, err
}

func EncodeJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func nullString(v sql.NullString) any {
	if !v.Valid || v.String == "" {
		return nil
	}
	return v.String
}
