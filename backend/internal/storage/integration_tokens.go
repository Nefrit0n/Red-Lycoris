package storage

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type IntegrationToken struct {
	ID              uuid.UUID
	OrgID           uuid.UUID
	ProjectID       sql.NullString
	Name            string
	TokenHash       string
	Scopes          []string
	CreatedAt       time.Time
	ExpiresAt       time.Time
	RevokedAt       sql.NullTime
	LastUsedAt      sql.NullTime
	CreatedByUserID sql.NullString
}

type OrgSecurityPolicy struct {
	DefaultTokenTTLDays int
	MaxTokenTTLDays     int
}

func GetOrgSecurityPolicy(ctx context.Context, db *sql.DB, orgID uuid.UUID) (OrgSecurityPolicy, error) {
	var p OrgSecurityPolicy
	err := db.QueryRowContext(ctx, `
		SELECT default_token_ttl_days, max_token_ttl_days
		FROM org_security_policies WHERE org_id=$1
	`, orgID).Scan(&p.DefaultTokenTTLDays, &p.MaxTokenTTLDays)
	if err == sql.ErrNoRows {
		return OrgSecurityPolicy{DefaultTokenTTLDays: 90, MaxTokenTTLDays: 365}, nil
	}
	return p, err
}

func CreateIntegrationToken(ctx context.Context, db *sql.DB, t IntegrationToken) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO integration_tokens (
			id, org_id, project_id, name, token_hash, scopes, created_at, expires_at, created_by_user_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`, t.ID, t.OrgID, nullUUIDText(t.ProjectID), t.Name, t.TokenHash, pq.Array(t.Scopes), t.CreatedAt, t.ExpiresAt, nullUUIDText(t.CreatedByUserID))
	return err
}

func ListIntegrationTokens(ctx context.Context, db *sql.DB, orgID uuid.UUID, projectID *uuid.UUID) ([]IntegrationToken, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, org_id, COALESCE(project_id::text,''), name, token_hash, scopes, created_at, expires_at, revoked_at, last_used_at, COALESCE(created_by_user_id::text,'')
		FROM integration_tokens
		WHERE org_id=$1 AND ($2::uuid IS NULL OR project_id=$2)
		ORDER BY created_at DESC
	`, orgID, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	res := make([]IntegrationToken, 0)
	for rows.Next() {
		var t IntegrationToken
		if err := rows.Scan(&t.ID, &t.OrgID, &t.ProjectID, &t.Name, &t.TokenHash, pq.Array(&t.Scopes), &t.CreatedAt, &t.ExpiresAt, &t.RevokedAt, &t.LastUsedAt, &t.CreatedByUserID); err != nil {
			return nil, err
		}
		res = append(res, t)
	}
	return res, rows.Err()
}

func GetIntegrationTokenByID(ctx context.Context, db *sql.DB, id uuid.UUID) (*IntegrationToken, error) {
	var t IntegrationToken
	err := db.QueryRowContext(ctx, `
		SELECT id, org_id, COALESCE(project_id::text,''), name, token_hash, scopes, created_at, expires_at, revoked_at, last_used_at, COALESCE(created_by_user_id::text,'')
		FROM integration_tokens WHERE id=$1
	`, id).Scan(&t.ID, &t.OrgID, &t.ProjectID, &t.Name, &t.TokenHash, pq.Array(&t.Scopes), &t.CreatedAt, &t.ExpiresAt, &t.RevokedAt, &t.LastUsedAt, &t.CreatedByUserID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func UpdateIntegrationTokenPatch(ctx context.Context, db *sql.DB, id uuid.UUID, name *string, expiresAt *time.Time) error {
	_, err := db.ExecContext(ctx, `
		UPDATE integration_tokens
		SET name = COALESCE($2, name),
			expires_at = COALESCE($3, expires_at)
		WHERE id=$1
	`, id, name, expiresAt)
	return err
}

func RevokeIntegrationToken(ctx context.Context, db *sql.DB, id uuid.UUID, revokedAt time.Time) error {
	_, err := db.ExecContext(ctx, `UPDATE integration_tokens SET revoked_at=$2 WHERE id=$1 AND revoked_at IS NULL`, id, revokedAt)
	return err
}

func RotateIntegrationToken(ctx context.Context, db *sql.DB, id uuid.UUID, newHash string, expiresAt time.Time) error {
	_, err := db.ExecContext(ctx, `UPDATE integration_tokens SET token_hash=$2, expires_at=$3, revoked_at=NULL WHERE id=$1`, id, newHash, expiresAt)
	return err
}

func InsertIntegrationTokenEvent(ctx context.Context, db *sql.DB, orgID, tokenID uuid.UUID, eventType, actorType string, actorID *uuid.UUID, ip, ua string, details []byte) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO integration_token_events (org_id, token_id, event_type, actor_type, actor_id, at, ip, user_agent, details)
		VALUES ($1,$2,$3,$4,$5,NOW(),NULLIF($6,''),NULLIF($7,''),$8::jsonb)
	`, orgID, tokenID, eventType, actorType, actorID, ip, ua, string(details))
	return err
}

func ListIntegrationTokenEvents(ctx context.Context, db *sql.DB, orgID, tokenID uuid.UUID, limit int) ([]map[string]any, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, event_type, actor_type, COALESCE(actor_id::text,''), at, COALESCE(ip::text,''), COALESCE(user_agent,''), COALESCE(details,'{}'::jsonb)
		FROM integration_token_events WHERE org_id=$1 AND token_id=$2 ORDER BY at DESC LIMIT $3
	`, orgID, tokenID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var ev, atype, actor, ip, ua string
		var at time.Time
		var details []byte
		if err := rows.Scan(&id, &ev, &atype, &actor, &at, &ip, &ua, &details); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"id": id, "event_type": ev, "actor_type": atype, "actor_id": actor, "at": at, "ip": ip, "user_agent": ua, "details": string(details)})
	}
	return out, rows.Err()
}

func ListActiveIntegrationTokens(ctx context.Context, db *sql.DB) ([]IntegrationToken, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, org_id, COALESCE(project_id::text,''), name, token_hash, scopes, created_at, expires_at, revoked_at, last_used_at, COALESCE(created_by_user_id::text,'')
		FROM integration_tokens
		WHERE revoked_at IS NULL AND expires_at > NOW()
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	res := []IntegrationToken{}
	for rows.Next() {
		var t IntegrationToken
		if err := rows.Scan(&t.ID, &t.OrgID, &t.ProjectID, &t.Name, &t.TokenHash, pq.Array(&t.Scopes), &t.CreatedAt, &t.ExpiresAt, &t.RevokedAt, &t.LastUsedAt, &t.CreatedByUserID); err != nil {
			return nil, err
		}
		res = append(res, t)
	}
	return res, rows.Err()
}

func TouchIntegrationTokenLastUsed(ctx context.Context, db *sql.DB, tokenID uuid.UUID) error {
	_, err := db.ExecContext(ctx, `
		UPDATE integration_tokens
		SET last_used_at = NOW()
		WHERE id=$1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '5 minutes')
	`, tokenID)
	return err
}

func nullUUIDText(v sql.NullString) any {
	if !v.Valid || v.String == "" {
		return nil
	}
	id, err := uuid.Parse(v.String)
	if err != nil {
		return nil
	}
	return id
}
