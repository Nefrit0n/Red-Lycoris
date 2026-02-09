package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"red-lycoris/backend/internal/models"
)

type BlockingFinding struct {
	ID       uuid.UUID
	Title    string
	Severity string
	Category string
}

func ListBlockingFindingsByImportJob(ctx context.Context, db *sql.DB, importJobID uuid.UUID, minSeverityRank int) ([]BlockingFinding, error) {
	query := `
		SELECT f.id, f.title, f.severity, f.category
		FROM findings f
		WHERE f.deleted_at IS NULL
		  AND f.duplicate_id IS NULL
		  AND f.import_job_id = $1
		  AND f.status = ANY($3)
		  AND CASE LOWER(f.severity)
		        WHEN 'critical' THEN 4
		        WHEN 'high' THEN 3
		        WHEN 'medium' THEN 2
		        WHEN 'low' THEN 1
		        ELSE 0
		      END >= $2
		ORDER BY f.severity DESC, f.created_at ASC
	`

	rows, err := db.QueryContext(ctx, query, importJobID, minSeverityRank, pqStringArray(models.FindingOpenStatuses))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []BlockingFinding{}
	for rows.Next() {
		var item BlockingFinding
		if err := rows.Scan(&item.ID, &item.Title, &item.Severity, &item.Category); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}
