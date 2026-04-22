package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type ProjectsRepo struct {
	pool *pgxpool.Pool
}

type ProjectsFilter struct {
	AccessibleProjectIDs []uuid.UUID
	Limit                int
	Cursor               string
	Statuses             []domain.ProjectStatus
	Team                 string
	SLA                  string
	Tags                 []string
	Owner                string
	Q                    string
	Sort                 string
}

type ProjectTrendPoint struct {
	Date  time.Time `json:"date"`
	Count int       `json:"count"`
}

type QuickPeekFinding struct {
	ID       uuid.UUID `json:"id"`
	Title    string    `json:"title"`
	Severity int       `json:"severity"`
	Status   int       `json:"status"`
}

type QuickPeekEvent struct {
	ID        uuid.UUID  `json:"id"`
	Action    string     `json:"action"`
	Method    string     `json:"method"`
	Path      string     `json:"path"`
	CreatedAt time.Time  `json:"created_at"`
	UserID    *uuid.UUID `json:"user_id,omitempty"`
}

type QuickPeekStatusStats struct {
	New     int `json:"new"`
	Triaged int `json:"triaged"`
	Fixed   int `json:"fixed"`
	Wontfix int `json:"wontfix"`
}

func NewProjectsRepo(pool *pgxpool.Pool) *ProjectsRepo {
	return &ProjectsRepo{pool: pool}
}

func (r *ProjectsRepo) Create(ctx context.Context, p *domain.Project) error {
	return r.create(ctx, r.pool, p)
}

func (r *ProjectsRepo) CreateTx(ctx context.Context, tx pgx.Tx, p *domain.Project) error {
	return r.create(ctx, tx, p)
}

type projectExecutor interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

func (r *ProjectsRepo) create(ctx context.Context, exec projectExecutor, p *domain.Project) error {
	const q = `
		INSERT INTO projects (
			id, slug, name, description, icon_color, repo_url, repo_provider,
			tags, status, setup_completed, pinned, created_by,
			visibility, sla_critical_days, sla_high_days, sla_medium_days, sla_low_days,
			sla_notify_before_days, team_id,
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`

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
	if p.Slug == "" {
		p.Slug = slugifyProjectName(p.Name)
	}
	if p.IconColor == "" {
		p.IconColor = "#64748b"
	}
	if p.Status == "" {
		p.Status = domain.ProjectStatusActive
	}
	if !p.SetupCompleted {
		p.SetupCompleted = true
	}
	if p.Visibility == "" {
		p.Visibility = "workspace"
	}

	var teamID any
	if p.Team != nil && p.Team.ID != "" {
		if tid, err := uuid.Parse(p.Team.ID); err == nil {
			teamID = tid
		}
	}

	_, err := exec.Exec(ctx, q,
		p.ID, p.Slug, p.Name, p.Description, p.IconColor, emptyToNil(p.RepoURL), emptyToNil(p.RepoProvider),
		p.Tags, p.Status, p.SetupCompleted, p.Pinned, uuidOrNil(p.CreatedBy),
		p.Visibility, p.SLACriticalDays, p.SLAHighDays, p.SLAMediumDays, p.SLALowDays,
		p.SLANotifyBeforeDays, teamID,
		p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("storage.ProjectsRepo.Create: %w", err)
	}
	return nil
}

