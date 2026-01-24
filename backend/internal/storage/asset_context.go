package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type ProductAssetContext struct {
	ProductID          uuid.UUID
	TenantID           *uuid.UUID
	Environment        string
	InternetExposed    bool
	DataClassification string
	BusinessImpact     *string
	Tags               []string
	Metadata           json.RawMessage
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type ProductAssetContextUpsert struct {
	ProductID          uuid.UUID
	TenantID           *uuid.UUID
	Environment        string
	InternetExposed    bool
	DataClassification string
	BusinessImpact     *string
	Tags               []string
	Metadata           json.RawMessage
}

func ProductExistsForTenant(ctx context.Context, db *sql.DB, productID uuid.UUID, tenantID *uuid.UUID) (bool, error) {
	query := "SELECT EXISTS (SELECT 1 FROM products WHERE id = $1"
	args := []any{productID}
	if tenantID != nil {
		query += " AND tenant_id = $2)"
		args = append(args, *tenantID)
	} else {
		query += " AND tenant_id IS NULL)"
	}

	var exists bool
	if err := db.QueryRowContext(ctx, query, args...).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func GetProductAssetContext(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, productID uuid.UUID) (*ProductAssetContext, error) {
	query := `SELECT product_id, tenant_id, environment, internet_exposed, data_classification, business_impact,
	        tags, metadata, created_at, updated_at
	 FROM product_asset_context
	 WHERE product_id = $1`
	args := []any{productID}
	if tenantID != nil {
		query += " AND tenant_id = $2"
		args = append(args, *tenantID)
	} else {
		query += " AND tenant_id IS NULL"
	}

	row := db.QueryRowContext(ctx, query, args...)

	var record ProductAssetContext
	var tenant uuid.NullUUID
	var businessImpact sql.NullString
	var tags pq.StringArray
	var meta []byte
	if err := row.Scan(
		&record.ProductID,
		&tenant,
		&record.Environment,
		&record.InternetExposed,
		&record.DataClassification,
		&businessImpact,
		&tags,
		&meta,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get product asset context failed: %w", err)
	}

	if tenant.Valid {
		value := tenant.UUID
		record.TenantID = &value
	}
	if businessImpact.Valid {
		value := businessImpact.String
		record.BusinessImpact = &value
	}
	if len(tags) > 0 {
		record.Tags = []string(tags)
	}
	if meta != nil {
		record.Metadata = json.RawMessage(meta)
	}

	return &record, nil
}

func UpsertProductAssetContext(ctx context.Context, db *sql.DB, input ProductAssetContextUpsert) (*ProductAssetContext, error) {
	metadata := input.Metadata
	if len(metadata) == 0 {
		metadata = []byte(`{}`)
	}

	query := `INSERT INTO product_asset_context
		(tenant_id, product_id, environment, internet_exposed, data_classification, business_impact, tags, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
		ON CONFLICT (tenant_id, product_id)
		DO UPDATE SET
			environment = EXCLUDED.environment,
			internet_exposed = EXCLUDED.internet_exposed,
			data_classification = EXCLUDED.data_classification,
			business_impact = EXCLUDED.business_impact,
			tags = EXCLUDED.tags,
			metadata = EXCLUDED.metadata,
			updated_at = now()
		RETURNING product_id, tenant_id, environment, internet_exposed, data_classification, business_impact,
			tags, metadata, created_at, updated_at`

	row := db.QueryRowContext(
		ctx,
		query,
		anyUUIDPtr(input.TenantID),
		input.ProductID,
		input.Environment,
		input.InternetExposed,
		input.DataClassification,
		anyStringPtr(input.BusinessImpact),
		pqStringArray(input.Tags),
		anyRawJSON(metadata),
	)

	var record ProductAssetContext
	var tenant uuid.NullUUID
	var businessImpact sql.NullString
	var tags pq.StringArray
	var meta []byte
	if err := row.Scan(
		&record.ProductID,
		&tenant,
		&record.Environment,
		&record.InternetExposed,
		&record.DataClassification,
		&businessImpact,
		&tags,
		&meta,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("upsert product asset context failed: %w", err)
	}

	if tenant.Valid {
		value := tenant.UUID
		record.TenantID = &value
	}
	if businessImpact.Valid {
		value := businessImpact.String
		record.BusinessImpact = &value
	}
	if len(tags) > 0 {
		record.Tags = []string(tags)
	}
	if meta != nil {
		record.Metadata = json.RawMessage(meta)
	}

	return &record, nil
}
