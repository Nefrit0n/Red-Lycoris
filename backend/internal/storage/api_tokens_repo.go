package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type APITokensRepo struct {
	pool         *pgxpool.Pool
	touchMu      sync.Mutex
	lastTouchMap map[uuid.UUID]time.Time
}

func NewAPITokensRepo(pool *pgxpool.Pool) *APITokensRepo {
	return &APITokensRepo{pool: pool, lastTouchMap: make(map[uuid.UUID]time.Time)}
}

func (r *APITokensRepo) Create(ctx context.Context, token *domain.APIToken) error {
	const q = `INSERT INTO api_tokens (id, project_id, name, prefix, token_hash, scopes, created_by_user_id, expires_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if token.ID == uuid.Nil {
		token.ID = uuid.New()
	}
	if _, err := r.pool.Exec(ctx, q, token.ID, token.ProjectID, token.Name, token.Prefix, token.TokenHash, token.Scopes, token.CreatedByUserID, token.ExpiresAt); err != nil {
		return fmt.Errorf("storage.APITokensRepo.Create: %w", err)
	}
	return nil
}

func (r *APITokensRepo) GetByPrefix(ctx context.Context, prefix string) (*domain.APIToken, error) {
	const q = `SELECT id, project_id, name, prefix, token_hash, scopes, created_by_user_id, last_used_at, expires_at, revoked_at, created_at
FROM api_tokens
WHERE prefix = $1
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
LIMIT 1`
	var t domain.APIToken
	err := r.pool.QueryRow(ctx, q, prefix).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Prefix, &t.TokenHash, &t.Scopes, &t.CreatedByUserID, &t.LastUsedAt, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *APITokensRepo) ListByProject(ctx context.Context, projectID uuid.UUID) ([]domain.APIToken, error) {
	const q = `SELECT t.id, t.project_id, t.name, t.prefix, t.scopes, t.created_by_user_id, COALESCE(u.email,''), t.last_used_at, t.expires_at, t.revoked_at, t.created_at
FROM api_tokens t
LEFT JOIN users u ON u.id = t.created_by_user_id
WHERE t.project_id = $1
ORDER BY t.created_at DESC`
	rows, err := r.pool.Query(ctx, q, projectID)
	if err != nil {
		return nil, fmt.Errorf("storage.APITokensRepo.ListByProject: %w", err)
	}
	defer rows.Close()
	out := make([]domain.APIToken, 0)
	for rows.Next() {
		var t domain.APIToken
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Prefix, &t.Scopes, &t.CreatedByUserID, &t.CreatedByEmail, &t.LastUsedAt, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *APITokensRepo) Revoke(ctx context.Context, tokenID, projectID uuid.UUID) error {
	const q = `UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`
	_, err := r.pool.Exec(ctx, q, tokenID, projectID)
	if err != nil {
		return fmt.Errorf("storage.APITokensRepo.Revoke: %w", err)
	}
	return nil
}

const touchDebounce = time.Minute

// TouchLastUsed updates last_used_at at most once per minute per token.
// Entries older than 2× debounce are evicted from the in-memory map to prevent
// unbounded growth.
func (r *APITokensRepo) TouchLastUsed(ctx context.Context, tokenID uuid.UUID) error {
	now := time.Now()
	r.touchMu.Lock()
	last := r.lastTouchMap[tokenID]
	if !last.IsZero() && now.Sub(last) < touchDebounce {
		r.touchMu.Unlock()
		return nil
	}
	r.lastTouchMap[tokenID] = now
	// Evict stale entries while the lock is held to keep the map bounded.
	for k, v := range r.lastTouchMap {
		if now.Sub(v) > 2*touchDebounce {
			delete(r.lastTouchMap, k)
		}
	}
	r.touchMu.Unlock()

	const q = `UPDATE api_tokens SET last_used_at = now() WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, tokenID)
	if err != nil {
		return fmt.Errorf("storage.APITokensRepo.TouchLastUsed: %w", err)
	}
	return nil
}
