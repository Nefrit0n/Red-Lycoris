package storage

import (
	"context"
	"fmt"
	"net"
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
		INSERT INTO users (
			id, email, password_hash, full_name, is_active, global_role,
			status, is_system_account, created_by_user_id,
			created_at, updated_at, last_login_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

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
	if user.Status == "" {
		user.Status = domain.UserStatusActive
	}

	_, err := r.pool.Exec(ctx, q,
		user.ID, user.Email, user.PasswordHash, user.FullName, user.IsActive,
		int16(user.GlobalRole), string(user.Status), user.IsSystemAccount, user.CreatedByUserID,
		user.CreatedAt, user.UpdatedAt, user.LastLoginAt,
	)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.Create: %w", err)
	}
	return nil
}

// selectUserCols — полный набор колонок для SELECT запросов по users.
const selectUserCols = `
	id, email, password_hash, full_name, is_active, global_role,
	status, is_system_account, created_by_user_id, last_login_ip,
	created_at, updated_at, last_login_at`

func scanUser(row interface {
	Scan(dest ...any) error
}) (*domain.User, error) {
	var u domain.User
	var role int16
	var status string
	var lastIP *net.IP
	err := row.Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsActive, &role,
		&status, &u.IsSystemAccount, &u.CreatedByUserID, &lastIP,
		&u.CreatedAt, &u.UpdatedAt, &u.LastLoginAt,
	)
	if err != nil {
		return nil, err
	}
	u.GlobalRole = domain.GlobalRole(role)
	u.Status = domain.UserStatus(status)
	if lastIP != nil {
		u.LastLoginIP = *lastIP
	}
	return &u, nil
}

func (r *UsersRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	q := `SELECT` + selectUserCols + ` FROM users WHERE id = $1`
	u, err := scanUser(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetByID: %w", err)
	}
	return u, nil
}

func (r *UsersRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	q := `SELECT` + selectUserCols + ` FROM users WHERE email = $1`
	u, err := scanUser(r.pool.QueryRow(ctx, q, email))
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetByEmail: %w", err)
	}
	return u, nil
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
		"status":        "status",
		"last_login_at": "last_login_at",
		"last_login_ip": "last_login_ip",
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

	q := `SELECT` + selectUserCols + `
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
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("storage.UsersRepo.List: scan: %w", err)
		}
		users = append(users, *u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("storage.UsersRepo.List: rows: %w", err)
	}

	return users, total, nil
}

// CountActiveAdmins возвращает количество активных администраторов.
// Используется для защиты от удаления последнего admin'а.
func (r *UsersRepo) CountActiveAdmins(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE global_role = 1 AND status = 'active'`,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("storage.UsersRepo.CountActiveAdmins: %w", err)
	}
	return count, nil
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

	query := `SELECT` + selectUserCols + `
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
		u, err := scanUser(rows)
		if err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.SearchActive: scan: %w", err)
		}
		users = append(users, *u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.SearchActive: rows: %w", err)
	}

	return users, nil
}
