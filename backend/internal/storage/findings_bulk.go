package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type FindingSnapshot struct {
	ID          uuid.UUID
	Status      string
	AssigneeID  uuid.NullUUID
	DuplicateID uuid.NullUUID
}

func ListFindingsByIDs(ctx context.Context, db *sql.DB, ids []uuid.UUID) ([]FindingSnapshot, error) {
	if len(ids) == 0 {
		return []FindingSnapshot{}, nil
	}
	rows, err := db.QueryContext(
		ctx,
		`SELECT id, status, assignee_id, duplicate_id
		 FROM findings
		 WHERE id = ANY($1) AND deleted_at IS NULL`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []FindingSnapshot{}
	for rows.Next() {
		var item FindingSnapshot
		if err := rows.Scan(&item.ID, &item.Status, &item.AssigneeID, &item.DuplicateID); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func BulkUpdateFindingStatus(ctx context.Context, db *sql.DB, ids []uuid.UUID, status string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET status = $1,
		     updated_at = $2
		 WHERE id = ANY($3) AND deleted_at IS NULL`,
		status,
		time.Now().UTC(),
		ids,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func BulkUpdateFindingAssignee(ctx context.Context, db *sql.DB, ids []uuid.UUID, assigneeID *uuid.UUID) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	var assignee interface{}
	if assigneeID != nil {
		assignee = *assigneeID
	}
	result, err := db.ExecContext(
		ctx,
		`UPDATE findings
		 SET assignee_id = $1,
		     updated_at = $2
		 WHERE id = ANY($3) AND deleted_at IS NULL`,
		assignee,
		time.Now().UTC(),
		ids,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
