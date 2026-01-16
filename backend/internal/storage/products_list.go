package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type ProductListItem struct {
	ID                uuid.UUID
	Name              string
	Identifier        sql.NullString
	Version           sql.NullString
	LastScanAt        sql.NullTime
	FindingsOpenCount int
}

func ListProducts(ctx context.Context, db *sql.DB, limit int, offset int) ([]ProductListItem, int, error) {
	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM products`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT p.id,
		        p.name,
		        p.identifier,
		        p.version,
		        MAX(sr.created_at) AS last_scan_at,
		        COUNT(f.id) FILTER (
		            WHERE f.deleted_at IS NULL
		              AND f.status IN ('new', 'under_review', 'confirmed', 'risk_accepted')
		        ) AS findings_open_count
		 FROM products p
		 LEFT JOIN scan_results sr ON sr.product_id = p.id
		 LEFT JOIN findings f ON f.product_id = p.id
		 GROUP BY p.id
		 ORDER BY p.created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit,
		offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []ProductListItem{}
	for rows.Next() {
		var item ProductListItem
		var lastScan sql.NullTime
		if err := rows.Scan(&item.ID, &item.Name, &item.Identifier, &item.Version, &lastScan, &item.FindingsOpenCount); err != nil {
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
