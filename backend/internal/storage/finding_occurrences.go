package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type FindingOccurrenceItem struct {
	ID          uuid.UUID
	ImportJobID uuid.NullUUID
	SeenAt      time.Time
	Status      string
	Scanner     sql.NullString
	Description sql.NullString
}

func ListFindingOccurrences(ctx context.Context, db *sql.DB, masterID uuid.UUID) ([]FindingOccurrenceItem, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT f.id,
		        f.import_job_id,
		        COALESCE(f.first_seen_at, f.created_at) AS seen_at,
		        f.status,
		        sr.scanner,
		        f.description
		 FROM findings f
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 WHERE f.id = $1 AND f.deleted_at IS NULL
		 UNION ALL
		 SELECT f.id,
		        f.import_job_id,
		        f.created_at AS seen_at,
		        f.status,
		        sr.scanner,
		        f.description
		 FROM findings f
		 LEFT JOIN scan_results sr ON sr.id = f.scan_result_id
		 WHERE f.duplicate_id = $1 AND f.deleted_at IS NULL
		 ORDER BY seen_at DESC`,
		masterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []FindingOccurrenceItem{}
	for rows.Next() {
		var item FindingOccurrenceItem
		if err := rows.Scan(
			&item.ID,
			&item.ImportJobID,
			&item.SeenAt,
			&item.Status,
			&item.Scanner,
			&item.Description,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
