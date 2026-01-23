package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ProductListItem struct {
	ID                uuid.UUID
	TenantID          uuid.NullUUID
	Name              string
	Identifier        sql.NullString
	Version           sql.NullString
	AssetCriticality  sql.NullString
	LastScanAt        sql.NullTime
	FindingsOpenCount int
}

func ListProducts(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, limit int, offset int) ([]ProductListItem, int, error) {
	var total int
	countQuery := `SELECT COUNT(*) FROM products`
	args := []any{}
	if tenantID != nil {
		countQuery += " WHERE tenant_id = $1"
		args = append(args, *tenantID)
	}
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	whereClause := ""
	queryArgs := []any{}
	if tenantID != nil {
		whereClause = "WHERE p.tenant_id = $1"
		queryArgs = append(queryArgs, *tenantID)
	}
	queryArgs = append(queryArgs, limit, offset)
	limitArg := len(queryArgs) - 1
	offsetArg := len(queryArgs)
	rows, err := db.QueryContext(
		ctx,
		fmt.Sprintf(
			`SELECT p.id,
		        p.tenant_id,
		        p.name,
		        p.identifier,
		        p.version,
		        p.asset_criticality,
		        MAX(sr.created_at) AS last_scan_at,
		        COUNT(f.id) FILTER (
		            WHERE f.deleted_at IS NULL
		              AND f.status IN ('new', 'under_review', 'confirmed', 'risk_accepted')
		        ) AS findings_open_count
		 FROM products p
		 LEFT JOIN scan_results sr ON sr.product_id = p.id
		 LEFT JOIN findings f ON f.product_id = p.id
		 %s
		 GROUP BY p.id
		 ORDER BY p.created_at DESC
		 LIMIT $%d OFFSET $%d`,
			whereClause,
			limitArg,
			offsetArg,
		),
		queryArgs...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []ProductListItem{}
	for rows.Next() {
		var item ProductListItem
		var lastScan sql.NullTime
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.Identifier, &item.Version, &item.AssetCriticality, &lastScan, &item.FindingsOpenCount); err != nil {
			return nil, 0, err
		}
		item.LastScanAt = lastScan
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func UpdateProductLastScan(ctx context.Context, db *sql.DB, productID uuid.UUID, scannedAt time.Time) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE products
		 SET updated_at = $1
		 WHERE id = $2`,
		scannedAt,
		productID,
	)
	return err
}
