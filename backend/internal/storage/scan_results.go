package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"red-lycoris/backend/internal/models"
)

func UpdateScanResultGateFailed(ctx context.Context, db *sql.DB, id uuid.UUID, gateFailed bool) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE scan_results
		 SET gate_failed = $1
		 WHERE id = $2`,
		gateFailed,
		id,
	)
	return err
}

func GetScanResultByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*models.ScanResult, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, tenant_id, engagement_id, product_id, uploader_id, import_job_id, scanner, source_type, source_version, raw_report, processed_at, created_at, gate_failed
		 FROM scan_results
		 WHERE id = $1`,
		id,
	)

	var result models.ScanResult
	if err := row.Scan(
		&result.ID,
		&result.TenantID,
		&result.EngagementID,
		&result.ProductID,
		&result.UploaderID,
		&result.ImportJobID,
		&result.Scanner,
		&result.SourceType,
		&result.SourceVersion,
		&result.RawReport,
		&result.ProcessedAt,
		&result.CreatedAt,
		&result.GateFailed,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &result, nil
}
