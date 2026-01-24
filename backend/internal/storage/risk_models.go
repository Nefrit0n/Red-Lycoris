package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type RiskModelActivation struct {
	TenantID     *uuid.UUID
	ModelVersion string
}

func ActivateRiskModel(ctx context.Context, db *sql.DB, modelID uuid.UUID) (*RiskModelActivation, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var tenantID *uuid.UUID
	var version string
	row := tx.QueryRowContext(ctx, `SELECT tenant_id, version FROM risk_models WHERE id = $1`, modelID)
	if err = row.Scan(&tenantID, &version); err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, err
	}

	if _, err = tx.ExecContext(ctx, `UPDATE risk_models SET is_active = false WHERE tenant_id IS NOT DISTINCT FROM $1`, anyUUIDPtr(tenantID)); err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE risk_models SET is_active = true WHERE id = $1`, modelID); err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return &RiskModelActivation{TenantID: tenantID, ModelVersion: version}, nil
}
