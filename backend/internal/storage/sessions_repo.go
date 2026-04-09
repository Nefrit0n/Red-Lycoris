package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type SessionsRepo struct {
	pool *pgxpool.Pool
}

func NewSessionsRepo(pool *pgxpool.Pool) *SessionsRepo {
	return &SessionsRepo{pool: pool}
}

func (r *SessionsRepo) Create(ctx context.Context, s *domain.Session) error {
	const q = `
		INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip, created_at, last_used_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err := r.pool.Exec(ctx, q,
		s.ID, s.UserID, s.TokenHash, s.ExpiresAt, s.RevokedAt, s.UserAgent, s.IP, s.CreatedAt, s.LastUsedAt,
	)
	if err != nil {
		return fmt.Errorf("storage.SessionsRepo.Create: %w", err)
	}
	return nil
}

func (r *SessionsRepo) GetByTokenHashWithUser(ctx context.Context, tokenHash []byte) (*domain.Session, *domain.User, error) {
	const q = `
		SELECT
			s.id, s.user_id, s.token_hash, s.expires_at, s.revoked_at, s.user_agent, s.ip, s.created_at, s.last_used_at,
			u.id, u.email, u.password_hash, u.full_name, u.is_active, u.global_role, u.created_at, u.updated_at, u.last_login_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1
		  AND s.revoked_at IS NULL
		  AND s.expires_at > now()
		  AND u.is_active`

	var user domain.User
	var session domain.Session
	var role int16
	err := r.pool.QueryRow(ctx, q, tokenHash).Scan(
		&session.ID, &session.UserID, &session.TokenHash, &session.ExpiresAt, &session.RevokedAt,
		&session.UserAgent, &session.IP, &session.CreatedAt, &session.LastUsedAt,
		&user.ID, &user.Email, &user.PasswordHash, &user.FullName, &user.IsActive, &role,
		&user.CreatedAt, &user.UpdatedAt, &user.LastLoginAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("storage.SessionsRepo.GetByTokenHashWithUser: %w", err)
	}
	user.GlobalRole = domain.GlobalRole(role)
	return &session, &user, nil
}

func (r *SessionsRepo) Revoke(ctx context.Context, tokenHash []byte) error {
	const q = `
		UPDATE sessions
		SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL`

	if _, err := r.pool.Exec(ctx, q, tokenHash); err != nil {
		return fmt.Errorf("storage.SessionsRepo.Revoke: %w", err)
	}
	return nil
}

func (r *SessionsRepo) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	const q = `
		UPDATE sessions
		SET revoked_at = now()
		WHERE user_id = $1 AND revoked_at IS NULL`

	if _, err := r.pool.Exec(ctx, q, userID); err != nil {
		return fmt.Errorf("storage.SessionsRepo.RevokeAllForUser: %w", err)
	}
	return nil
}

func (r *SessionsRepo) UpdateLastUsed(ctx context.Context, sessionID uuid.UUID) error {
	const q = `
		UPDATE sessions
		SET last_used_at = now()
		WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, sessionID)
	if err != nil {
		return fmt.Errorf("storage.SessionsRepo.UpdateLastUsed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.SessionsRepo.UpdateLastUsed: session %s not found", sessionID)
	}
	return nil
}

func (r *SessionsRepo) DeleteExpired(ctx context.Context) (int64, error) {
	const q = `DELETE FROM sessions WHERE expires_at <= now() OR revoked_at IS NOT NULL`

	tag, err := r.pool.Exec(ctx, q)
	if err != nil {
		return 0, fmt.Errorf("storage.SessionsRepo.DeleteExpired: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *SessionsRepo) UpdateExpiresAt(ctx context.Context, sessionID uuid.UUID, expiresAt time.Time) error {
	const q = `
		UPDATE sessions
		SET expires_at = $1
		WHERE id = $2 AND revoked_at IS NULL`

	tag, err := r.pool.Exec(ctx, q, expiresAt, sessionID)
	if err != nil {
		return fmt.Errorf("storage.SessionsRepo.UpdateExpiresAt: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.SessionsRepo.UpdateExpiresAt: session %s not found", sessionID)
	}
	return nil
}
