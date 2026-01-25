package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// FindingDetail is an extended shape for Findings detail view (with joins).
// Optional/nullable DB fields use sql.Null* types (see database/sql docs). :contentReference[oaicite:0]{index=0}
type FindingDetail struct {
	ID           uuid.UUID
	TenantID     uuid.NullUUID
	ScanResultID uuid.NullUUID
	ProductID    uuid.NullUUID
	ImportJobID  uuid.NullUUID
	Fingerprint  string

	// Category is NOT NULL in schema, so keep as plain string.
	Category    string
	Title       string
	Description sql.NullString
	Severity    string
	Status      string
	DuplicateID uuid.NullUUID
	AssigneeID  uuid.NullUUID

	FirstSeenAt  sql.NullTime
	LastSeenAt   sql.NullTime
	RepeatCount  int
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    sql.NullTime
	LastActivity time.Time

	// SLA
	SLADueAt      sql.NullTime
	SLABreached   sql.NullBool
	SLABreachedAt sql.NullTime
	SLAProfile    sql.NullString
	SLASource     sql.NullString

	// Evidence / raw
	Evidence json.RawMessage
	RawData  json.RawMessage

	// Source metadata (optional)
	SourceType     sql.NullString
	SourceVersion  sql.NullString
	EndpointMethod sql.NullString
	EndpointPath   sql.NullString

	// Risk (optional, from finding_risk)
	RiskScore     sql.NullFloat64
	RiskBand      sql.NullString
	RiskFactors   json.RawMessage
	RiskUpdatedAt sql.NullTime
	RiskModel     sql.NullString

	// Extra joins
	ProductName   sql.NullString
	Scanner       sql.NullString
	ScanCreatedAt sql.NullTime
}

func GetFindingDetailByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*FindingDetail, error) {
	row := db.QueryRowContext(ctx, `
SELECT
  f.id,
  f.tenant_id,
  f.scan_result_id,
  f.product_id,
  f.import_job_id,
  f.fingerprint,
  f.category,
  f.title,
  f.description,
  f.severity,
  f.status,
  f.duplicate_id,
  f.assignee_id,

  f.first_seen_at,
  f.last_seen_at,
  f.repeat_count,
  f.created_at,
  f.updated_at,
  f.deleted_at,
  COALESCE(f.last_seen_at, f.created_at) AS last_activity,

  f.sla_due_at,
  f.sla_breached,
  f.sla_breached_at,
  f.sla_profile,
  f.sla_source,

  f.evidence,
  f.raw_data,

  f.source_type,
  f.source_version,
  f.endpoint_method,
  f.endpoint_path,

  fr.risk_score,
  fr.risk_band,
  fr.factors,
  fr.computed_at,
  fr.model_version,

  p.name AS product_name,
  sr.scanner,
  sr.created_at AS scan_created_at
FROM findings f
LEFT JOIN finding_risk fr ON fr.finding_id = f.id
LEFT JOIN products p ON p.id = f.product_id
LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
WHERE f.id = $1 AND f.deleted_at IS NULL
`, id)

	var d FindingDetail
	var evidence, rawData, riskFactors []byte

	if err := row.Scan(
		&d.ID,
		&d.TenantID,
		&d.ScanResultID,
		&d.ProductID,
		&d.ImportJobID,
		&d.Fingerprint,
		&d.Category,
		&d.Title,
		&d.Description,
		&d.Severity,
		&d.Status,
		&d.DuplicateID,
		&d.AssigneeID,

		&d.FirstSeenAt,
		&d.LastSeenAt,
		&d.RepeatCount,
		&d.CreatedAt,
		&d.UpdatedAt,
		&d.DeletedAt,
		&d.LastActivity,

		&d.SLADueAt,
		&d.SLABreached,
		&d.SLABreachedAt,
		&d.SLAProfile,
		&d.SLASource,

		&evidence,
		&rawData,

		&d.SourceType,
		&d.SourceVersion,
		&d.EndpointMethod,
		&d.EndpointPath,

		&d.RiskScore,
		&d.RiskBand,
		&riskFactors,
		&d.RiskUpdatedAt,
		&d.RiskModel,

		&d.ProductName,
		&d.Scanner,
		&d.ScanCreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if evidence != nil {
		d.Evidence = json.RawMessage(evidence) // RawMessage is raw JSON bytes :contentReference[oaicite:1]{index=1}
	}
	if rawData != nil {
		d.RawData = json.RawMessage(rawData)
	}
	if riskFactors != nil {
		d.RiskFactors = json.RawMessage(riskFactors)
	}

	return &d, nil
}
