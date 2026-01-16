package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

type FindingListItem struct {
	ID          uuid.UUID
	Title       string
	Severity    string
	Status      string
	ProductID   uuid.NullUUID
	ProductName sql.NullString
	AssigneeID  uuid.NullUUID
	ImportJobID uuid.NullUUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type FindingDetail struct {
	ID          uuid.UUID
	Title       string
	Description sql.NullString
	Fingerprint string
	Severity    string
	Status      string
	ProductID   uuid.NullUUID
	ProductName sql.NullString
	AssigneeID  uuid.NullUUID
	ImportJobID uuid.NullUUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   sql.NullTime
}

type FindingFilters struct {
	Severity    string
	Status      string
	ProductID   *uuid.UUID
	ImportJobID *uuid.UUID
	Query       string
	SortField   string
	SortOrder   string
	Limit       int
	Offset      int
}

func buildFindingWhereClause(filters FindingFilters, startIndex int) (string, []interface{}) {
	whereClause := "WHERE f.deleted_at IS NULL"
	args := []interface{}{}

	if filters.Severity != "" {
		args = append(args, filters.Severity)
		whereClause += fmt.Sprintf(" AND f.severity = $%d", startIndex+len(args))
	}
	if filters.Status != "" {
		args = append(args, filters.Status)
		whereClause += fmt.Sprintf(" AND f.status = $%d", startIndex+len(args))
	}
	if filters.ProductID != nil {
		args = append(args, *filters.ProductID)
		whereClause += fmt.Sprintf(" AND f.product_id = $%d", startIndex+len(args))
	}
	if filters.ImportJobID != nil {
		args = append(args, *filters.ImportJobID)
		whereClause += fmt.Sprintf(" AND f.import_job_id = $%d", startIndex+len(args))
	}
	if filters.Query != "" {
		args = append(args, "%"+filters.Query+"%")
		whereClause += fmt.Sprintf(
			" AND (f.title ILIKE $%d OR f.fingerprint ILIKE $%d OR p.identifier ILIKE $%d)",
			startIndex+len(args),
			startIndex+len(args),
			startIndex+len(args),
		)
	}
	return whereClause, args
}

func ListFindings(ctx context.Context, db *sql.DB, filters FindingFilters) ([]FindingListItem, int, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)

	sortField := "f.created_at"
	switch filters.SortField {
	case "title":
		sortField = "f.title"
	case "productName":
		sortField = "p.name"
	case "severity":
		sortField = "f.severity"
	case "status":
		sortField = "f.status"
	case "created_at", "createdAt":
		sortField = "f.created_at"
	case "updated_at", "updatedAt":
		sortField = "f.updated_at"
	}

	sortOrder := "DESC"
	if strings.EqualFold(filters.SortOrder, "asc") {
		sortOrder = "ASC"
	}

	countQuery := "SELECT COUNT(*) FROM findings f LEFT JOIN products p ON p.id = f.product_id " + whereClause
	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	listQuery := fmt.Sprintf(`
		SELECT f.id, f.title, f.severity, f.status, f.product_id, p.name, f.assignee_id, f.import_job_id, f.created_at, f.updated_at
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		%s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d`,
		whereClause,
		sortField,
		sortOrder,
		len(args)-1,
		len(args),
	)

	rows, err := db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []FindingListItem{}
	for rows.Next() {
		var item FindingListItem
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Severity,
			&item.Status,
			&item.ProductID,
			&item.ProductName,
			&item.AssigneeID,
			&item.ImportJobID,
			&item.CreatedAt,
			&item.UpdatedAt,
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

func GetFindingByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT f.id, f.title, f.description, f.fingerprint, f.severity, f.status, f.product_id, p.name, f.assignee_id, f.import_job_id, f.created_at, f.updated_at, f.deleted_at
		 FROM findings f
		 LEFT JOIN products p ON p.id = f.product_id
		 WHERE f.id = $1 AND f.deleted_at IS NULL`,
		id,
	)

	var detail FindingDetail
	if err := row.Scan(
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
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &detail, nil
}

type UpdateFindingParams struct {
	Title       *string
	Description *string
	Severity    *string
	Status      *string
	ProductID   *uuid.UUID
	AssigneeID  *uuid.UUID
}

func UpdateFinding(ctx context.Context, db *sql.DB, id uuid.UUID, params UpdateFindingParams) (*models.Finding, error) {
	setClauses := []string{}
	args := []interface{}{}

	if params.Title != nil {
		args = append(args, *params.Title)
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", len(args)))
	}
	if params.Description != nil {
		args = append(args, *params.Description)
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", len(args)))
	}
	if params.Severity != nil {
		args = append(args, *params.Severity)
		setClauses = append(setClauses, fmt.Sprintf("severity = $%d", len(args)))
	}
	if params.Status != nil {
		args = append(args, *params.Status)
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", len(args)))
	}
	if params.ProductID != nil {
		args = append(args, *params.ProductID)
		setClauses = append(setClauses, fmt.Sprintf("product_id = $%d", len(args)))
	}
	if params.AssigneeID != nil {
		args = append(args, *params.AssigneeID)
		setClauses = append(setClauses, fmt.Sprintf("assignee_id = $%d", len(args)))
	}

	if len(setClauses) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	args = append(args, time.Now().UTC())
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", len(args)))

	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE findings
		SET %s
		WHERE id = $%d AND deleted_at IS NULL
		RETURNING id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, assignee_id, import_job_id, created_at, updated_at, deleted_at`,
		strings.Join(setClauses, ", "),
		len(args),
	)

	row := db.QueryRowContext(ctx, query, args...)
	finding, err := scanFindingRow(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return finding, nil
}

func SoftDeleteFinding(ctx context.Context, db *sql.DB, id uuid.UUID) (*models.Finding, error) {
	now := time.Now().UTC()
	row := db.QueryRowContext(
		ctx,
		`UPDATE findings
		 SET deleted_at = $1, updated_at = $1
		 WHERE id = $2 AND deleted_at IS NULL
		 RETURNING id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, assignee_id, import_job_id, created_at, updated_at, deleted_at`,
		now,
		id,
	)

	finding, err := scanFindingRow(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return finding, nil
}

func scanFindingRow(row *sql.Row) (*models.Finding, error) {
	var finding models.Finding
	var scanResultID uuid.NullUUID
	var productID uuid.NullUUID
	var duplicateID uuid.NullUUID
	var assigneeID uuid.NullUUID
	var importJobID uuid.NullUUID
	var description sql.NullString
	var deletedAt sql.NullTime

	if err := row.Scan(
		&finding.ID,
		&scanResultID,
		&productID,
		&finding.Fingerprint,
		&finding.Title,
		&description,
		&finding.Severity,
		&finding.Status,
		&duplicateID,
		&assigneeID,
		&importJobID,
		&finding.CreatedAt,
		&finding.UpdatedAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}

	if scanResultID.Valid {
		value := scanResultID.UUID
		finding.ScanResultID = &value
	}
	if productID.Valid {
		value := productID.UUID
		finding.ProductID = &value
	}
	if description.Valid {
		value := description.String
		finding.Description = &value
	}
	if duplicateID.Valid {
		value := duplicateID.UUID
		finding.DuplicateID = &value
	}
	if assigneeID.Valid {
		value := assigneeID.UUID
		finding.AssigneeID = &value
	}
	if importJobID.Valid {
		value := importJobID.UUID
		finding.ImportJobID = &value
	}
	if deletedAt.Valid {
		value := deletedAt.Time
		finding.DeletedAt = &value
	}

	return &finding, nil
}
