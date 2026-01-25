package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// FindingDetail — "расширенная" модель для выдачи detail-строк с join'ами (product_name и т.п.)
type FindingDetail struct {
	ID          uuid.UUID
	TenantID    uuid.UUID
	Title       string
	Description sql.NullString
	Fingerprint string
	Severity    string
	Status      string
	Category    sql.NullString

	ProductID   uuid.NullUUID
	ProductName sql.NullString

	AssigneeID  uuid.NullUUID
	ImportJobID uuid.NullUUID

	FirstSeenAt sql.NullTime
	LastSeenAt  sql.NullTime

	RepeatCount int
	DuplicateID uuid.NullUUID

	SourceType    sql.NullString
	SourceVersion sql.NullString

	EndpointMethod sql.NullString
	EndpointPath   sql.NullString

	Evidence    json.RawMessage
	RiskFactors json.RawMessage

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt sql.NullTime
}

// GetFindingDetailByID — отдельный метод для "детального" селекта (НЕ трогаем существующий GetFindingByID).
func GetFindingDetailByID(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT
			f.id, f.tenant_id, f.title, f.description, f.fingerprint, f.severity, f.status, f.category,
			f.product_id, p.name,
			f.assignee_id, f.import_job_id,
			f.first_seen_at, f.last_seen_at,
			f.repeat_count, f.duplicate_id,
			f.source_type, f.source_version,
			f.endpoint_method, f.endpoint_path,
			f.evidence, fr.risk_factors,
			f.created_at, f.updated_at, f.deleted_at
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		WHERE f.id = $1 AND f.deleted_at IS NULL`,
		findingID,
	)

	var d FindingDetail
	var evidence, riskFactors []byte
	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.Title,
		&d.Description,
		&d.Fingerprint,
		&d.Severity,
		&d.Status,
		&d.Category,
		&d.ProductID,
		&d.ProductName,
		&d.AssigneeID,
		&d.ImportJobID,
		&d.FirstSeenAt,
		&d.LastSeenAt,
		&d.RepeatCount,
		&d.DuplicateID,
		&d.SourceType,
		&d.SourceVersion,
		&d.EndpointMethod,
		&d.EndpointPath,
		&evidence,
		&riskFactors,
		&d.CreatedAt,
		&d.UpdatedAt,
		&d.DeletedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if len(evidence) > 0 {
		d.Evidence = json.RawMessage(evidence)
	}
	if len(riskFactors) > 0 {
		d.RiskFactors = json.RawMessage(riskFactors)
	}

	return &d, nil
}
