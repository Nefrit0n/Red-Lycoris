package storage

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type UserProjectRolesRepo struct {
	pool *pgxpool.Pool
}

func NewUserProjectRolesRepo(pool *pgxpool.Pool) *UserProjectRolesRepo {
	return &UserProjectRolesRepo{pool: pool}
}

// NOTE: pgx.Tx and pgxpool.Pool both satisfy this shape via wrappers below.
type dbexec interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (r *UserProjectRolesRepo) executor(tx pgx.Tx) dbexec {
	if tx != nil {
		return tx
	}
	return r.pool
}

func (r *UserProjectRolesRepo) Grant(ctx context.Context, tx pgx.Tx, userID, projectID uuid.UUID, role domain.ProjectRole, grantedBy *uuid.UUID) error {
	const q = `
		INSERT INTO user_project_roles (user_id, project_id, role, granted_by, granted_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (user_id, project_id) DO UPDATE
		SET role = EXCLUDED.role,
		    granted_by = EXCLUDED.granted_by,
		    granted_at = now()`

	_, err := r.executor(tx).Exec(ctx, q, userID, projectID, int16(role), grantedBy)
	if err != nil {
		return fmt.Errorf("storage.UserProjectRolesRepo.Grant: %w", err)
	}
	return nil
}

func (r *UserProjectRolesRepo) Revoke(ctx context.Context, userID, projectID uuid.UUID) error {
	const q = `DELETE FROM user_project_roles WHERE user_id = $1 AND project_id = $2`
	_, err := r.pool.Exec(ctx, q, userID, projectID)
	if err != nil {
		return fmt.Errorf("storage.UserProjectRolesRepo.Revoke: %w", err)
	}
	return nil
}

func (r *UserProjectRolesRepo) Update(ctx context.Context, userID, projectID uuid.UUID, role domain.ProjectRole) error {
	const q = `UPDATE user_project_roles SET role = $1 WHERE user_id = $2 AND project_id = $3`
	tag, err := r.pool.Exec(ctx, q, int16(role), userID, projectID)
	if err != nil {
		return fmt.Errorf("storage.UserProjectRolesRepo.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.UserProjectRolesRepo.Update: role not found")
	}
	return nil
}

func (r *UserProjectRolesRepo) GetRole(ctx context.Context, userID, projectID uuid.UUID) (domain.ProjectRole, bool, error) {
	const q = `SELECT role FROM user_project_roles WHERE user_id = $1 AND project_id = $2`
	var role int16
	err := r.pool.QueryRow(ctx, q, userID, projectID).Scan(&role)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("storage.UserProjectRolesRepo.GetRole: %w", err)
	}
	return domain.ProjectRole(role), true, nil
}

func (r *UserProjectRolesRepo) HasProjectAccess(ctx context.Context, userID, projectID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM user_project_roles WHERE user_id = $1 AND project_id = $2)`
	var has bool
	if err := r.pool.QueryRow(ctx, q, userID, projectID).Scan(&has); err != nil {
		return false, fmt.Errorf("storage.UserProjectRolesRepo.HasProjectAccess: %w", err)
	}
	return has, nil
}

func (r *UserProjectRolesRepo) ListForProject(ctx context.Context, projectID uuid.UUID) ([]domain.ProjectMember, error) {
	const q = `
		SELECT u.id, u.email, u.full_name, upr.role, upr.granted_at, upr.granted_by
		FROM user_project_roles upr
		JOIN users u ON u.id = upr.user_id
		WHERE upr.project_id = $1
		ORDER BY upr.role DESC, u.email ASC`

	rows, err := r.pool.Query(ctx, q, projectID)
	if err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListForProject: %w", err)
	}
	defer rows.Close()

	out := make([]domain.ProjectMember, 0)
	for rows.Next() {
		var m domain.ProjectMember
		var role int16
		if err := rows.Scan(&m.UserID, &m.Email, &m.FullName, &role, &m.GrantedAt, &m.GrantedBy); err != nil {
			return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListForProject: scan: %w", err)
		}
		m.Role = domain.ProjectRole(role)
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListForProject: rows: %w", err)
	}

	return out, nil
}

func (r *UserProjectRolesRepo) ListProjectIDsForUser(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	const q = `SELECT project_id FROM user_project_roles WHERE user_id = $1 ORDER BY project_id`
	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListProjectIDsForUser: %w", err)
	}
	defer rows.Close()

	ids := make([]uuid.UUID, 0)
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListProjectIDsForUser: scan: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListProjectIDsForUser: rows: %w", err)
	}
	return ids, nil
}

func (r *UserProjectRolesRepo) ListAllRolesForUser(ctx context.Context, userID uuid.UUID) ([]domain.UserProjectRole, error) {
	const q = `
		SELECT p.id, p.name, upr.role, upr.granted_at, upr.granted_by
		FROM user_project_roles upr
		JOIN projects p ON p.id = upr.project_id
		WHERE upr.user_id = $1
		ORDER BY p.name ASC`

	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListAllRolesForUser: %w", err)
	}
	defer rows.Close()

	result := make([]domain.UserProjectRole, 0)
	for rows.Next() {
		var role domain.UserProjectRole
		var rawRole int16
		if err := rows.Scan(&role.ProjectID, &role.ProjectName, &rawRole, &role.GrantedAt, &role.GrantedBy); err != nil {
			return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListAllRolesForUser: scan: %w", err)
		}
		role.Role = domain.ProjectRole(rawRole)
		result = append(result, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.UserProjectRolesRepo.ListAllRolesForUser: rows: %w", err)
	}

	return result, nil
}

func (r *UserProjectRolesRepo) CountProjectAdmins(ctx context.Context, projectID uuid.UUID) (int, error) {
	const q = `SELECT count(*) FROM user_project_roles WHERE project_id = $1 AND role = $2`
	var count int
	if err := r.pool.QueryRow(ctx, q, projectID, int16(domain.RoleProjectAdmin)).Scan(&count); err != nil {
		return 0, fmt.Errorf("storage.UserProjectRolesRepo.CountProjectAdmins: %w", err)
	}
	return count, nil
}
