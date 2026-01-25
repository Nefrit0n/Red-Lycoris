package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type FindingDetail struct {
	ID uuid.UUID

	// Multi-tenancy / ownership
	TenantID uuid.NullUUID

	// Core fields
	Title       string
	Description sql.NullString
	Fingerprint string
	Severity    string
	Status      string
	Category    string

	// Relations
	ProductID   uuid.NullUUID
	ProductName sql.NullString

	AssigneeID  uuid.NullUUID
	ImportJobID uuid.NullUUID

	// Lifecycle
	FirstSeenAt sql.NullTime
	LastSeenAt  sql.NullTime
	RepeatCount int
	DuplicateID uuid.NullUUID

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt sql.NullTime

	// Source metadata (optional)
	SourceType     sql.NullString
	SourceVersion  sql.NullString
	EndpointMethod sql.NullString
	EndpointPath   sql.NullString

	// SLA (optional)
	SLADueAt      sql.NullTime
	SLABreached   sql.NullBool
	SLABreachedAt sql.NullTime
	SLAProfile    sql.NullString
	SLASource     sql.NullString

	// Risk (optional)
	RiskScore     sql.NullFloat64
	RiskBand      sql.NullString
	RiskUpdatedAt sql.NullTime
	RiskModel     sql.NullString
}

func GetFindingDetailByID(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(ctx, `
		SELECT
			f.id,
			f.tenant_id,
			f.title,
			f.description,
			f.fingerprint,
			f.severity,
			f.status,
			COALESCE(f.category, '') AS category,

			f.product_id,
			p.name AS product_name,

			f.assignee_id,
			f.import_job_id,

			f.first_seen_at,
			f.last_seen_at,
			f.repeat_count,
			f.duplicate_id,

			f.created_at,
			f.updated_at,
			f.deleted_at,

			f.source_type,
			NULL::text AS source_version,
			NULL::text AS endpoint_method,
			NULL::text AS endpoint_path,

			f.sla_due_at,
			f.sla_breached,
			f.sla_breached_at,
			f.sla_profile::text,
			f.sla_source,

			fr.risk_score,
			fr.risk_band,
			NULL::timestamptz AS risk_updated_at,
			NULL::text AS risk_model_version
		FROM findings f
		LEFT JOIN products p ON p.id = f.product_id
		LEFT JOIN finding_risk fr ON fr.finding_id = f.id
		WHERE f.id = $1
	`, findingID)

	var item FindingDetail
	if err := row.Scan(
		&item.ID,
		&item.TenantID,
		&item.Title,
		&item.Description,
		&item.Fingerprint,
		&item.Severity,
		&item.Status,
		&item.Category,

		&item.ProductID,
		&item.ProductName,

		&item.AssigneeID,
		&item.ImportJobID,

		&item.FirstSeenAt,
		&item.LastSeenAt,
		&item.RepeatCount,
		&item.DuplicateID,

		&item.CreatedAt,
		&item.UpdatedAt,
		&item.DeletedAt,

		&item.SourceType,
		&item.SourceVersion,
		&item.EndpointMethod,
		&item.EndpointPath,

		&item.SLADueAt,
		&item.SLABreached,
		&item.SLABreachedAt,
		&item.SLAProfile,
		&item.SLASource,

		&item.RiskScore,
		&item.RiskBand,
		&item.RiskUpdatedAt,
		&item.RiskModel,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &item, nil
}
