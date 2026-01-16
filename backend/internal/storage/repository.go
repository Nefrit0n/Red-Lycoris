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
	var identifier sql.NullString
	if product.Identifier != nil {
		identifier = sql.NullString{String: *product.Identifier, Valid: true}
	}
	var version sql.NullString
	if product.Version != nil {
		version = sql.NullString{String: *product.Version, Valid: true}
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO products (id, name, slug, description, identifier, version, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		product.ID,
		product.Name,
		product.Slug,
		description,
		identifier,
		version,
		product.CreatedAt,
		product.UpdatedAt,
	)
	return err
}

func FindProductByIdentifier(ctx context.Context, db *sql.DB, identifier string) (*models.Product, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, name, slug, description, identifier, version, created_at, updated_at
		 FROM products
		 WHERE identifier = $1
		 LIMIT 1`,
		identifier,
	)
	return scanProductRow(row)
}

func FindProductByNameVersion(ctx context.Context, db *sql.DB, name string, version *string) (*models.Product, error) {
	if version == nil {
		row := db.QueryRowContext(
			ctx,
			`SELECT id, name, slug, description, identifier, version, created_at, updated_at
			 FROM products
			 WHERE name = $1 AND version IS NULL
			 LIMIT 1`,
			name,
		)
		return scanProductRow(row)
	}

	row := db.QueryRowContext(
		ctx,
		`SELECT id, name, slug, description, identifier, version, created_at, updated_at
		 FROM products
		 WHERE name = $1 AND version = $2
		 LIMIT 1`,
		name,
		*version,
	)
	return scanProductRow(row)
}

func FindProductBySlug(ctx context.Context, db *sql.DB, slug string) (*models.Product, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, name, slug, description, identifier, version, created_at, updated_at
		 FROM products
		 WHERE slug = $1
		 LIMIT 1`,
		slug,
	)
	return scanProductRow(row)
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
	var productID interface{}
	if scanResult.ProductID != nil {
		productID = *scanResult.ProductID
	}
	var uploaderID interface{}
	if scanResult.UploaderID != nil {
		uploaderID = *scanResult.UploaderID
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO scan_results (id, engagement_id, product_id, uploader_id, scanner, raw_report, processed_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		scanResult.ID,
		engagementID,
		productID,
		uploaderID,
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

func scanProductRow(row *sql.Row) (*models.Product, error) {
	var product models.Product
	var description sql.NullString
	var identifier sql.NullString
	var version sql.NullString

	if err := row.Scan(
		&product.ID,
		&product.Name,
		&product.Slug,
		&description,
		&identifier,
		&version,
		&product.CreatedAt,
		&product.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if description.Valid {
		product.Description = &description.String
	}
	if identifier.Valid {
		product.Identifier = &identifier.String
	}
	if version.Valid {
		product.Version = &version.String
	}

	return &product, nil
}
