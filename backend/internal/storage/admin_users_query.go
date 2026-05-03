package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/domain"
)

// listUsersCursor is the opaque pagination cursor for ListV2.
type listUsersCursor struct {
	Sort        string `json:"s"`
	LastLoginMS *int64 `json:"ll,omitempty"` // unix millis, omitted when null
	CreatedMS   int64  `json:"ct"`
	Email       string `json:"em"`
	FullName    string `json:"fn"`
	ID          string `json:"id"`
}

func encodeListCursor(u domain.AdminUserResponse, sort string) string {
	c := listUsersCursor{
		Sort:      sort,
		CreatedMS: u.CreatedAt.UnixMilli(),
		Email:     u.Email,
		FullName:  u.DisplayName,
		ID:        u.ID.String(),
	}
	if u.LastLoginAt != nil {
		ms := u.LastLoginAt.UnixMilli()
		c.LastLoginMS = &ms
	}
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeListCursor(s string) (*listUsersCursor, error) {
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	var c listUsersCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("json unmarshal: %w", err)
	}
	return &c, nil
}

// ListV2 returns users with rich DTO (role, groups, MFA, identity) supporting
// filtering, sorting, and cursor-based pagination.
// Returns: rows, total (matches filter, ignoring cursor), hasMore, nextCursor, error.
func (r *UsersRepo) ListV2(ctx context.Context, f domain.UserListFilter) ([]domain.AdminUserResponse, int, bool, string, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	sort := f.Sort
	if sort == "" {
		sort = "last_login_desc"
	}

	var cur *listUsersCursor
	if f.Cursor != "" {
		c, err := decodeListCursor(f.Cursor)
		if err != nil {
			return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: invalid cursor: %w", err)
		}
		cur = c
	}

	// --- Shared FROM + base filter (no cursor) ---
	baseArgs := []any{}
	n := 0
	add := func(v any) string {
		baseArgs = append(baseArgs, v)
		n++
		return fmt.Sprintf("$%d", n)
	}

	var baseWheres []string

	if q := strings.TrimSpace(f.Q); q != "" {
		pat := "%" + q + "%"
		pa := add(pat)
		pb := add(pat)
		baseWheres = append(baseWheres, fmt.Sprintf("(u.email ILIKE %s OR u.full_name ILIKE %s)", pa, pb))
	}
	if len(f.Roles) > 0 {
		ra := add(f.Roles)
		baseWheres = append(baseWheres, fmt.Sprintf("COALESCE(r.key, 'member') = ANY(%s)", ra))
	}
	if len(f.Statuses) > 0 {
		sa := add(f.Statuses)
		baseWheres = append(baseWheres, fmt.Sprintf("u.status = ANY(%s)", sa))
	}
	if f.GroupID != nil {
		ga := add(f.GroupID)
		baseWheres = append(baseWheres, fmt.Sprintf(
			"EXISTS(SELECT 1 FROM user_groups ug WHERE ug.user_id = u.id AND ug.group_id = %s)", ga))
	}
	if f.MFA != nil {
		ma := add(*f.MFA)
		baseWheres = append(baseWheres, fmt.Sprintf(
			"EXISTS(SELECT 1 FROM mfa_factors mf WHERE mf.user_id = u.id) = %s", ma))
	}
	if f.Source != "" {
		sa := add(f.Source)
		baseWheres = append(baseWheres, fmt.Sprintf("COALESCE(ui_sub.kind, 'local') = %s", sa))
	}
	if f.Dormant {
		baseWheres = append(baseWheres, "(u.last_login_at < now() - interval '90 days' OR u.last_login_at IS NULL)")
	}

	baseWhere := "1=1"
	if len(baseWheres) > 0 {
		baseWhere = strings.Join(baseWheres, " AND ")
	}

	fromClause := `
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		LEFT JOIN LATERAL (
			SELECT kind FROM user_identities WHERE user_id = u.id
			ORDER BY last_used_at DESC NULLS LAST LIMIT 1
		) ui_sub ON true
		LEFT JOIN user_credentials uc ON uc.user_id = u.id
		WHERE ` + baseWhere

	// --- Count query (no cursor) ---
	countQ := "SELECT COUNT(*)" + fromClause
	var total int
	if err := r.pool.QueryRow(ctx, countQ, baseArgs...).Scan(&total); err != nil {
		return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: count: %w", err)
	}

	// --- Cursor condition for data query ---
	// Clone args for data query and add cursor + limit args
	dataArgs := make([]any, len(baseArgs))
	copy(dataArgs, baseArgs)
	dn := n

	addD := func(v any) string {
		dataArgs = append(dataArgs, v)
		dn++
		return fmt.Sprintf("$%d", dn)
	}

	cursorWhere := ""
	if cur != nil {
		switch sort {
		case "last_login_desc":
			cursorID := addD(cur.ID)
			if cur.LastLoginMS != nil {
				ts := time.UnixMilli(*cur.LastLoginMS).UTC()
				cursorTS := addD(ts)
				cursorWhere = fmt.Sprintf(`AND (
					u.last_login_at < %s
					OR u.last_login_at IS NULL
					OR (u.last_login_at = %s AND u.id::text < %s)
				)`, cursorTS, cursorTS, cursorID)
			} else {
				// cursor is in the NULL section
				cursorWhere = fmt.Sprintf(
					"AND (u.last_login_at IS NULL AND u.id::text < %s)", cursorID)
			}

		case "created_at_desc":
			ts := time.UnixMilli(cur.CreatedMS).UTC()
			cursorTS := addD(ts)
			cursorID := addD(cur.ID)
			cursorWhere = fmt.Sprintf(`AND (
				u.created_at < %s
				OR (u.created_at = %s AND u.id::text < %s)
			)`, cursorTS, cursorTS, cursorID)

		case "email_asc":
			cursorEmail := addD(cur.Email)
			cursorID := addD(cur.ID)
			cursorWhere = fmt.Sprintf(`AND (
				u.email > %s
				OR (u.email = %s AND u.id::text > %s)
			)`, cursorEmail, cursorEmail, cursorID)

		case "name_asc":
			if cur.FullName != "" {
				cursorName := addD(cur.FullName)
				cursorID := addD(cur.ID)
				cursorWhere = fmt.Sprintf(`AND (
					u.full_name > %s
					OR u.full_name IS NULL
					OR (u.full_name = %s AND u.id::text > %s)
				)`, cursorName, cursorName, cursorID)
			} else {
				// cursor is in the NULL section
				cursorID := addD(cur.ID)
				cursorWhere = fmt.Sprintf(
					"AND (u.full_name IS NULL AND u.id::text > %s)", cursorID)
			}
		}
	}

	orderBy := buildListV2OrderBy(sort)
	limitArg := addD(f.Limit + 1) // fetch one extra to detect hasMore

	selectCols := `
		u.id, u.email, u.full_name, u.status, u.is_system_account,
		u.last_login_at, u.last_login_ip::text, u.created_at,
		COALESCE(r.key, 'member') AS role_key,
		COALESCE(r.name, 'Участник') AS role_name,
		COALESCE(ui_sub.kind, 'local') AS identity_kind,
		EXISTS(SELECT 1 FROM mfa_factors mf WHERE mf.user_id = u.id) AS mfa_enabled,
		COALESCE(uc.must_change, false) AS must_change_password`

	dataQ := fmt.Sprintf("SELECT %s %s %s %s LIMIT %s",
		selectCols, fromClause, cursorWhere, orderBy, limitArg)

	rows, err := r.pool.Query(ctx, dataQ, dataArgs...)
	if err != nil {
		return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: query: %w", err)
	}
	defer rows.Close()

	users := make([]domain.AdminUserResponse, 0, f.Limit)
	for rows.Next() {
		var u domain.AdminUserResponse
		var ipStr *string
		var roleKey, roleName, identityKind string
		if err := rows.Scan(
			&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.IsSystemAccount,
			&u.LastLoginAt, &ipStr, &u.CreatedAt,
			&roleKey, &roleName, &identityKind,
			&u.MFAEnabled, &u.MustChangePassword,
		); err != nil {
			return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: scan: %w", err)
		}
		u.LastLoginIP = ipStr
		u.Role = domain.RoleRef{Key: roleKey, Name: roleName}
		u.IdentityKind = identityKind
		u.Groups = []domain.GroupRef{}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: rows: %w", err)
	}

	hasMore := len(users) > f.Limit
	if hasMore {
		users = users[:f.Limit]
	}

	// Batch-fetch groups for returned users
	if len(users) > 0 {
		if err := r.attachGroups(ctx, users); err != nil {
			return nil, 0, false, "", fmt.Errorf("storage.UsersRepo.ListV2: groups: %w", err)
		}
	}

	nextCursor := ""
	if hasMore {
		nextCursor = encodeListCursor(users[len(users)-1], sort)
	}

	return users, total, hasMore, nextCursor, nil
}