func (r *ProjectsRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Project, error) {
	const q = `
		SELECT
			p.id,
			p.slug,
			p.name,
			coalesce(p.description, ''),
			p.icon_color,
			coalesce(p.repo_url, ''),
			coalesce(p.repo_provider, ''),
			coalesce(p.tags, '{}'::text[]),
			p.status,
			p.setup_completed,
			p.pinned,
			coalesce(p.visibility, 'workspace'),
			coalesce(owner.id, p.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
			coalesce(owner.email, ''),
			coalesce(nullif(owner.full_name, ''), owner.email, 'Unknown Owner'),
			p.created_at,
			p.updated_at,
			coalesce(fs.critical, 0),
			coalesce(fs.high, 0),
			coalesce(fs.medium, 0),
			coalesce(fs.low, 0),
			coalesce(fs.info, 0),
			coalesce(fs.sla_breached_count, 0),
			case when coalesce(fs.has_sast, false) then 'ok' else 'off' end,
			case when coalesce(fs.has_dast, false) then 'ok' else 'off' end,
			case when coalesce(fs.has_sca, false) then 'ok' else 'off' end,
			case when coalesce(fs.has_secrets, false) then 'ok' else 'off' end,
			p.sla_critical_days,
			p.sla_high_days,
			p.sla_medium_days,
			p.sla_low_days,
			coalesce(p.sla_notify_before_days, 3),
			coalesce(t.id::text, ''),
			coalesce(t.name, '')
		FROM projects p
		LEFT JOIN users owner ON owner.id = p.created_by
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN LATERAL (
			SELECT
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 4) AS critical,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 3) AS high,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 2) AS medium,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 1) AS low,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 0) AS info,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity >= 3 AND now() - f.first_seen > interval '7 day') AS sla_breached_count,
				bool_or(f.finding_kind = 1) AS has_sast,
				bool_or(f.finding_kind = 2) AS has_dast,
				bool_or(f.finding_kind = 0) AS has_sca,
				bool_or(f.finding_kind = 4) AS has_secrets
			FROM findings f
			WHERE f.project_id = p.id
		) fs ON true
		WHERE p.id = $1`

	var p domain.Project
	var ownerID uuid.UUID
	var ownerEmail, ownerDisplay string
	var sast, dast, sca, secrets string
	var teamID, teamName string
	if err := r.pool.QueryRow(ctx, q, id).Scan(
		&p.ID,
		&p.Slug,
		&p.Name,
		&p.Description,
		&p.IconColor,
		&p.RepoURL,
		&p.RepoProvider,
		&p.Tags,
		&p.Status,
		&p.SetupCompleted,
		&p.Pinned,
		&p.Visibility,
		&ownerID,
		&ownerEmail,
		&ownerDisplay,
		&p.CreatedAt,
		&p.UpdatedAt,
		&p.FindingsBySev.Critical,
		&p.FindingsBySev.High,
		&p.FindingsBySev.Medium,
		&p.FindingsBySev.Low,
		&p.FindingsBySev.Info,
		&p.SLABreached,
		&sast,
		&dast,
		&sca,
		&secrets,
		&p.SLACriticalDays,
		&p.SLAHighDays,
		&p.SLAMediumDays,
		&p.SLALowDays,
		&p.SLANotifyBeforeDays,
		&teamID,
		&teamName,
	); err != nil {
		return nil, fmt.Errorf("storage.ProjectsRepo.GetByID: %w", err)
	}

	p.Owner = domain.ProjectOwner{ID: ownerID, Email: ownerEmail, DisplayName: ownerDisplay}
	p.Scanners = domain.ProjectScanners{
		SAST: domain.ScannerState(sast), DAST: domain.ScannerState(dast), SCA: domain.ScannerState(sca), Secrets: domain.ScannerState(secrets),
	}
	if teamID != "" {
		p.Team = &domain.ProjectTeam{ID: teamID, Name: teamName}
	}
	setDerivedProjectHealth(&p)
	if p.Tags == nil {
		p.Tags = []string{}
	}
	return &p, nil
}

