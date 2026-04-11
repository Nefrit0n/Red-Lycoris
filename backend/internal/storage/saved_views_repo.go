package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SavedView is a per-user stored filter/sort combination for the findings
// list. The query payload is an opaque JSON blob owned by the frontend —
// backend only enforces shape (it must decode as a JSON object) and never
// interprets the contents.
type SavedView struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	Name      string          `json:"name"`
	Query     json.RawMessage `json:"query"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type SavedViewsRepo struct {
	pool *pgxpool.Pool
}

func NewSavedViewsRepo(pool *pgxpool.Pool) *SavedViewsRepo {
	return &SavedViewsRepo{pool: pool}
}

func (r *SavedViewsRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]SavedView, error) {
	const q = `
		SELECT id, user_id, name, query, created_at, updated_at
		FROM saved_views
		WHERE user_id = $1
		ORDER BY updated_at DESC, id`

	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("storage.SavedViewsRepo.ListForUser: %w", err)
	}
	defer rows.Close()

	views := make([]SavedView, 0)
	for rows.Next() {
		var v SavedView
		if err := rows.Scan(&v.ID, &v.UserID, &v.Name, &v.Query, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("storage.SavedViewsRepo.ListForUser: scan: %w", err)
		}
		views = append(views, v)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.SavedViewsRepo.ListForUser: rows: %w", err)
	}
	return views, nil
}

func (r *SavedViewsRepo) GetByID(ctx context.Context, id uuid.UUID) (*SavedView, error) {
	const q = `
		SELECT id, user_id, name, query, created_at, updated_at
		FROM saved_views
		WHERE id = $1`

	var v SavedView
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&v.ID, &v.UserID, &v.Name, &v.Query, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.SavedViewsRepo.GetByID: %w", err)
	}
	return &v, nil
}

func (r *SavedViewsRepo) Create(ctx context.Context, v *SavedView) error {
	const q = `
		INSERT INTO saved_views (id, user_id, name, query, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`

	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	now := time.Now()
	if v.CreatedAt.IsZero() {
		v.CreatedAt = now
	}
	if v.UpdatedAt.IsZero() {
		v.UpdatedAt = now
	}

	if _, err := r.pool.Exec(ctx, q,
		v.ID, v.UserID, v.Name, v.Query, v.CreatedAt, v.UpdatedAt,
	); err != nil {
		return fmt.Errorf("storage.SavedViewsRepo.Create: %w", err)
	}
	return nil
}

// UpdateName changes only the display name — query body is immutable via this
// endpoint (users re-save with a new name to persist a different query).
func (r *SavedViewsRepo) UpdateName(ctx context.Context, id, userID uuid.UUID, name string) error {
	const q = `
		UPDATE saved_views
		SET name = $1, updated_at = $2
		WHERE id = $3 AND user_id = $4`

	tag, err := r.pool.Exec(ctx, q, name, time.Now(), id, userID)
	if err != nil {
		return fmt.Errorf("storage.SavedViewsRepo.UpdateName: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *SavedViewsRepo) Delete(ctx context.Context, id, userID uuid.UUID) error {
	const q = `DELETE FROM saved_views WHERE id = $1 AND user_id = $2`
	tag, err := r.pool.Exec(ctx, q, id, userID)
	if err != nil {
		return fmt.Errorf("storage.SavedViewsRepo.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