func buildListV2OrderBy(sort string) string {
	switch sort {
	case "created_at_desc":
		return "ORDER BY u.created_at DESC, u.id DESC"
	case "email_asc":
		return "ORDER BY u.email ASC, u.id ASC"
	case "name_asc":
		return "ORDER BY u.full_name ASC NULLS LAST, u.email ASC, u.id ASC"
	default: // last_login_desc
		return "ORDER BY u.last_login_at DESC NULLS LAST, u.id DESC"
	}
}

// attachGroups batch-fetches group membership for a slice of users and mutates Groups in-place.
func (r *UsersRepo) attachGroups(ctx context.Context, users []domain.AdminUserResponse) error {
	ids := make([]uuid.UUID, len(users))
	idxByID := make(map[uuid.UUID]int, len(users))
	for i, u := range users {
		ids[i] = u.ID
		idxByID[u.ID] = i
	}

	const q = `
		SELECT ug.user_id, g.id, g.name, g.color_key
		FROM user_groups ug
		JOIN groups g ON g.id = ug.group_id
		WHERE ug.user_id = ANY($1)
		ORDER BY g.name`

	rows, err := r.pool.Query(ctx, q, ids)
	if err != nil {
		return fmt.Errorf("attachGroups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var userID uuid.UUID
		var gr domain.GroupRef
		if err := rows.Scan(&userID, &gr.ID, &gr.Name, &gr.ColorKey); err != nil {
			return fmt.Errorf("attachGroups scan: %w", err)
		}
		if idx, ok := idxByID[userID]; ok {
			users[idx].Groups = append(users[idx].Groups, gr)
		}
	}
	return rows.Err()
}

// CheckEmailAvailable returns true if the email is not in use.
func (r *UsersRepo) CheckEmailAvailable(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
		strings.TrimSpace(email),
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("storage.UsersRepo.CheckEmailAvailable: %w", err)
	}
	return !exists, nil
}

