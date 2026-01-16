package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type DuplicateGroup struct {
	Master     FindingDetail
	Duplicates []FindingDetail
}

func GetFindingDuplicateGroup(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*DuplicateGroup, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, duplicate_id
		 FROM findings
		 WHERE id = $1 AND deleted_at IS NULL`,
		findingID,
	)
	var id uuid.UUID
	var duplicateID uuid.NullUUID
	if err := row.Scan(&id, &duplicateID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	masterID := id
	if duplicateID.Valid {
		masterID = duplicateID.UUID
	}

	master, err := GetFindingByID(ctx, db, masterID)
	if err != nil || master == nil {
		return nil, err
	}

	rows, err := db.QueryContext(
		ctx,
		`SELECT f.id, f.title, f.description, f.fingerprint, f.severity, f.status, f.product_id, p.name, f.assignee_id, f.import_job_id, f.created_at, f.updated_at, f.deleted_at
		 FROM findings f
		 LEFT JOIN products p ON p.id = f.product_id
		 WHERE f.duplicate_id = $1 AND f.deleted_at IS NULL
		 ORDER BY f.created_at DESC`,
		masterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	duplicates := []FindingDetail{}
	for rows.Next() {
		var detail FindingDetail
		if err := rows.Scan(
			&detail.ID,
			&detail.Title,
			&detail.Description,
			&detail.Fingerprint,
			&detail.Severity,
			&detail.Status,
			&detail.ProductID,
			&detail.ProductName,
			&detail.AssigneeID,
			&detail.ImportJobID,
			&detail.CreatedAt,
			&detail.UpdatedAt,
			&detail.DeletedAt,
		); err != nil {
			return nil, err
		}
		duplicates = append(duplicates, detail)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &DuplicateGroup{
		Master:     *master,
		Duplicates: duplicates,
	}, nil
}
