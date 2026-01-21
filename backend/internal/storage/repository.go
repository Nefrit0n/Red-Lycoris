// internal/storage/repository.go
package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"lotus-warden/backend/internal/models"
)

// ---- helpers ----

func nullStringPtr(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

func anyUUIDPtr(id *uuid.UUID) any {
	if id == nil {
		return nil
	}
	return *id
}

func anyStringPtr(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func anyRawJSON(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	return json.RawMessage(b)
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// ---- products ----

func CreateProduct(ctx context.Context, db *sql.DB, product *models.Product) error {
	if err := product.Validate(); err != nil {
		return err
	}
	product.PrepareForInsert()

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO products (id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		product.ID,
		product.Name,
		product.Slug,
		nullStringPtr(product.Description),
		nullStringPtr(product.Identifier),
		nullStringPtr(product.Version),
		nullStringPtr(product.AssetCriticality),
		product.CreatedAt,
		product.UpdatedAt,
	)
	return err
}

func FindProductByIdentifier(ctx context.Context, db *sql.DB, identifier string) (*models.Product, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at
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
			`SELECT id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at
			 FROM products
			 WHERE name = $1 AND version IS NULL
			 LIMIT 1`,
			name,
		)
		return scanProductRow(row)
	}

	row := db.QueryRowContext(
		ctx,
		`SELECT id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at
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
		`SELECT id, name, slug, description, identifier, version, asset_criticality, created_at, updated_at
		 FROM products
		 WHERE slug = $1
		 LIMIT 1`,
		slug,
	)
	return scanProductRow(row)
}

// ---- engagements ----

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

// ---- scan results ----

func CreateScanResult(ctx context.Context, db *sql.DB, scanResult *models.ScanResult) error {
	if err := scanResult.Validate(); err != nil {
		return err
	}
	scanResult.PrepareForInsert()

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO scan_results (id, engagement_id, product_id, uploader_id, import_job_id, scanner, source_type, source_version, raw_report, processed_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		scanResult.ID,
		anyUUIDPtr(scanResult.EngagementID),
		anyUUIDPtr(scanResult.ProductID),
		anyUUIDPtr(scanResult.UploaderID),
		anyUUIDPtr(scanResult.ImportJobID),
		scanResult.Scanner,
		anyStringPtr(scanResult.SourceType),
		anyStringPtr(scanResult.SourceVersion),
		anyRawJSON(scanResult.RawReport),
		scanResult.ProcessedAt,
		scanResult.CreatedAt,
	)
	return err
}

// ---- findings ----

func CreateFinding(ctx context.Context, db *sql.DB, finding *models.Finding) error {
	return createFindingWithExecer(ctx, db, finding)
}

func CreateFindingTx(ctx context.Context, tx *sql.Tx, finding *models.Finding) error {
	return createFindingWithExecer(ctx, tx, finding)
}

func createFindingWithExecer(ctx context.Context, ex execer, finding *models.Finding) error {
	if err := finding.Validate(); err != nil {
		return err
	}
	finding.PrepareForInsert()

	_, err := ex.ExecContext(
		ctx,
		`INSERT INTO findings (id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, assignee_id, import_job_id, first_seen_at, last_seen_at, repeat_count, source_type, source_version, endpoint_method, endpoint_path, evidence, raw_data, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
		finding.ID,
		anyUUIDPtr(finding.ScanResultID),
		anyUUIDPtr(finding.ProductID),
		finding.Fingerprint,
		finding.Title,
		nullStringPtr(finding.Description),
		finding.Severity,
		finding.Status,
		anyUUIDPtr(finding.DuplicateID),
		anyUUIDPtr(finding.AssigneeID),
		anyUUIDPtr(finding.ImportJobID),
		finding.FirstSeenAt,
		finding.LastSeenAt,
		finding.RepeatCount,
		anyStringPtr(finding.SourceType),
		anyStringPtr(finding.SourceVersion),
		anyStringPtr(finding.EndpointMethod),
		anyStringPtr(finding.EndpointPath),
		anyRawJSON(finding.Evidence),
		anyRawJSON(finding.RawData),
		finding.CreatedAt,
		finding.UpdatedAt,
	)
	return err
}

// FindingMasterRecord хранит минимальные данные по master finding.
type FindingMasterRecord struct {
	ID          uuid.UUID
	RepeatCount int
}

func FindMasterFindingByFingerprint(ctx context.Context, db *sql.DB, fingerprint string, productID *uuid.UUID) (*FindingMasterRecord, error) {
	// PostgreSQL использует позиционные параметры $1,$2,... :contentReference[oaicite:3]{index=3}
	query := `SELECT id, repeat_count FROM findings WHERE fingerprint = $1 AND duplicate_id IS NULL AND deleted_at IS NULL`
	args := []any{fingerprint}

	if productID != nil {
		query += fmt.Sprintf(" AND product_id = $%d", len(args)+1)
		args = append(args, *productID)
	} else {
		// оставляю твою текущую семантику: nil => product_id IS NULL
		// (если хочешь nil == "любой продукт" — скажи, поменяем)
		query += " AND product_id IS NULL"
	}

	query += " LIMIT 1"

	row := db.QueryRowContext(ctx, query, args...)
	var record FindingMasterRecord
	if err := row.Scan(&record.ID, &record.RepeatCount); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// ---- scanners ----

func scanProductRow(row *sql.Row) (*models.Product, error) {
	var product models.Product
	var description sql.NullString
	var identifier sql.NullString
	var version sql.NullString
	var assetCriticality sql.NullString

	if err := row.Scan(
		&product.ID,
		&product.Name,
		&product.Slug,
		&description,
		&identifier,
		&version,
		&assetCriticality,
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
	if assetCriticality.Valid {
		product.AssetCriticality = &assetCriticality.String
	}

	return &product, nil
}
