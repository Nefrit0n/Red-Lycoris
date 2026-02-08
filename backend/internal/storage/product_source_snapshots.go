package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

type ProductSourceSnapshotItem struct {
	ID             uuid.UUID
	TenantID       uuid.NullUUID
	ProductID      uuid.UUID
	OriginalName   sql.NullString
	Label          sql.NullString
	Notes          sql.NullString
	ObjectKey      string
	ArchiveSize    int64
	SHA256         sql.NullString
	IdempotencyKey sql.NullString
	CreatedBy      uuid.NullUUID
	CreatedAt      time.Time
	DeletedAt      sql.NullTime
}

func CreateProductSourceSnapshot(ctx context.Context, db *sql.DB, snapshot *models.ProductSourceSnapshot) error {
	if err := snapshot.Validate(); err != nil {
		return err
	}
	snapshot.PrepareForInsert()

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO product_source_snapshots (
			id,
			tenant_id,
			product_id,
			original_filename,
			label,
			notes,
			object_key,
			archive_size,
			sha256,
			idempotency_key,
			created_by,
			created_at,
			deleted_at
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
		)`,
		snapshot.ID,
		anyUUIDPtr(snapshot.TenantID),
		snapshot.ProductID,
		anyStringPtr(snapshot.OriginalName),
		anyStringPtr(snapshot.Label),
		anyStringPtr(snapshot.Notes),
		snapshot.ObjectKey,
		snapshot.ArchiveSize,
		anyStringPtr(snapshot.SHA256),
		anyStringPtr(snapshot.IdempotencyKey),
		anyUUIDPtr(snapshot.CreatedBy),
		snapshot.CreatedAt,
		snapshot.DeletedAt,
	)
	return err
}

func ListProductSourceSnapshots(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, productID uuid.UUID, limit int, offset int) ([]ProductSourceSnapshotItem, int, error) {
	where, args := buildProductSourceSnapshotFilter(tenantID, productID)
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM product_source_snapshots %s", where)
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := db.QueryContext(
		ctx,
		fmt.Sprintf(
			`SELECT id,
		        tenant_id,
		        product_id,
		        original_filename,
		        label,
		        notes,
		        object_key,
		        archive_size,
		        sha256,
		        idempotency_key,
		        created_by,
		        created_at,
		        deleted_at
		 FROM product_source_snapshots
		 %s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
			where,
			len(args)-1,
			len(args),
		),
		args...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]ProductSourceSnapshotItem, 0)
	for rows.Next() {
		var item ProductSourceSnapshotItem
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.ProductID,
			&item.OriginalName,
			&item.Label,
			&item.Notes,
			&item.ObjectKey,
			&item.ArchiveSize,
			&item.SHA256,
			&item.IdempotencyKey,
			&item.CreatedBy,
			&item.CreatedAt,
			&item.DeletedAt,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetLatestProductSourceSnapshot(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, productID uuid.UUID) (*ProductSourceSnapshotItem, error) {
	where, args := buildProductSourceSnapshotFilter(tenantID, productID)
	query := fmt.Sprintf(`SELECT id,
	        tenant_id,
	        product_id,
	        original_filename,
	        label,
	        notes,
	        object_key,
	        archive_size,
	        sha256,
	        idempotency_key,
	        created_by,
	        created_at,
	        deleted_at
	 FROM product_source_snapshots
	 %s
	 ORDER BY created_at DESC
	 LIMIT 1`, where)
	row := db.QueryRowContext(ctx, query, args...)
	return scanProductSourceSnapshotRow(row)
}

func GetProductSourceSnapshotByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*ProductSourceSnapshotItem, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id,
		        tenant_id,
		        product_id,
		        original_filename,
		        label,
		        notes,
		        object_key,
		        archive_size,
		        sha256,
		        idempotency_key,
		        created_by,
		        created_at,
		        deleted_at
		 FROM product_source_snapshots
		 WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	return scanProductSourceSnapshotRow(row)
}

func buildProductSourceSnapshotFilter(tenantID *uuid.UUID, productID uuid.UUID) (string, []any) {
	args := []any{productID}
	query := "WHERE product_id = $1 AND deleted_at IS NULL"
	if tenantID != nil {
		args = append(args, *tenantID)
		query += fmt.Sprintf(" AND tenant_id = $%d", len(args))
	} else {
		query += " AND tenant_id IS NULL"
	}
	return query, args
}

func scanProductSourceSnapshotRow(s scanner) (*ProductSourceSnapshotItem, error) {
	var item ProductSourceSnapshotItem
	if err := s.Scan(
		&item.ID,
		&item.TenantID,
		&item.ProductID,
		&item.OriginalName,
		&item.Label,
		&item.Notes,
		&item.ObjectKey,
		&item.ArchiveSize,
		&item.SHA256,
		&item.IdempotencyKey,
		&item.CreatedBy,
		&item.CreatedAt,
		&item.DeletedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func GetProductSourceSnapshotByIdempotencyKey(ctx context.Context, db *sql.DB, tenantID *uuid.UUID, key string) (*ProductSourceSnapshotItem, error) {
	if tenantID == nil {
		return nil, nil
	}
	row := db.QueryRowContext(
		ctx,
		`SELECT id,
		        tenant_id,
		        product_id,
		        original_filename,
		        label,
		        notes,
		        object_key,
		        archive_size,
		        sha256,
		        idempotency_key,
		        created_by,
		        created_at,
		        deleted_at
		 FROM product_source_snapshots
		 WHERE tenant_id = $1 AND idempotency_key = $2 AND deleted_at IS NULL`,
		*tenantID,
		key,
	)
	return scanProductSourceSnapshotRow(row)
}
