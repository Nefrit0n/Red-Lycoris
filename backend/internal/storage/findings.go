package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"lotus-warden/backend/internal/models"
)

type FindingListItem struct {
	ID           uuid.UUID
	Title        string
	Severity     string
	Status       string
	ProductID    uuid.NullUUID
	ProductName  sql.NullString
	AssigneeID   uuid.NullUUID
	AssigneeName sql.NullString
	ImportJobID  uuid.NullUUID
	CreatedAt    time.Time
	UpdatedAt    time.Time
	LastSeenAt   sql.NullTime
	RepeatCount  int
	DuplicateID  uuid.NullUUID
	Scanner      sql.NullString
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
	FirstSeenAt sql.NullTime
	LastSeenAt  sql.NullTime
	RepeatCount int
	DuplicateID uuid.NullUUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   sql.NullTime
}

type FindingFilters struct {
	Severity         string
	Status           string
	OccurrenceStatus string
	ScannerType      string
	ProductID        *uuid.UUID
	ImportJobID      *uuid.UUID
	Query            string
	DateFrom         *time.Time
	DateTo           *time.Time
	CanonicalOnly    bool
	IncludeRepeats   bool
	SortField        string
	SortOrder        string
	Limit            int
	Offset           int
}

// COALESCE для last_seen_at, чтобы NEW (где last_seen_at может быть NULL) нормально работали с date filters / sort.
const lastSeenExpr = "COALESCE(f.last_seen_at, f.created_at)"

func buildFindingWhereClause(filters FindingFilters, startIndex int) (string, []interface{}) {
	whereClause := "WHERE f.deleted_at IS NULL"
	args := []interface{}{}

	// По умолчанию хотим master-only (canonical).
	// Текущее поведение: если CanonicalOnly=true ИЛИ IncludeRepeats=false => показываем только master.
	if filters.CanonicalOnly || !filters.IncludeRepeats {
		whereClause += " AND f.duplicate_id IS NULL"
	}

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
		ph := startIndex + len(args)
		whereClause += fmt.Sprintf(
			" AND (f.title ILIKE $%d OR f.description ILIKE $%d OR f.fingerprint ILIKE $%d OR p.identifier ILIKE $%d OR p.name ILIKE $%d)",
			ph, ph, ph, ph, ph,
		)
	}

	if filters.ScannerType != "" {
		args = append(args, filters.ScannerType)
		whereClause += fmt.Sprintf(" AND sr.scanner = $%d", startIndex+len(args))
	}

	if filters.OccurrenceStatus != "" {
		switch strings.ToUpper(filters.OccurrenceStatus) {
		case "NEW":
			// NEW: master без повторов
			whereClause += " AND f.duplicate_id IS NULL AND f.repeat_count = 0"
		case "REPEAT":
			// REPEAT: либо master с repeat_count>0, либо duplicate-строки (если включены)
			whereClause += " AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL)"
		}
	}

	if filters.DateFrom != nil {
		args = append(args, *filters.DateFrom)
		whereClause += fmt.Sprintf(" AND %s >= $%d", lastSeenExpr, startIndex+len(args))
	}

	if filters.DateTo != nil {
		args = append(args, *filters.DateTo)
		whereClause += fmt.Sprintf(" AND %s <= $%d", lastSeenExpr, startIndex+len(args))
	}

	return whereClause, args
}

