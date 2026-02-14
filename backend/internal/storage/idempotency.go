package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type IdempotencyRecord struct {
	TenantID     uuid.UUID
	Scope        string
	Key          string
	RequestHash  string
	ResponseCode int
	ResponseBody json.RawMessage
	CreatedAt    time.Time
}

func GetIdempotencyKey(ctx context.Context, db *sql.DB, tenantID uuid.UUID, scope, key string) (*IdempotencyRecord, error) {
	row := db.QueryRowContext(ctx, `
		SELECT tenant_id, scope, key, request_hash, response_code, response_body_json, created_at
		FROM idempotency_keys
		WHERE tenant_id = $1 AND scope = $2 AND key = $3
	`, tenantID, scope, key)

	var record IdempotencyRecord
	if err := row.Scan(&record.TenantID, &record.Scope, &record.Key, &record.RequestHash, &record.ResponseCode, &record.ResponseBody, &record.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

func SaveIdempotencyKey(ctx context.Context, db *sql.DB, record IdempotencyRecord) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO idempotency_keys (tenant_id, scope, key, request_hash, response_code, response_body_json, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (tenant_id, scope, key) DO NOTHING
	`, record.TenantID, record.Scope, record.Key, record.RequestHash, record.ResponseCode, record.ResponseBody)
	return err
}
