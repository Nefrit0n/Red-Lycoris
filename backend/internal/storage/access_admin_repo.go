package storage

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

func accessRank(level domain.AccessLevel) int {
	switch level {
	case domain.AccessAdmin:
		return 3
	case domain.AccessWrite:
		return 2
	case domain.AccessRead:
		return 1
	default:
		return 0
	}
}

func resolveEffectiveLevel(groupLevels []domain.AccessLevel, personal *domain.AccessLevel) *domain.AccessLevel {
	if personal != nil {
		return personal
	}
	best := domain.AccessLevel("")
	for _, lvl := range groupLevels {
		if accessRank(lvl) > accessRank(best) {
			best = lvl
		}
	}
	if best == "" {
		return nil
	}
	out := best
	return &out
}

func (r *UsersRepo) ListAllAdminGroups(ctx context.Context, q string) ([]domain.AdminGroup, error) {
	args := []any{}
	where := ""
	if strings.TrimSpace(q) != "" {
		args = append(args, "%"+strings.TrimSpace(q)+"%")
		where = "WHERE g.name ILIKE $1"
	}
	query := `
	SELECT g.id, g.name, g.description, g.color_key, g.source, g.external_id,
	       g.created_at, g.updated_at,
	       cb.email,
	       (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS members_count,
	       (SELECT COUNT(*) FROM project_access pa WHERE pa.subject_kind='group' AND pa.subject_id = g.id) AS projects_count
	FROM groups g
	LEFT JOIN users cb ON cb.id = g.created_by_user_id
	` + where + `
	ORDER BY g.name`
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.ListAllAdminGroups: %w", err)
	}
	defer rows.Close()
	out := make([]domain.AdminGroup, 0)
	for rows.Next() {
		var g domain.AdminGroup
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.ColorKey, &g.Source, &g.ExternalID,
			&g.CreatedAt, &g.UpdatedAt, &g.CreatedBy, &g.MembersCount, &g.ProjectsCount); err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.ListAllAdminGroups scan: %w", err)
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *UsersRepo) CreateGroup(ctx context.Context, g *domain.AdminGroup, actorID uuid.UUID) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	now := time.Now().UTC()
	g.CreatedAt = now
	g.UpdatedAt = now
	if g.Source == "" {
		g.Source = "manual"
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO groups (id, name, description, color_key, source, created_at, created_by_user_id, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, g.ID, strings.TrimSpace(g.Name), strings.TrimSpace(g.Description), g.ColorKey, g.Source, g.CreatedAt, actorID, g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.CreateGroup: %w", err)
	}
	return nil
}

func (r *UsersRepo) GetAdminGroupByID(ctx context.Context, id uuid.UUID) (*domain.AdminGroup, error) {
	const q = `
	SELECT g.id, g.name, g.description, g.color_key, g.source, g.external_id,
	       g.created_at, g.updated_at,
	       cb.email,
	       (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS members_count,
	       (SELECT COUNT(*) FROM project_access pa WHERE pa.subject_kind='group' AND pa.subject_id = g.id) AS projects_count
	FROM groups g
	LEFT JOIN users cb ON cb.id = g.created_by_user_id
	WHERE g.id=$1`
	var g domain.AdminGroup
	if err := r.pool.QueryRow(ctx, q, id).Scan(&g.ID, &g.Name, &g.Description, &g.ColorKey, &g.Source, &g.ExternalID,
		&g.CreatedAt, &g.UpdatedAt, &g.CreatedBy, &g.MembersCount, &g.ProjectsCount); err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetAdminGroupByID: %w", err)
	}
	return &g, nil
}

func (r *UsersRepo) UpdateGroup(ctx context.Context, id uuid.UUID, name, description, colorKey string) error {
	_, err := r.pool.Exec(ctx, `UPDATE groups SET name=$2, description=$3, color_key=$4, updated_at=now() WHERE id=$1`, id, strings.TrimSpace(name), strings.TrimSpace(description), colorKey)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.UpdateGroup: %w", err)
	}
	return nil
}