// ListGroups returns groups for autocomplete in CreateUserModal.
func (r *UsersRepo) ListGroups(ctx context.Context, q string, limit int) ([]domain.GroupSummary, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	var rows pgx.Rows
	var err error
	if q == "" {
		rows, err = r.pool.Query(ctx,
			`SELECT id, name, color_key, description FROM groups ORDER BY name LIMIT $1`, limit)
	} else {
		pattern := "%" + strings.TrimSpace(q) + "%"
		rows, err = r.pool.Query(ctx,
			`SELECT id, name, color_key, description FROM groups WHERE name ILIKE $1 ORDER BY name LIMIT $2`,
			pattern, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.ListGroups: %w", err)
	}
	defer rows.Close()

	groups := make([]domain.GroupSummary, 0)
	for rows.Next() {
		var g domain.GroupSummary
		if err := rows.Scan(&g.ID, &g.Name, &g.ColorKey, &g.Description); err != nil {
			return nil, fmt.Errorf("storage.UsersRepo.ListGroups: scan: %w", err)
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

// AssignUserRole sets the user's role in user_roles (upsert) and updates user_identities.
// The trigger sync_user_roles_to_users_global_role will propagate to users.global_role.
func (r *UsersRepo) AssignUserRole(ctx context.Context, userID uuid.UUID, roleKey string, grantedByID *uuid.UUID) error {
	const q = `
		INSERT INTO user_roles (user_id, role_id, granted_at, granted_by)
		SELECT $1, r.id, now(), $3
		FROM roles r
		WHERE r.key = $2
		ON CONFLICT (user_id, role_id) DO UPDATE SET granted_at = now(), granted_by = EXCLUDED.granted_by`

	tag, err := r.pool.Exec(ctx, q, userID, roleKey, grantedByID)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.AssignUserRole: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.UsersRepo.AssignUserRole: role %q not found", roleKey)
	}

	// Remove any other roles this user had (one role per user)
	if _, err := r.pool.Exec(ctx, `
		DELETE FROM user_roles ur
		USING roles r
		WHERE ur.user_id = $1
		  AND ur.role_id = r.id
		  AND r.key != $2`, userID, roleKey,
	); err != nil {
		return fmt.Errorf("storage.UsersRepo.AssignUserRole: remove old roles: %w", err)
	}
	return nil
}

// AssignUserGroups replaces a user's group membership with the given group IDs.
func (r *UsersRepo) AssignUserGroups(ctx context.Context, userID uuid.UUID, groupIDs []uuid.UUID, addedByID *uuid.UUID) error {
	if len(groupIDs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, gid := range groupIDs {
		batch.Queue(
			`INSERT INTO user_groups (user_id, group_id, added_at, added_by)
			 VALUES ($1, $2, now(), $3)
			 ON CONFLICT (user_id, group_id) DO NOTHING`,
			userID, gid, addedByID,
		)
	}
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range groupIDs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("storage.UsersRepo.AssignUserGroups: %w", err)
		}
	}
	return nil
}

// EnsureLocalIdentity creates a user_identities row for 'local' if it doesn't exist.
func (r *UsersRepo) EnsureLocalIdentity(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_identities (user_id, kind, provider_id)
		VALUES ($1, 'local', 'local')
		ON CONFLICT (user_id, kind, provider_id) DO NOTHING`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("storage.UsersRepo.EnsureLocalIdentity: %w", err)
	}
	return nil
}

// CountGroups returns the total number of groups (for AccessPageShell tab counter).
func (r *UsersRepo) CountGroups(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM groups`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("storage.UsersRepo.CountGroups: %w", err)
	}
	return count, nil
}

// CountRoles returns the number of system roles (for AccessPageShell tab counter).
func (r *UsersRepo) CountRoles(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM roles WHERE is_system = true`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("storage.UsersRepo.CountRoles: %w", err)
	}
	return count, nil
}

// GetAdminUserByID fetches a single user with full AdminUserResponse join.
func (r *UsersRepo) GetAdminUserByID(ctx context.Context, id uuid.UUID) (*domain.AdminUserResponse, error) {
	const q = `
		SELECT
			u.id, u.email, u.full_name, u.status, u.is_system_account,
			u.last_login_at, u.last_login_ip::text, u.created_at,
			COALESCE(r.key, 'member') AS role_key,
			COALESCE(r.name, 'Участник') AS role_name,
			COALESCE(ui_sub.kind, 'local') AS identity_kind,
			EXISTS(SELECT 1 FROM mfa_factors mf WHERE mf.user_id = u.id) AS mfa_enabled,
			COALESCE(uc.must_change, false) AS must_change_password
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		LEFT JOIN LATERAL (
			SELECT kind FROM user_identities WHERE user_id = u.id
			ORDER BY last_used_at DESC NULLS LAST LIMIT 1
		) ui_sub ON true
		LEFT JOIN user_credentials uc ON uc.user_id = u.id
		WHERE u.id = $1`

	var u domain.AdminUserResponse
	var ipStr *string
	var roleKey, roleName, identityKind string
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.IsSystemAccount,
		&u.LastLoginAt, &ipStr, &u.CreatedAt,
		&roleKey, &roleName, &identityKind,
		&u.MFAEnabled, &u.MustChangePassword,
	)
	if err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetAdminUserByID: %w", err)
	}
	u.LastLoginIP = ipStr
	u.Role = domain.RoleRef{Key: roleKey, Name: roleName}
	u.IdentityKind = identityKind
	u.Groups = []domain.GroupRef{}

	users := []domain.AdminUserResponse{u}
	if err := r.attachGroups(ctx, users); err != nil {
		return nil, fmt.Errorf("storage.UsersRepo.GetAdminUserByID: groups: %w", err)
	}
	return &users[0], nil
}

// BulkDeactivateResult is per-user result of bulk deactivation.
type BulkDeactivateResult struct {
	UserID  uuid.UUID `json:"user_id"`
	Success bool      `json:"success"`
	Error   string    `json:"error,omitempty"`
}
