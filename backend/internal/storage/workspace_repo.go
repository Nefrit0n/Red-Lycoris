package storage

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type WorkspaceRepo struct {
	pool *pgxpool.Pool
}

type WorkspaceMember struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
}

func NewWorkspaceRepo(pool *pgxpool.Pool) *WorkspaceRepo {
	return &WorkspaceRepo{pool: pool}
}

func (r *WorkspaceRepo) ListTeams(ctx context.Context, q string, limit int) ([]domain.Team, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var query string
	var args []any
	if strings.TrimSpace(q) != "" {
		query = `
			SELECT id, name, coalesce(description, ''), created_at, updated_at
			FROM teams
			WHERE lower(name) LIKE $1
			ORDER BY name ASC
			LIMIT $2`
		args = []any{"%" + strings.ToLower(strings.TrimSpace(q)) + "%", limit}
	} else {
		query = `
			SELECT id, name, coalesce(description, ''), created_at, updated_at
			FROM teams
			ORDER BY name ASC
			LIMIT $1`
		args = []any{limit}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListTeams: %w", err)
	}
	defer rows.Close()

	teams := make([]domain.Team, 0, 8)
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("storage.WorkspaceRepo.ListTeams: scan: %w", err)
		}
		teams = append(teams, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListTeams: rows: %w", err)
	}
	return teams, nil
}

func (r *WorkspaceRepo) CreateTeam(ctx context.Context, t *domain.Team) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	const q = `
		INSERT INTO teams (id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		RETURNING created_at, updated_at`
	if err := r.pool.QueryRow(ctx, q, t.ID, t.Name, emptyToNil(t.Description)).Scan(&t.CreatedAt, &t.UpdatedAt); err != nil {
		return fmt.Errorf("storage.WorkspaceRepo.CreateTeam: %w", err)
	}
	return nil
}

func (r *WorkspaceRepo) ListMembers(ctx context.Context, q string, limit int) ([]WorkspaceMember, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var query string
	var args []any
	if strings.TrimSpace(q) != "" {
		qLike := "%" + strings.ToLower(strings.TrimSpace(q)) + "%"
		query = `
			SELECT id, email, coalesce(nullif(full_name, ''), email)
			FROM users
			WHERE lower(email) LIKE $1 OR lower(coalesce(full_name, '')) LIKE $1
			ORDER BY full_name ASC, email ASC
			LIMIT $2`
		args = []any{qLike, limit}
	} else {
		query = `
			SELECT id, email, coalesce(nullif(full_name, ''), email)
			FROM users
			ORDER BY full_name ASC, email ASC
			LIMIT $1`
		args = []any{limit}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListMembers: %w", err)
	}
	defer rows.Close()

	members := make([]WorkspaceMember, 0, 16)
	for rows.Next() {
		var m WorkspaceMember
		if err := rows.Scan(&m.ID, &m.Email, &m.DisplayName); err != nil {
			return nil, fmt.Errorf("storage.WorkspaceRepo.ListMembers: scan: %w", err)
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListMembers: rows: %w", err)
	}
	return members, nil
}

func (r *WorkspaceRepo) ListTags(ctx context.Context, prefix string, limit int) ([]string, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	var query string
	var args []any
	if strings.TrimSpace(prefix) != "" {
		query = `
			SELECT DISTINCT tag
			FROM (
				SELECT unnest(coalesce(tags, '{}'::text[])) AS tag
				FROM projects
			) sub
			WHERE lower(tag) LIKE $1
			ORDER BY tag ASC
			LIMIT $2`
		args = []any{strings.ToLower(strings.TrimSpace(prefix)) + "%", limit}
	} else {
		query = `
			SELECT DISTINCT tag
			FROM (
				SELECT unnest(coalesce(tags, '{}'::text[])) AS tag
				FROM projects
			) sub
			ORDER BY tag ASC
			LIMIT $1`
		args = []any{limit}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListTags: %w", err)
	}
	defer rows.Close()

	tags := make([]string, 0, 16)
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("storage.WorkspaceRepo.ListTags: scan: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.WorkspaceRepo.ListTags: rows: %w", err)
	}
	return tags, nil
}

func (r *WorkspaceRepo) CheckSlugAvailable(ctx context.Context, slug string) (bool, error) {
	const q = `SELECT count(*) FROM projects WHERE slug = $1`
	var count int
	if err := r.pool.QueryRow(ctx, q, slug).Scan(&count); err != nil {
		return false, fmt.Errorf("storage.WorkspaceRepo.CheckSlugAvailable: %w", err)
	}
	return count == 0, nil
}