func (r *ProjectsRepo) List(ctx context.Context, filter ProjectsFilter) ([]domain.Project, int, string, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if filter.Sort == "" {
		filter.Sort = "critical-desc"
	}

	args := make([]any, 0, 8)
	where := make([]string, 0, 8)
	addArg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if filter.AccessibleProjectIDs != nil {
		if len(filter.AccessibleProjectIDs) == 0 {
			return []domain.Project{}, 0, "", nil
		}
		where = append(where, fmt.Sprintf("p.id = ANY(%s)", addArg(filter.AccessibleProjectIDs)))
	}
	if len(filter.Statuses) > 0 {
		statuses := make([]string, 0, len(filter.Statuses))
		for _, s := range filter.Statuses {
			statuses = append(statuses, string(s))
		}
		where = append(where, fmt.Sprintf("p.status = ANY(%s)", addArg(statuses)))
	}
	if filter.Owner != "" {
		where = append(where, fmt.Sprintf("p.created_by::text = %s", addArg(filter.Owner)))
	}
	if filter.Q != "" {
		qLike := "%" + strings.ToLower(strings.TrimSpace(filter.Q)) + "%"
		where = append(where, fmt.Sprintf(`(
			lower(p.name) LIKE %s
			OR lower(coalesce(p.description, '')) LIKE %s
			OR lower(coalesce(p.repo_url, '')) LIKE %s
			OR EXISTS (
				SELECT 1 FROM unnest(coalesce(p.tags, '{}'::text[])) t WHERE lower(t) LIKE %s
			)
		)`, addArg(qLike), addArg(qLike), addArg(qLike), addArg(qLike)))
	}
	if len(filter.Tags) > 0 {
		where = append(where, fmt.Sprintf("coalesce(p.tags, '{}'::text[]) && %s", addArg(filter.Tags)))
	}
	if filter.Team != "" {
		where = append(where, fmt.Sprintf("p.team_id::text = %s", addArg(filter.Team)))
	}
	if filter.SLA == "breached" {
		where = append(where, `EXISTS (
			SELECT 1 FROM findings f
			WHERE f.project_id = p.id
			  AND f.status IN (0, 1, 4)
			  AND f.severity >= 3
			  AND now() - f.first_seen > interval '7 day'
		)`)
	}

	baseWhere := ""
	if len(where) > 0 {
		baseWhere = "WHERE " + strings.Join(where, " AND ")
	}
	baseWhereNoCursor := baseWhere

	cursorWhere := ""
	if filter.Cursor != "" {
		parts := strings.SplitN(filter.Cursor, "|", 2)
		if len(parts) == 2 {
			cursorPinned := parts[0] == "1"
			cursorID, err := uuid.Parse(parts[1])
			if err == nil {
				cursorWhere = fmt.Sprintf("(p.pinned, p.id) < (%s, %s)", addArg(cursorPinned), addArg(cursorID))
			}
		}
	}
	if cursorWhere != "" {
		if baseWhere == "" {
			baseWhere = "WHERE " + cursorWhere
		} else {
			baseWhere += " AND " + cursorWhere
		}
	}

	orderBy := "ORDER BY p.pinned DESC, sev.critical DESC, p.id DESC"
	switch filter.Sort {
	case "name":
		orderBy = "ORDER BY p.pinned DESC, p.name ASC, p.id DESC"
	case "created-at":
		orderBy = "ORDER BY p.pinned DESC, p.created_at DESC, p.id DESC"
	case "updated-at":
		orderBy = "ORDER BY p.pinned DESC, p.updated_at DESC, p.id DESC"
	case "critical-desc":
		orderBy = "ORDER BY p.pinned DESC, sev.critical DESC, p.id DESC"
	case "scan-date":
		orderBy = `ORDER BY p.pinned DESC, (
			SELECT max(f.last_seen) FROM findings f WHERE f.project_id = p.id
		) DESC NULLS LAST, p.id DESC`
	case "trend":
		// Sort by critical count — approximates trend direction
		orderBy = "ORDER BY p.pinned DESC, sev.critical DESC, p.id DESC"
	}

	countQ := `
		SELECT count(*)
		FROM projects p
		` + baseWhereNoCursor
	countArgs := args
	if filter.Cursor != "" && len(args) >= 2 {
		countArgs = args[:len(args)-2]
	}
	var total int
	if err := r.pool.QueryRow(ctx, countQ, countArgs...).Scan(&total); err != nil {
		return nil, 0, "", fmt.Errorf("storage.ProjectsRepo.List: count: %w", err)
	}

	limitArg := addArg(limit + 1)
	q := `
		SELECT
			p.id,
			p.slug,
			p.name,
			coalesce(p.description, ''),
			p.icon_color,
			coalesce(p.repo_url, ''),
			coalesce(p.repo_provider, ''),
			coalesce(p.tags, '{}'::text[]),
			p.status,
			p.setup_completed,
			p.pinned,
			coalesce(p.visibility, 'workspace'),
			coalesce(owner.id, p.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
			coalesce(owner.email, ''),
			coalesce(nullif(owner.full_name, ''), owner.email, 'Unknown Owner'),
			p.created_at,
			p.updated_at,
			coalesce(sev.critical, 0),
			coalesce(sev.high, 0),
			coalesce(sev.medium, 0),
			coalesce(sev.low, 0),
			coalesce(sev.info, 0),
			coalesce(sev.sla_breached_count, 0),
			case when coalesce(sev.has_sast, false) then 'ok' else 'off' end,
			case when coalesce(sev.has_dast, false) then 'ok' else 'off' end,
			case when coalesce(sev.has_sca, false) then 'ok' else 'off' end,
			case when coalesce(sev.has_secrets, false) then 'ok' else 'off' end,
			coalesce(t.id::text, ''),
			coalesce(t.name, '')
		FROM projects p
		LEFT JOIN users owner ON owner.id = p.created_by
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN LATERAL (
			SELECT
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 4) AS critical,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 3) AS high,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 2) AS medium,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 1) AS low,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity = 0) AS info,
				count(*) FILTER (WHERE f.status IN (0, 1, 4) AND f.severity >= 3 AND now() - f.first_seen > interval '7 day') AS sla_breached_count,
				bool_or(f.finding_kind = 1) AS has_sast,
				bool_or(f.finding_kind = 2) AS has_dast,
				bool_or(f.finding_kind = 0) AS has_sca,
				bool_or(f.finding_kind = 4) AS has_secrets
			FROM findings f
			WHERE f.project_id = p.id
		) sev ON true
		` + baseWhere + `
		` + orderBy + `
		LIMIT ` + limitArg

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, "", fmt.Errorf("storage.ProjectsRepo.List: query: %w", err)
	}
	defer rows.Close()

	projects := make([]domain.Project, 0, limit)
	hasMore := false
	for rows.Next() {
		var p domain.Project
		var ownerID uuid.UUID
		var ownerEmail, ownerDisplay string
		var sast, dast, sca, secrets string
		var teamID, teamName string
		if err := rows.Scan(
			&p.ID,
			&p.Slug,
			&p.Name,
			&p.Description,
			&p.IconColor,
			&p.RepoURL,
			&p.RepoProvider,
			&p.Tags,
			&p.Status,
			&p.SetupCompleted,
			&p.Pinned,
			&p.Visibility,
			&ownerID,
			&ownerEmail,
			&ownerDisplay,
			&p.CreatedAt,
			&p.UpdatedAt,
			&p.FindingsBySev.Critical,
			&p.FindingsBySev.High,
			&p.FindingsBySev.Medium,
			&p.FindingsBySev.Low,
			&p.FindingsBySev.Info,
			&p.SLABreached,
			&sast,
			&dast,
			&sca,
			&secrets,
			&teamID,
			&teamName,
		); err != nil {
			return nil, 0, "", fmt.Errorf("storage.ProjectsRepo.List: scan: %w", err)
		}

		if len(projects) >= limit {
			hasMore = true
			continue
		}

		p.Owner = domain.ProjectOwner{ID: ownerID, Email: ownerEmail, DisplayName: ownerDisplay}
		p.Scanners = domain.ProjectScanners{
			SAST: domain.ScannerState(sast), DAST: domain.ScannerState(dast), SCA: domain.ScannerState(sca), Secrets: domain.ScannerState(secrets),
		}
		if teamID != "" {
			p.Team = &domain.ProjectTeam{ID: teamID, Name: teamName}
		}
		setDerivedProjectHealth(&p)
		if p.Tags == nil {
			p.Tags = []string{}
		}
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, "", fmt.Errorf("storage.ProjectsRepo.List: rows: %w", err)
	}

	nextCursor := ""
	if hasMore && len(projects) > 0 {
		last := projects[len(projects)-1]
		if last.Pinned {
			nextCursor = "1|" + last.ID.String()
		} else {
			nextCursor = "0|" + last.ID.String()
		}
	}

	return projects, total, nextCursor, nil
}

