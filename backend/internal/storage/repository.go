package storage

import (
	"context"
	"database/sql"
	"encoding/json"

	"lotus-warden/backend/internal/models"
)

func CreateProduct(ctx context.Context, db *sql.DB, product *models.Product) error {
	if err := product.Validate(); err != nil {
		return err
	}
	product.PrepareForInsert()

	var description sql.NullString
	if product.Description != nil {
		description = sql.NullString{String: *product.Description, Valid: true}
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO products (id, name, slug, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		product.ID,
		product.Name,
		product.Slug,
		description,
		product.CreatedAt,
		product.UpdatedAt,
	)
	return err
}

func CreateEngagement(ctx context.Context, db *sql.DB, engagement *models.Engagement) error {
	if err := engagement.Validate(); err != nil {
		return err
	}
	engagement.PrepareForInsert()

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO engagements (id, product_id, started_at, finished_at, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		engagement.ID,
		engagement.ProductID,
		engagement.StartedAt,
		engagement.FinishedAt,
		engagement.Status,
		engagement.CreatedAt,
	)
	return err
}

func CreateScanResult(ctx context.Context, db *sql.DB, scanResult *models.ScanResult) error {
	if err := scanResult.Validate(); err != nil {
		return err
	}
	scanResult.PrepareForInsert()

	var rawReport json.RawMessage
	if len(scanResult.RawReport) > 0 {
		rawReport = scanResult.RawReport
	}
	var engagementID interface{}
	if scanResult.EngagementID != nil {
		engagementID = *scanResult.EngagementID
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO scan_results (id, engagement_id, scanner, raw_report, processed_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		scanResult.ID,
		engagementID,
		scanResult.Scanner,
		rawReport,
		scanResult.ProcessedAt,
		scanResult.CreatedAt,
	)
	return err
}

func CreateFinding(ctx context.Context, db *sql.DB, finding *models.Finding) error {
	if err := finding.Validate(); err != nil {
		return err
	}
	finding.PrepareForInsert()

	var description sql.NullString
	if finding.Description != nil {
		description = sql.NullString{String: *finding.Description, Valid: true}
	}
	var duplicateID interface{}
	if finding.DuplicateID != nil {
		duplicateID = *finding.DuplicateID
	}
	var productID interface{}
	if finding.ProductID != nil {
		productID = *finding.ProductID
	}
	var scanResultID interface{}
	if finding.ScanResultID != nil {
		scanResultID = *finding.ScanResultID
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO findings (id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		finding.ID,
		scanResultID,
		productID,
		finding.Fingerprint,
		finding.Title,
		description,
		finding.Severity,
		finding.Status,
		duplicateID,
		finding.CreatedAt,
		finding.UpdatedAt,
	)
	return err
}

func FindFindingIDByFingerprint(ctx context.Context, db *sql.DB, fingerprint string) (*models.Finding, error) {
	row := db.QueryRowContext(ctx, `SELECT id FROM findings WHERE fingerprint = $1 LIMIT 1`, fingerprint)
	var id models.Finding
	if err := row.Scan(&id.ID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &id, nil
}
