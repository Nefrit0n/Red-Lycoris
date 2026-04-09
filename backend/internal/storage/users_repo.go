package storage

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type UsersRepo struct {
	pool *pgxpool.Pool
}

func NewUsersRepo(pool *pgxpool.Pool) *UsersRepo {
	return &UsersRepo{pool: pool}
}

func (r *UsersRepo) Create(ctx context.Context, user *domain.User) error {
	const q = `
		INSERT INTO users (id, email, password_hash, full_name, is_active, global_role, created_at, updated_at, last_login_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	now := time.Now()
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = now
	}
	if user.UpdatedAt.IsZero() {
		user.UpdatedAt = now
	}

	_, err := r.pool.Exec(ctx, q,
		user.ID, user.Email, user.PasswordHash, user.FullName, user.IsActive,
		int16(user.GlobalRole), user.CreatedAt, user.UpdatedAt, user.LastLoginAt,
	)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.Create: %w", err)
	}
	return nil
}

func (r *UsersRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	const q = `
		SELECT id, email, password_hash, full_name, is_active, global_role, created_at, updated_at, last_login_at
		FROM users
		WHERE id = $1`

	var u domain.User
	var role int16
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsActive, &role,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetByID: %w", err)
	}
	u.GlobalRole = domain.GlobalRole(role)
	return &u, nil
}

func (r *UsersRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	const q = `
		SELECT id, email, password_hash, full_name, is_active, global_role, created_at, updated_at, last_login_at
		FROM users
		WHERE email = $1`

	var u domain.User
	var role int16
	err := r.pool.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsActive, &role,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetByEmail: %w", err)
	}
	u.GlobalRole = domain.GlobalRole(role)
	return &u, nil
}

func (r *UsersRepo) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	const q = `
		UPDATE users
		SET last_login_at = now(), updated_at = now()
		WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.UpdateLastLogin: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.UsersRepo.UpdateLastLogin: user %s not found", id)
	}
	return nil
}

func (r *UsersRepo) Update(ctx context.Context, id uuid.UUID, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}

	allowed := map[string]string{
		"email":         "email",
		"password_hash": "password_hash",
		"full_name":     "full_name",
		"is_active":     "is_active",
		"global_role":   "global_role",
		"last_login_at": "last_login_at",
	}

	keys := make([]string, 0, len(fields))
	for k := range fields {
		if _, ok := allowed[k]; !ok {
			return fmt.Errorf("storage.UsersRepo.Update: unsupported field %q", k)
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	setParts := make([]string, 0, len(keys)+1)
	args := make([]any, 0, len(keys)+1)
	for i, k := range keys {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", allowed[k], i+1))
		args = append(args, fields[k])
	}
	setParts = append(setParts, fmt.Sprintf("updated_at = now()"))
	args = append(args, id)

	q := fmt.Sprintf("UPDATE users SET %s WHERE id = $%d", strings.Join(setParts, ", "), len(args))
	tag, err := r.pool.Exec(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.UsersRepo.Update: user %s not found", id)
	}
	return nil
}

func (r *UsersRepo) List(ctx context.Context, limit, offset int) ([]domain.User, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("storage.UsersRepo.List: count: %w", err)
	}

	const q = `
		SELECT id, email, password_hash, full_name, is_active, global_role, created_at, updated_at, last_login_at
		FROM users
		ORDER BY created_at DESC, id
		LIMIT $1 OFFSET $2`

	rows, err := r.pool.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("storage.UsersRepo.List: query: %w", err)
	}
	defer rows.Close()

	users := make([]domain.User, 0, limit)
	for rows.Next() {
		var u domain.User
		var role int16
		if err := rows.Scan(
			&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsActive, &role,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
		); err != nil {
			return nil, 0, fmt.Errorf("storage.UsersRepo.List: scan: %w", err)
		}
		u.GlobalRole = domain.GlobalRole(role)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("storage.UsersRepo.List: rows: %w", err)
	}

	return users, total, nil
}

func (r *UsersRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	const q = `
		UPDATE users
		SET is_active = false, updated_at = now()
		WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.Deactivate: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.UsersRepo.Deactivate: user %s not found", id)
	}
	return nil
}

func (r *UsersRepo) Count(ctx context.Context) (int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&total); err != nil {
		return 0, fmt.Errorf("storage.UsersRepo.Count: %w", err)
	}
	return total, nil
}

func (r *UsersRepo) SearchActive(ctx context.Context, q string, limit int) ([]domain.User, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	const query = `
		SELECT id, email, password_hash, full_name, is_active, global_role, created_at, updated_at, last_login_at
		FROM users
		WHERE is_active
		  AND (email ILIKE $1 OR full_name ILIKE $1)
		ORDER BY email
		LIMIT $2`

	pattern := "%" + strings.TrimSpace(q) + "%"
	rows, err := r.pool.Query(ctx, query, pattern, limit)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.SearchActive: %w", err)
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		var role int16
		if err := rows.Scan(
			&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsActive, &role,
			&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
		); err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.SearchActive: scan: %w", err)
		}
		u.GlobalRole = domain.GlobalRole(role)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.SearchActive: rows: %w", err)
	}

	return users, nil
}