func (r *UsersRepo) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	var pc int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM project_access WHERE subject_kind='group' AND subject_id=$1`, id).Scan(&pc); err != nil {
		return fmt.Errorf("storage.UsersRepo.DeleteGroup count access: %w", err)
	}
	if pc > 0 {
		return fmt.Errorf("group has project access entries")
	}
	_, err := r.pool.Exec(ctx, `DELETE FROM groups WHERE id=$1`, id)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.DeleteGroup: %w", err)
	}
	return nil
}

func (r *UsersRepo) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]domain.GroupMember, error) {
	rows, err := r.pool.Query(ctx, `
	SELECT u.id, u.email, u.full_name, u.status, ug.added_at, ug.added_by_user_id
	FROM user_groups ug
	JOIN users u ON u.id = ug.user_id
	WHERE ug.group_id = $1
	ORDER BY u.email`, groupID)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.ListGroupMembers: %w", err)
	}
	defer rows.Close()
	out := make([]domain.GroupMember, 0)
	for rows.Next() {
		var m domain.GroupMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.DisplayName, &m.Status, &m.AddedAt, &m.AddedBy); err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.ListGroupMembers scan: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *UsersRepo) AddGroupMembers(ctx context.Context, groupID uuid.UUID, userIDs []uuid.UUID, actorID uuid.UUID) error {
	for _, uid := range userIDs {
		if _, err := r.pool.Exec(ctx, `INSERT INTO user_groups (user_id, group_id, added_at, added_by_user_id) VALUES ($1,$2,now(),$3) ON CONFLICT DO NOTHING`, uid, groupID, actorID); err != nil {
			return fmt.Errorf("storage.UsersRepo.AddGroupMembers: %w", err)
		}
	}
	return nil
}

func (r *UsersRepo) RemoveGroupMember(ctx context.Context, groupID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM user_groups WHERE group_id=$1 AND user_id=$2`, groupID, userID)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.RemoveGroupMember: %w", err)
	}
	return nil
}

func (r *UsersRepo) ListGroupProjects(ctx context.Context, groupID uuid.UUID) ([]domain.GroupProjectAccess, error) {
	rows, err := r.pool.Query(ctx, `
	SELECT p.id, p.name, pa.access_level, pa.created_at
	FROM project_access pa
	JOIN projects p ON p.id = pa.project_id
	WHERE pa.subject_kind='group' AND pa.subject_id=$1
	ORDER BY p.name`, groupID)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.ListGroupProjects: %w", err)
	}
	defer rows.Close()
	out := make([]domain.GroupProjectAccess, 0)
	for rows.Next() {
		var gpa domain.GroupProjectAccess
		var level string
		if err := rows.Scan(&gpa.ProjectID, &gpa.ProjectName, &level, &gpa.GrantedAt); err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.ListGroupProjects scan: %w", err)
		}
		gpa.Level = domain.AccessLevel(level)
		out = append(out, gpa)
	}
	return out, rows.Err()
}

func (r *UsersRepo) UpsertProjectAccess(ctx context.Context, projectID uuid.UUID, subjectKind string, subjectID uuid.UUID, level domain.AccessLevel, actorID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
	INSERT INTO project_access (id, project_id, subject_kind, subject_id, access_level, created_at, created_by_user_id)
	VALUES (gen_random_uuid(), $1,$2,$3,$4,now(),$5)
	ON CONFLICT (project_id, subject_kind, subject_id)
	DO UPDATE SET access_level = EXCLUDED.access_level`, projectID, subjectKind, subjectID, string(level), actorID)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.UpsertProjectAccess: %w", err)
	}
	return nil
}

func (r *UsersRepo) DeleteProjectAccess(ctx context.Context, projectID uuid.UUID, subjectKind string, subjectID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM project_access WHERE project_id=$1 AND subject_kind=$2 AND subject_id=$3`, projectID, subjectKind, subjectID)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.DeleteProjectAccess: %w", err)
	}
	return nil
}