func ListFindings(ctx context.Context, db *sql.DB, filters FindingFilters) ([]FindingListItem, int, error) {
	// sane defaults / safety
	if filters.Limit <= 0 {
		filters.Limit = 50
	}
	if filters.Limit > 500 {
		filters.Limit = 500
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	whereClause, args := buildFindingWhereClause(filters, 0)

	sortField := resolveFindingSortField(filters.SortField)

	sortOrder := "DESC"
	if strings.EqualFold(filters.SortOrder, "asc") {
		sortOrder = "ASC"
	}

	// COUNT
	countQuery := `
		SELECT COUNT(*)
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
	` + " " + whereClause

	var total int
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// LIST
	args = append(args, filters.Limit, filters.Offset)
	limitPH := len(args) - 1
	offsetPH := len(args)

	// Стабильный ORDER BY: добавляем f.id как tie-breaker.
	listQuery := fmt.Sprintf(`
		SELECT
			f.id, f.title, f.severity, f.status,
			f.product_id, p.name,
			f.assignee_id, u.username,
			f.import_job_id,
			f.created_at, f.updated_at,
			f.last_seen_at, f.repeat_count,
			f.duplicate_id,
			sr.scanner
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN users u ON u.id = f.assignee_id
		LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		%s
		ORDER BY %s %s, f.id %s
		LIMIT $%d OFFSET $%d`,
		whereClause,
		sortField,
		sortOrder,
		sortOrder,
		limitPH,
		offsetPH,
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
			&item.AssigneeName,
			&item.ImportJobID,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.LastSeenAt,
			&item.RepeatCount,
			&item.DuplicateID,
			&item.Scanner,
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

type FindingNeighbors struct {
	PrevID   *uuid.UUID
	NextID   *uuid.UUID
	Position int
	Total    int
}

func GetFindingNeighbors(ctx context.Context, db *sql.DB, id uuid.UUID, filters FindingFilters) (*FindingNeighbors, error) {
	whereClause, args := buildFindingWhereClause(filters, 0)

	sortField := resolveFindingSortField(filters.SortField)

	sortOrder := "DESC"
	if strings.EqualFold(filters.SortOrder, "asc") {
		sortOrder = "ASC"
	}

	// Стабильный порядок: <field> <dir>, f.id <dir>
	orderClause := fmt.Sprintf("%s %s, f.id %s", sortField, sortOrder, sortOrder)

	args = append(args, id)
	query := fmt.Sprintf(`
		WITH ranked AS (
			SELECT
				f.id,
				row_number() OVER (ORDER BY %s) AS position,
				count(*) OVER () AS total,
				lag(f.id)  OVER (ORDER BY %s) AS prev_id,
				lead(f.id) OVER (ORDER BY %s) AS next_id
			FROM findings f
			LEFT JOIN products p ON p.id = f.product_id
			LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
			%s
		)
		SELECT prev_id, next_id, position, total
		FROM ranked
		WHERE id = $%d`,
		orderClause,
		orderClause,
		orderClause,
		whereClause,
		len(args),
	)

	var prevID uuid.NullUUID
	var nextID uuid.NullUUID
	var position int
	var total int

	err := db.QueryRowContext(ctx, query, args...).Scan(&prevID, &nextID, &position, &total)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &FindingNeighbors{
		PrevID:   nullableUUID(prevID),
		NextID:   nullableUUID(nextID),
		Position: position,
		Total:    total,
	}, nil
}

func GetFindingByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT
			f.id, f.title, f.description, f.fingerprint, f.severity, f.status,
			f.product_id, p.name,
			f.assignee_id, f.import_job_id,
			f.first_seen_at, f.last_seen_at, f.repeat_count, f.duplicate_id,
			f.created_at, f.updated_at, f.deleted_at
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
		&detail.FirstSeenAt,
		&detail.LastSeenAt,
		&detail.RepeatCount,
		&detail.DuplicateID,
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

func resolveFindingSortField(sortField string) string {
	switch sortField {
	case "title":
		return "f.title"
	case "productName":
		return "p.name"
	case "severity":
		return `CASE LOWER(f.severity)
			WHEN 'critical' THEN 4
			WHEN 'high' THEN 3
			WHEN 'medium' THEN 2
			WHEN 'low' THEN 1
			ELSE 0
		END`
	case "status":
		return "f.status"
	case "last_seen_at", "lastSeenAt":
		return lastSeenExpr
	case "created_at", "createdAt":
		return "f.created_at"
	case "updated_at", "updatedAt":
		return "f.updated_at"
	default:
		return "f.created_at"
	}
}

func nullableUUID(value uuid.NullUUID) *uuid.UUID {
	if value.Valid {
		clone := value.UUID
		return &clone
	}
	return nil
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
		RETURNING id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, assignee_id, import_job_id, first_seen_at, last_seen_at, repeat_count, created_at, updated_at, deleted_at`,
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
		 RETURNING id, scan_result_id, product_id, fingerprint, title, description, severity, status, duplicate_id, assignee_id, import_job_id, first_seen_at, last_seen_at, repeat_count, created_at, updated_at, deleted_at`,
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
		&finding.FirstSeenAt,
		&finding.LastSeenAt,
		&finding.RepeatCount,
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
