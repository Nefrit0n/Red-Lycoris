package storage

import (
	"context"
	"database/sql"
	"time"

	"lotus-warden/backend/internal/models"
)

// MarkSLABreaches marks findings as breached when due dates pass and status is still open.
func MarkSLABreaches(ctx context.Context, db *sql.DB, now time.Time) (int64, error) {
	query := `
		UPDATE findings
		SET sla_breached = true,
		    sla_breached_at = COALESCE(sla_breached_at, $1),
		    updated_at = $1
		WHERE sla_due_at IS NOT NULL
		  AND sla_due_at <= $1
		  AND sla_breached = false
		  AND deleted_at IS NULL
		  AND status = ANY($2)
	`
	result, err := db.ExecContext(ctx, query, now, pqStringArray(models.FindingOpenStatuses))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
