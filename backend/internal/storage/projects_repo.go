package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"vulnscope/internal/domain"
)

type ProjectsRepo struct {
	pool *pgxpool.Pool
}

func NewProjectsRepo(pool *pgxpool.Pool) *ProjectsRepo {
	return &ProjectsRepo{pool: pool}
}

func (r *ProjectsRepo) Create(ctx context.Context, p *domain.Project) error {
	const q = `
		INSERT INTO projects (id, name, description, tags, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`

	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	now := time.Now()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	if p.UpdatedAt.IsZero() {
		p.UpdatedAt = now
	}

	_, err := r.pool.Exec(ctx, q,
		p.ID, p.Name, p.Description, p.Tags, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("storage.ProjectsRepo.Create: %w", err)
	}
	return nil
}

func (r *ProjectsRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Project, error) {
	const q = `
		SELECT id, name, description, tags, created_at, updated_at
		FROM projects
		WHERE id = $1`

	var p domain.Project
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Tags, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.ProjectsRepo.GetByID: %w", err)
	}
	if p.Tags == nil {
		p.Tags = []string{}
	}
	return &p, nil
}

func (r *ProjectsRepo) List(ctx context.Context, limit, offset int) ([]domain.Project, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM projects`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("storage.ProjectsRepo.List: count: %w", err)
	}

	const q = `
		SELECT id, name, description, tags, created_at, updated_at
		FROM projects
		ORDER BY created_at DESC, id
		LIMIT $1 OFFSET $2`

	rows, err := r.pool.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("storage.ProjectsRepo.List: query: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Tags, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("storage.ProjectsRepo.List: scan: %w", err)
		}
		if p.Tags == nil {
			p.Tags = []string{}
		}
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("storage.ProjectsRepo.List: rows: %w", err)
	}

	return projects, total, nil
}

func (r *ProjectsRepo) Update(ctx context.Context, p *domain.Project) error {
	const q = `
		UPDATE projects
		SET name = $1, description = $2, tags = $3, updated_at = $4
		WHERE id = $5`

	p.UpdatedAt = time.Now()
	tag, err := r.pool.Exec(ctx, q,
		p.Name, p.Description, p.Tags, p.UpdatedAt, p.ID,
	)
	if err != nil {
		return fmt.Errorf("storage.ProjectsRepo.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.ProjectsRepo.Update: project %s not found", p.ID)
	}
	return nil
}

func (r *ProjectsRepo) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM projects WHERE id = $1`
	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("storage.ProjectsRepo.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.ProjectsRepo.Delete: project %s not found", id)
	}
	return nil
}
