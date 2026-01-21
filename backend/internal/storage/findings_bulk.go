package storage

import (
	"context"
	"database/sql"
	"fmt"
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
		WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
		pqUUIDArray(ids),
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

func ListFindingsByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, limit int) ([]FindingSnapshot, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)
	query := fmt.Sprintf(
		`SELECT f.id, f.status, f.assignee_id, f.duplicate_id
		 FROM findings f
		 LEFT JOIN products p ON p.id = f.product_id
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 %s
		 ORDER BY f.created_at DESC`,
		whereClause,
	)
	if limit > 0 {
		args = append(args, limit)
		query += fmt.Sprintf(" LIMIT $%d", len(args))
	}
	rows, err := db.QueryContext(ctx, query, args...)
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

func CountFindingsByFilters(ctx context.Context, db *sql.DB, filters FindingFilters) (int, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)
	countQuery := "SELECT COUNT(*) FROM findings f LEFT JOIN products p ON p.id = f.product_id LEFT JOIN scan_results sr ON sr.id = f.scan_result_id " + whereClause
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
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

func BulkUpdateFindingStatusByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, status string) (int64, error) {
	whereClause, filterArgs := buildFindingWhereClause(filters, 2)
	args := append([]interface{}{status, time.Now().UTC()}, filterArgs...)
	query := fmt.Sprintf(
		`UPDATE findings
		 SET status = $1,
		     updated_at = $2
		 WHERE id IN (
		     SELECT f.id
		     FROM findings f
		     LEFT JOIN products p ON p.id = f.product_id
		     LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		     %s
		 )`,
		whereClause,
	)
	result, err := db.ExecContext(ctx, query, args...)
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

func BulkUpdateFindingAssigneeByFilters(ctx context.Context, db *sql.DB, filters FindingFilters, assigneeID *uuid.UUID) (int64, error) {
	var assignee interface{}
	if assigneeID != nil {
		assignee = *assigneeID
	}
	whereClause, filterArgs := buildFindingWhereClause(filters, 2)
	args := append([]interface{}{assignee, time.Now().UTC()}, filterArgs...)
	query := fmt.Sprintf(
		`UPDATE findings
		 SET assignee_id = $1,
		     updated_at = $2
		 WHERE id IN (
		     SELECT f.id
		     FROM findings f
		     LEFT JOIN products p ON p.id = f.product_id
		     LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		     %s
		 )`,
		whereClause,
	)
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
