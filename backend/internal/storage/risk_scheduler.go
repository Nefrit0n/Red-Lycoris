package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

const (
	maxRiskSchedulerBatch = 5000
)

func GetRiskRecomputeCursor(ctx context.Context, db *sql.DB, tenantID uuid.UUID, source string) (time.Time, error) {
	var lastProcessedAt time.Time
	query := `
		SELECT last_processed_at
		FROM risk_recompute_cursors
		WHERE tenant_id = $1 AND source = $2`
	err := db.QueryRowContext(ctx, query, tenantID, source).Scan(&lastProcessedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}
	return lastProcessedAt, nil
}

func UpsertRiskRecomputeCursor(ctx context.Context, db *sql.DB, tenantID uuid.UUID, source string, lastProcessedAt time.Time) error {
	query := `
		INSERT INTO risk_recompute_cursors (tenant_id, source, last_processed_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (tenant_id, source)
		DO UPDATE SET last_processed_at = EXCLUDED.last_processed_at, updated_at = NOW()`
	_, err := db.ExecContext(ctx, query, tenantID, source, lastProcessedAt)
	return err
}

func ListTenantIDs(ctx context.Context, db *sql.DB) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT tenant_id
		FROM findings
		WHERE deleted_at IS NULL AND tenant_id IS NOT NULL`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []uuid.UUID
	for rows.Next() {
		var tenantID uuid.UUID
		if err := rows.Scan(&tenantID); err != nil {
			return nil, err
		}
		tenants = append(tenants, tenantID)
	}
	return tenants, rows.Err()
}

func ListAffectedFindingsByIntel(ctx context.Context, db *sql.DB, tenantID uuid.UUID, since time.Time, until time.Time, afterID uuid.UUID, limit int) ([]uuid.UUID, error) {
	if limit <= 0 || limit > maxRiskSchedulerBatch {
		limit = maxRiskSchedulerBatch
	}
	query := `
		SELECT DISTINCT f.id
		FROM finding_vuln_identifiers fvi
		JOIN vuln_intel vi ON vi.identifier = fvi.identifier
		JOIN findings f ON f.id = fvi.finding_id
		WHERE f.tenant_id = $1
			AND vi.updated_at > $2
			AND vi.updated_at <= $3
			AND f.deleted_at IS NULL
			AND f.status NOT IN ('resolved', 'accepted', 'mitigated')
			AND f.id > $4
		ORDER BY f.id
		LIMIT $5`

	rows, err := db.QueryContext(ctx, query, tenantID, since, until, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0, limit)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func ListAffectedFindingsByProduct(ctx context.Context, db *sql.DB, tenantID uuid.UUID, productID uuid.UUID, afterID uuid.UUID, limit int) ([]uuid.UUID, error) {
	if limit <= 0 || limit > maxRiskSchedulerBatch {
		limit = maxRiskSchedulerBatch
	}
	query := `
		SELECT f.id
		FROM findings f
		WHERE f.tenant_id = $1
			AND f.product_id = $2
			AND f.deleted_at IS NULL
			AND f.status NOT IN ('resolved', 'accepted', 'mitigated')
			AND f.id > $3
		ORDER BY f.id
		LIMIT $4`

	rows, err := db.QueryContext(ctx, query, tenantID, productID, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0, limit)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
