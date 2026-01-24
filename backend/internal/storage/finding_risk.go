package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type FindingRiskUpsert struct {
	FindingID    uuid.UUID
	TenantID     *uuid.UUID
	ModelVersion string
	RiskScore    float64
	RiskBand     string
	Factors      json.RawMessage
	ComputedAt   time.Time
	InputHash    string
	Source       string
}

func UpsertFindingRisk(ctx context.Context, db *sql.DB, input FindingRiskUpsert) (bool, error) {
	return upsertFindingRisk(ctx, db, input)
}

func UpsertFindingRiskTx(ctx context.Context, tx *sql.Tx, input FindingRiskUpsert) (bool, error) {
	return upsertFindingRisk(ctx, tx, input)
}

type riskExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func upsertFindingRisk(ctx context.Context, execer riskExecer, input FindingRiskUpsert) (bool, error) {
	result, err := execer.ExecContext(
		ctx,
		`INSERT INTO finding_risk
			(finding_id, tenant_id, model_version, risk_score, risk_band, factors, computed_at, input_hash, source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (finding_id) DO UPDATE SET
				model_version = EXCLUDED.model_version,
				risk_score = EXCLUDED.risk_score,
				risk_band = EXCLUDED.risk_band,
				factors = EXCLUDED.factors,
				computed_at = EXCLUDED.computed_at,
				input_hash = EXCLUDED.input_hash,
				source = EXCLUDED.source
			WHERE finding_risk.input_hash <> EXCLUDED.input_hash`,
		input.FindingID,
		anyUUIDPtr(input.TenantID),
		input.ModelVersion,
		input.RiskScore,
		input.RiskBand,
		input.Factors,
		input.ComputedAt,
		input.InputHash,
		input.Source,
	)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}
