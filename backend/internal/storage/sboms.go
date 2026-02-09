package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"red-lycoris/backend/internal/models"
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
	IndexStatus      string
	IndexedAt        sql.NullTime
	IndexError       sql.NullString
	ComponentCount   int
	EdgeCount        int
	Version          int
	CreatedAt        sql.NullTime
}

func CreateSbom(ctx context.Context, db *sql.DB, sbom *models.Sbom) error {
	if err := sbom.Validate(); err != nil {
		return err
	}
	sbom.PrepareForInsert()

	// Чтобы не хранить NULL и не ловить Scan-ошибки в будущем.
	// (Даже если потом добавишь в БД DEFAULT '{}'::jsonb — это всё равно полезно.)
	if len(sbom.Metadata) == 0 {
		sbom.Metadata = []byte(`{}`)
	}

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
	if err != nil {
		return fmt.Errorf("create sbom failed: %w", err)
	}
	return nil
}

func ListSbomsByProduct(ctx context.Context, db *sql.DB, productID uuid.UUID) ([]SbomItem, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata,
		        index_status, indexed_at, index_error, component_count, edge_count, created_at,
		        row_number() OVER (PARTITION BY product_id ORDER BY created_at ASC, id ASC) AS version
		 FROM sboms
		 WHERE product_id = $1
		 ORDER BY created_at DESC, id DESC`,
		productID,
	)
	if err != nil {
		return nil, fmt.Errorf("list sboms query failed: %w", err)
	}
	defer rows.Close()

	items := make([]SbomItem, 0)
	for rows.Next() {
		var item SbomItem
		var meta []byte // <-- ключевой момент

		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.Format,
			&item.ObjectKey,
			&item.SHA256,
			&item.OriginalFilename,
			&item.SizeBytes,
			&meta,
			&item.IndexStatus,
			&item.IndexedAt,
			&item.IndexError,
			&item.ComponentCount,
			&item.EdgeCount,
			&item.CreatedAt,
			&item.Version,
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

func GetSbomIDByProductVersion(ctx context.Context, db *sql.DB, productID uuid.UUID, version int) (*uuid.UUID, error) {
	if version <= 0 {
		return nil, nil
	}
	row := db.QueryRowContext(ctx, `
		SELECT id
		FROM (
			SELECT id, row_number() OVER (PARTITION BY product_id ORDER BY created_at ASC, id ASC) AS v
			FROM sboms
			WHERE product_id = $1
		) t
		WHERE t.v = $2
	`, productID, version)

	var id uuid.UUID
	if err := row.Scan(&id); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get sbom by product version failed: %w", err)
	}
	return &id, nil
}

func GetSbomByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*SbomItem, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata,
		        index_status, indexed_at, index_error, component_count, edge_count, created_at
		 FROM sboms
		 WHERE id = $1`,
		id,
	)

	var item SbomItem
	var meta []byte // <-- и тут так же

	if err := row.Scan(
		&item.ID,
		&item.ProductID,
		&item.Format,
		&item.ObjectKey,
		&item.SHA256,
		&item.OriginalFilename,
		&item.SizeBytes,
		&meta,
		&item.IndexStatus,
		&item.IndexedAt,
		&item.IndexError,
		&item.ComponentCount,
		&item.EdgeCount,
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

type SbomIndexStatus struct {
	SbomID         uuid.UUID
	Status         string
	IndexedAt      sql.NullTime
	IndexError     sql.NullString
	ComponentCount int
	EdgeCount      int
}

func UpdateSbomIndexStatus(ctx context.Context, db *sql.DB, sbomID uuid.UUID, status string, indexedAt *time.Time, indexError *string, componentCount int, edgeCount int) error {
	_, err := db.ExecContext(
		ctx,
		`UPDATE sboms
		 SET index_status = $2,
		     indexed_at = $3,
		     index_error = $4,
		     component_count = $5,
		     edge_count = $6
		 WHERE id = $1`,
		sbomID,
		status,
		nullTimePtr(indexedAt),
		nullStringPtr(indexError),
		componentCount,
		edgeCount,
	)
	if err != nil {
		return fmt.Errorf("update sbom index status failed: %w", err)
	}
	return nil
}

func GetLatestSbomByProduct(ctx context.Context, db *sql.DB, productID uuid.UUID) (*SbomItem, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata,
		        index_status, indexed_at, index_error, component_count, edge_count, created_at
		 FROM sboms
		 WHERE product_id = $1
		 ORDER BY created_at DESC
		 LIMIT 1`,
		productID,
	)

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
		&meta,
		&item.IndexStatus,
		&item.IndexedAt,
		&item.IndexError,
		&item.ComponentCount,
		&item.EdgeCount,
		&item.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest sbom scan failed: %w", err)
	}

	if meta != nil {
		item.Metadata = json.RawMessage(meta)
	}

	return &item, nil
}

func GetLatestIndexedSbomByProduct(ctx context.Context, db *sql.DB, productID uuid.UUID) (*SbomItem, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, product_id, format, object_key, sha256, original_filename, size_bytes, metadata,
		        index_status, indexed_at, index_error, component_count, edge_count, created_at
		 FROM sboms
		 WHERE product_id = $1 AND index_status = 'done'
		 ORDER BY indexed_at DESC NULLS LAST, created_at DESC
		 LIMIT 1`,
		productID,
	)

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
		&meta,
		&item.IndexStatus,
		&item.IndexedAt,
		&item.IndexError,
		&item.ComponentCount,
		&item.EdgeCount,
		&item.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get latest indexed sbom scan failed: %w", err)
	}

	if meta != nil {
		item.Metadata = json.RawMessage(meta)
	}

	return &item, nil
}