func (r *ProjectsRepo) Update(ctx context.Context, p *domain.Project) error {
	const q = `
		UPDATE projects
		SET name = $1,
			slug = $2,
			description = $3,
			repo_url = $4,
			repo_provider = $5,
			tags = $6,
			status = $7,
			setup_completed = $8,
			visibility = $9,
			sla_critical_days = $10,
			sla_high_days = $11,
			sla_medium_days = $12,
			sla_low_days = $13,
			sla_notify_before_days = $14,
			team_id = $15,
			updated_at = $16
		WHERE id = $17`

	p.UpdatedAt = time.Now()
	if p.Slug == "" {
		p.Slug = slugifyProjectName(p.Name)
	}
	if p.Visibility == "" {
		p.Visibility = "workspace"
	}

	var teamID any
	if p.Team != nil && p.Team.ID != "" {
		if tid, err := uuid.Parse(p.Team.ID); err == nil {
			teamID = tid
		}
	}

	tag, err := r.pool.Exec(ctx, q,
		p.Name, p.Slug, p.Description, emptyToNil(p.RepoURL), emptyToNil(p.RepoProvider), p.Tags, p.Status, p.SetupCompleted,
		p.Visibility, p.SLACriticalDays, p.SLAHighDays, p.SLAMediumDays, p.SLALowDays, p.SLANotifyBeforeDays,
		teamID, p.UpdatedAt, p.ID,
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

func (r *ProjectsRepo) SetPinned(ctx context.Context, id uuid.UUID, pinned bool) error {
	const q = `UPDATE projects SET pinned = $1, updated_at = now() WHERE id = $2`
	tag, err := r.pool.Exec(ctx, q, pinned, id)
	if err != nil {
		return fmt.Errorf("storage.ProjectsRepo.SetPinned: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.ProjectsRepo.SetPinned: project %s not found", id)
	}
	return nil
}

func (r *ProjectsRepo) GetTrend(ctx context.Context, projectID uuid.UUID, days int) ([]ProjectTrendPoint, error) {
	if days <= 0 || days > 365 {
		days = 30
	}
	const q = `
		WITH day_series AS (
			SELECT generate_series(
				date_trunc('day', now()) - ($2::int - 1) * interval '1 day',
				date_trunc('day', now()),
				interval '1 day'
			) AS day
		)
		SELECT
			ds.day::date,
			coalesce(count(f.id) FILTER (
				WHERE f.status IN (0, 1, 4)
				  AND f.severity >= 3
				  AND date_trunc('day', f.last_seen) <= ds.day
			), 0) AS open_high_critical
		FROM day_series ds
		LEFT JOIN findings f ON f.project_id = $1
		GROUP BY ds.day
		ORDER BY ds.day ASC`

	rows, err := r.pool.Query(ctx, q, projectID, days)
	if err != nil {
		return nil, fmt.Errorf("storage.ProjectsRepo.GetTrend: %w", err)
	}
	defer rows.Close()

	points := make([]ProjectTrendPoint, 0, days)
	for rows.Next() {
		var p ProjectTrendPoint
		if err := rows.Scan(&p.Date, &p.Count); err != nil {
			return nil, fmt.Errorf("storage.ProjectsRepo.GetTrend: scan: %w", err)
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.ProjectsRepo.GetTrend: rows: %w", err)
	}
	return points, nil
}

func (r *ProjectsRepo) GetQuickPeek(ctx context.Context, projectID uuid.UUID) ([]QuickPeekFinding, []QuickPeekEvent, QuickPeekStatusStats, error) {
	findingsQ := `
		SELECT id, title, severity, status
		FROM findings f
		LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		WHERE f.project_id = $1 AND f.status IN (0, 1, 4)
		ORDER BY f.severity DESC, fs.priority_score DESC NULLS LAST, f.last_seen DESC
		LIMIT 5`
	eventsQ := `
		SELECT id, coalesce(action, ''), method, path, created_at, user_id
		FROM audit_log
		WHERE resource_type = 'project' AND resource_id = $1::text
		ORDER BY created_at DESC, id DESC
		LIMIT 5`
	statsQ := `
		SELECT
			count(*) FILTER (WHERE status = 0) AS new,
			count(*) FILTER (WHERE status = 1) AS triaged,
			count(*) FILTER (WHERE status = 3) AS fixed,
			count(*) FILTER (WHERE status IN (2, 4)) AS wontfix
		FROM findings
		WHERE project_id = $1`

	fRows, err := r.pool.Query(ctx, findingsQ, projectID)
	if err != nil {
		return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: findings: %w", err)
	}
	defer fRows.Close()
	findings := make([]QuickPeekFinding, 0, 5)
	for fRows.Next() {
		var f QuickPeekFinding
		if err := fRows.Scan(&f.ID, &f.Title, &f.Severity, &f.Status); err != nil {
			return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: findings scan: %w", err)
		}
		findings = append(findings, f)
	}
	if err := fRows.Err(); err != nil {
		return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: findings rows: %w", err)
	}

	eRows, err := r.pool.Query(ctx, eventsQ, projectID)
	if err != nil {
		return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: events: %w", err)
	}
	defer eRows.Close()
	events := make([]QuickPeekEvent, 0, 5)
	for eRows.Next() {
		var e QuickPeekEvent
		if err := eRows.Scan(&e.ID, &e.Action, &e.Method, &e.Path, &e.CreatedAt, &e.UserID); err != nil {
			return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: events scan: %w", err)
		}
		events = append(events, e)
	}
	if err := eRows.Err(); err != nil {
		return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: events rows: %w", err)
	}

	var stats QuickPeekStatusStats
	if err := r.pool.QueryRow(ctx, statsQ, projectID).Scan(&stats.New, &stats.Triaged, &stats.Fixed, &stats.Wontfix); err != nil {
		return nil, nil, QuickPeekStatusStats{}, fmt.Errorf("storage.ProjectsRepo.GetQuickPeek: stats: %w", err)
	}

	return findings, events, stats, nil
}

func setDerivedProjectHealth(p *domain.Project) {
	if p.Status == domain.ProjectStatusPaused || p.Status == domain.ProjectStatusArchived {
		p.Health = domain.ProjectHealthPaused
		return
	}
	if !p.SetupCompleted {
		p.Health = domain.ProjectHealthSetup
		return
	}
	if p.SLABreached > 0 || p.FindingsBySev.Critical > 0 {
		p.Health = domain.ProjectHealthBreach
		return
	}
	if p.FindingsBySev.High > 0 {
		p.Health = domain.ProjectHealthWarn
		return
	}
	p.Health = domain.ProjectHealthHealthy
}

func slugifyProjectName(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	replacer := strings.NewReplacer(" ", "-", "_", "-", "/", "-", ".", "-")
	slug = replacer.Replace(slug)
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "project"
	}
	if len(slug) > 96 {
		slug = slug[:96]
	}
	return slug
}

func emptyToNil(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func uuidOrNil(id uuid.UUID) any {
	if id == uuid.Nil {
		return nil
	}
	return id
}
