package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type FindingRiskContext struct {
	FindingID        uuid.UUID
	TenantID         *uuid.UUID
	Severity         string
	Status           string
	Category         string
	Identifiers      []string
	AssetCriticality string
	Environment      string
	InternetExposed  bool
	CVSSScore        *float64
	EPSSScore        *float64
	KEV              bool
	FirstSeenAt      sql.NullTime
	LastSeenAt       sql.NullTime
}

func GetFindingRiskContext(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*FindingRiskContext, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT f.id, f.tenant_id, f.severity, f.status, f.category, f.product_id, f.first_seen_at, f.last_seen_at, p.asset_criticality
		 FROM findings f
		 LEFT JOIN products p ON p.id = f.product_id
		 WHERE f.id = $1 AND f.deleted_at IS NULL`,
		findingID,
	)

	var record FindingRiskContext
	var tenantID uuid.NullUUID
	var productID uuid.NullUUID
	var assetCriticality sql.NullString
	if err := row.Scan(
		&record.FindingID,
		&tenantID,
		&record.Severity,
		&record.Status,
		&record.Category,
		&productID,
		&record.FirstSeenAt,
		&record.LastSeenAt,
		&assetCriticality,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get finding risk context failed: %w", err)
	}

	if tenantID.Valid {
		value := tenantID.UUID
		record.TenantID = &value
	}
	if assetCriticality.Valid {
		record.AssetCriticality = assetCriticality.String
	}

	intelSummary, err := GetIntelSummaries(ctx, db, []uuid.UUID{findingID})
	if err != nil {
		return nil, err
	}
	if summary, ok := intelSummary[findingID]; ok {
		record.Identifiers = summary.Identifiers
		record.CVSSScore = summary.CVSSScore
		record.EPSSScore = summary.EPSSScore
		record.KEV = summary.KEV
	}

	if productID.Valid {
		assetContext, err := GetProductAssetContext(ctx, db, record.TenantID, productID.UUID)
		if err != nil {
			return nil, err
		}
		if assetContext != nil {
			record.Environment = assetContext.Environment
			record.InternetExposed = assetContext.InternetExposed
		}
	}

	return &record, nil
}
