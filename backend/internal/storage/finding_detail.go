package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// FindingDetail — “расширенная” модель для выдачи detail-строк с join'ами (product_name и т.п.)
type FindingDetail struct {
	ID          uuid.UUID
	TenantID    uuid.UUID
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

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt sql.NullTime
}

// GetFindingDetailByID — отдельный метод для “детального” селекта (НЕ трогаем существующий GetFindingByID).
func GetFindingDetailByID(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT
			f.id, f.tenant_id, f.title, f.description, f.fingerprint, f.severity, f.status,
			f.product_id, p.name,
			f.assignee_id, f.import_job_id,
			f.first_seen_at, f.last_seen_at,
			f.repeat_count, f.duplicate_id,
			f.created_at, f.updated_at, f.deleted_at
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		WHERE f.id = $1 AND f.deleted_at IS NULL`,
		findingID,
	)

	var d FindingDetail
	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.Title,
		&d.Description,
		&d.Fingerprint,
		&d.Severity,
		&d.Status,
		&d.ProductID,
		&d.ProductName,
		&d.AssigneeID,
		&d.ImportJobID,
		&d.FirstSeenAt,
		&d.LastSeenAt,
		&d.RepeatCount,
		&d.DuplicateID,
		&d.CreatedAt,
		&d.UpdatedAt,
		&d.DeletedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &d, nil
}
