package storage

import (
	"context"
	"database/sql"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

// SoftDeleteFinding marks a finding as deleted (soft delete).
// Returns the updated finding row (or nil if not found / already deleted).
func SoftDeleteFinding(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*models.Finding, error) {
	deletedAt := time.Now().UTC()

	row := db.QueryRowContext(
		ctx,
		`UPDATE findings
		 SET deleted_at = $1,
		     updated_at = $1
		 WHERE id = $2 AND deleted_at IS NULL
		 RETURNING id, scan_result_id, product_id, import_job_id, fingerprint, title, description, severity, status, duplicate_id, repeat_count,
			first_seen_at, last_seen_at, created_at, updated_at, deleted_at, evidence, source_type, category,
			sla_due_at, sla_breached, sla_breached_at, sla_profile, sla_source, assignee_id`,
		deletedAt,
		findingID,
	)

	var finding models.Finding
	var f findingScanFields
	if err := row.Scan(
		&finding.ID,
		&f.scanResultID,
		&f.productID,
		&f.importJobID,
		&finding.Fingerprint,
		&finding.Title,
		&f.description,
		&finding.Severity,
		&finding.Status,
		&f.duplicateID,
		&finding.RepeatCount,
		&f.firstSeenAt,
		&f.lastSeenAt,
		&f.createdAt,
		&f.updatedAt,
		&f.deletedAt,
		&f.evidence,
		&f.sourceType,
		&f.category,
		&f.slaDueAt,
		&f.slaBreached,
		&f.slaBreachedAt,
		&f.slaProfile,
		&f.slaSource,
		&f.assigneeID,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	populateFinding(&finding, &f)
	return &finding, nil
}