func (r *UsersRepo) EffectiveProjectAccessForUser(ctx context.Context, userID uuid.UUID) ([]domain.EffectiveProjectAccess, error) {
	user, err := r.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx, `SELECT id, name FROM projects ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("projects list: %w", err)
	}
	defer rows.Close()
	type projectLite struct {
		id   uuid.UUID
		name string
	}
	projects := make([]projectLite, 0)
	for rows.Next() {
		var p projectLite
		if err := rows.Scan(&p.id, &p.name); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}

	if user.IsSystemAccount || user.IsAdmin() {
		out := make([]domain.EffectiveProjectAccess, 0, len(projects))
		for _, p := range projects {
			lvl := domain.AccessAdmin
			out = append(out, domain.EffectiveProjectAccess{ProjectID: p.id.String(), ProjectName: p.name, Level: &lvl,
				Sources: []domain.EffectiveAccessSource{{Kind: "role", ID: "admin", Name: "Admin", GrantedLevel: domain.AccessAdmin}},
			})
		}
		return out, nil
	}

	// user groups
	groupRows, err := r.pool.Query(ctx, `SELECT g.id, g.name, g.color_key FROM user_groups ug JOIN groups g ON g.id=ug.group_id WHERE ug.user_id=$1`, userID)
	if err != nil {
		return nil, fmt.Errorf("user groups: %w", err)
	}
	defer groupRows.Close()
	type ginfo struct{ name, color string }
	groups := map[uuid.UUID]ginfo{}
	for groupRows.Next() {
		var gid uuid.UUID
		var name, color string
		if err := groupRows.Scan(&gid, &name, &color); err != nil {
			return nil, err
		}
		groups[gid] = ginfo{name: name, color: color}
	}

	type pa struct {
		projectID uuid.UUID
		kind      string
		subjectID uuid.UUID
		level     domain.AccessLevel
	}
	paRows, err := r.pool.Query(ctx, `
	SELECT project_id, subject_kind, subject_id, access_level
	FROM project_access
	WHERE (subject_kind='user' AND subject_id=$1)
	   OR (subject_kind='group' AND subject_id = ANY(SELECT group_id FROM user_groups WHERE user_id=$1))`, userID)
	if err != nil {
		return nil, fmt.Errorf("project access: %w", err)
	}
	defer paRows.Close()
	byProject := map[uuid.UUID][]pa{}
	for paRows.Next() {
		var x pa
		var lvl string
		if err := paRows.Scan(&x.projectID, &x.kind, &x.subjectID, &lvl); err != nil {
			return nil, err
		}
		x.level = domain.AccessLevel(lvl)
		byProject[x.projectID] = append(byProject[x.projectID], x)
	}

	out := make([]domain.EffectiveProjectAccess, 0, len(projects))
	for _, p := range projects {
		items := byProject[p.id]
		sources := make([]domain.EffectiveAccessSource, 0, len(items))
		var personal *domain.AccessLevel
		best := domain.AccessLevel("")
		for _, it := range items {
			if it.kind == "user" {
				lvl := it.level
				personal = &lvl
				sources = append(sources, domain.EffectiveAccessSource{Kind: "user", ID: userID.String(), Name: "персонально", GrantedLevel: lvl})
				continue
			}
			g := groups[it.subjectID]
			color := g.color
			sources = append(sources, domain.EffectiveAccessSource{Kind: "group", ID: it.subjectID.String(), Name: g.name, ColorKey: &color, GrantedLevel: it.level})
			if accessRank(it.level) > accessRank(best) {
				best = it.level
			}
		}
		sort.SliceStable(sources, func(i, j int) bool {
			if sources[i].Kind == sources[j].Kind {
				return sources[i].Name < sources[j].Name
			}
			return sources[i].Kind == "user"
		})
		groupLevels := make([]domain.AccessLevel, 0, len(items))
		for _, it := range items {
			if it.kind == "group" {
				groupLevels = append(groupLevels, it.level)
			}
		}
		level := resolveEffectiveLevel(groupLevels, personal)
		out = append(out, domain.EffectiveProjectAccess{ProjectID: p.id.String(), ProjectName: p.name, Level: level, Sources: sources, IsPersonalOverride: personal != nil})
	}
	return out, nil
}

func (r *UsersRepo) ListRolesWithPermissions(ctx context.Context) ([]domain.AdminRole, error) {
	rows, err := r.pool.Query(ctx, `
	SELECT r.id, r.key, r.name, r.description,
	       (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS users_count
	FROM roles r
	ORDER BY r.key`)
	if err != nil {
		return nil, fmt.Errorf("roles list: %w", err)
	}
	defer rows.Close()
	roles := make([]domain.AdminRole, 0)
	idx := map[uuid.UUID]int{}
	for rows.Next() {
		var rr domain.AdminRole
		if err := rows.Scan(&rr.ID, &rr.Key, &rr.Name, &rr.Description, &rr.UsersCount); err != nil {
			return nil, err
		}
		rr.Permissions = []domain.RolePermission{}
		idx[rr.ID] = len(roles)
		roles = append(roles, rr)
	}
	permRows, err := r.pool.Query(ctx, `
	SELECT rp.role_id, p.key, p.resource, p.action, p.description
	FROM role_permissions rp
	JOIN permissions p ON p.key = rp.permission_key
	ORDER BY p.resource, p.action`)
	if err != nil {
		return nil, err
	}
	defer permRows.Close()
	for permRows.Next() {
		var rid uuid.UUID
		var p domain.RolePermission
		if err := permRows.Scan(&rid, &p.Key, &p.Resource, &p.Action, &p.Description); err != nil {
			return nil, err
		}
		if i, ok := idx[rid]; ok {
			roles[i].Permissions = append(roles[i].Permissions, p)
		}
	}
	return roles, nil
}

func (r *UsersRepo) GetRoleWithPermissions(ctx context.Context, id uuid.UUID) (*domain.AdminRole, error) {
	all, err := r.ListRolesWithPermissions(ctx)
	if err != nil {
		return nil, err
	}
	for _, r := range all {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("role not found")
}
