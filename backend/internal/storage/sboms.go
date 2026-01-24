package storage

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"

	"lotus-warden/backend/internal/models"
)

type SbomItem struct {
	ID               uuid.UUID
	ProductID        uuid.UUID
	Format           string
	ObjectKey        string
	SHA256           string
	OriginalFilename string
	SizeBytes        int64
	Metadata         json.RawMessage
	CreatedAt        sql.NullTime
}

func CreateSbom(ctx context.Context, db *sql.DB, sbom *models.Sbom) error {
	if err := sbom.Validate(); err != nil {
		return err
	}
	sbom.PrepareForInsert()

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO sboms (id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		sbom.ID,
		sbom.ProductID,
		sbom.Format,
		sbom.ObjectKey,
		sbom.SHA256,
		sbom.OriginalFilename,
		sbom.SizeBytes,
		anyRawJSON(sbom.Metadata),
		sbom.CreatedAt,
	)
	return err
}

func ListSbomsByProduct(ctx context.Context, db *sql.DB, productID uuid.UUID) ([]SbomItem, error) {
  rows, err := db.QueryContext(ctx, `
    SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata, created_at
    FROM sboms
    WHERE product_id = $1
    ORDER BY created_at DESC
  `, productID)
  if err != nil {
    return nil, fmt.Errorf("list sboms query failed: %w", err)
  }
  defer rows.Close()

  items := make([]SbomItem, 0)
  for rows.Next() {
    var item SbomItem
    var meta []byte

    if err := rows.Scan(
      &item.ID,
      &item.ProductID,
      &item.Format,
      &item.ObjectKey,
      &item.SHA256,
      &item.OriginalFilename,
      &item.SizeBytes,
      &meta,            // <-- ВАЖНО
      &item.CreatedAt,
    ); err != nil {
      return nil, fmt.Errorf("list sboms scan failed: %w", err)
    }

    if meta != nil {
      item.Metadata = json.RawMessage(meta)
    } else {
      item.Metadata = nil
    }

    items = append(items, item)
  }

  if err := rows.Err(); err != nil {
    return nil, fmt.Errorf("list sboms rows error: %w", err)
  }

  return items, nil
}


func GetSbomByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*SbomItem, error) {
  row := db.QueryRowContext(ctx, `
    SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata, created_at
    FROM sboms
    WHERE id = $1
  `, id)

  var item SbomItem
  var meta []byte

  if err := row.Scan(
    &item.ID,
    &item.ProductID,
    &item.Format,
    &item.ObjectKey,
    &item.SHA256,
    &item.OriginalFilename,
    &item.SizeBytes,
    &meta,            // <-- ВАЖНО
    &item.CreatedAt,
  ); err != nil {
    if err == sql.ErrNoRows {
      return nil, nil
    }
    return nil, fmt.Errorf("get sbom scan failed: %w", err)
  }

  if meta != nil {
    item.Metadata = json.RawMessage(meta)
  } else {
    item.Metadata = nil
  }

  return &item, nil
}

