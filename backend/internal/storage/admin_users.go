package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type AdminUserListItem struct {
	ID            uuid.UUID
	FullName      sql.NullString
	Email         string
	OrgRole       string
	Status        string
	LastLoginAt   sql.NullTime
	TeamsCount    int
	ProductsCount int
	CreatedAt     time.Time
}

type ListAdminUsersFilters struct {
	TenantID uuid.UUID
	Q        string
	Role     string
	Status   string
	Cursor   *uuid.UUID
	Limit    int
}

type UserAccessView struct {
	OrgRole      string
	Teams        []TeamRef
	ProductRoles []UserProductRoleView
}

type TeamRef struct {
	ID   uuid.UUID
	Name string
}

type UserProductRoleView struct {
	ProductID   uuid.UUID
	ProductName string
	Role        string
}

func ListAdminUsers(ctx context.Context, db *sql.DB, filters ListAdminUsersFilters) ([]AdminUserListItem, *uuid.UUID, error) {
	where := []string{"u.tenant_id = $1"}
	args := []interface{}{filters.TenantID}
	if filters.Q != "" {
		args = append(args, "%"+filters.Q+"%")
		where = append(where, fmt.Sprintf("(COALESCE(u.full_name,'') ILIKE $%d OR u.email ILIKE $%d)", len(args), len(args)))
	}
	if filters.Role != "" {
		args = append(args, filters.Role)
		where = append(where, fmt.Sprintf("u.org_role = $%d", len(args)))
	}
	if filters.Status != "" {
		args = append(args, filters.Status)
		where = append(where, fmt.Sprintf("u.status = $%d", len(args)))
	}
	if filters.Cursor != nil {
		args = append(args, *filters.Cursor)
		where = append(where, fmt.Sprintf("u.id < $%d", len(args)))
	}
	args = append(args, filters.Limit+1)

	query := `SELECT u.id, u.full_name, u.email, u.org_role, u.status, u.last_login_at, u.created_at,
		(SELECT COUNT(*) FROM team_members tm WHERE tm.tenant_id = u.tenant_id AND tm.user_id = u.id) AS teams_count,
		(SELECT COUNT(*) FROM product_user_roles pur WHERE pur.tenant_id = u.tenant_id AND pur.user_id = u.id) AS products_count
		FROM users u
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY u.id DESC
		LIMIT $` + fmt.Sprint(len(args))

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	items := []AdminUserListItem{}
	for rows.Next() {
		var it AdminUserListItem
		if err := rows.Scan(&it.ID, &it.FullName, &it.Email, &it.OrgRole, &it.Status, &it.LastLoginAt, &it.CreatedAt, &it.TeamsCount, &it.ProductsCount); err != nil {
			return nil, nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	var next *uuid.UUID
	if len(items) > filters.Limit {
		id := items[filters.Limit-1].ID
		next = &id
		items = items[:filters.Limit]
	}
	return items, next, nil
}

func FindPendingInvitationByEmail(ctx context.Context, db *sql.DB, tenantID uuid.UUID, email string) (*uuid.UUID, error) {
	var id uuid.UUID
	err := db.QueryRowContext(ctx, `SELECT id FROM user_invitations WHERE tenant_id=$1 AND lower(email)=lower($2) AND status='pending' LIMIT 1`, tenantID, email).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func UserExistsByEmailInTenant(ctx context.Context, db *sql.DB, tenantID uuid.UUID, email string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id=$1 AND lower(email)=lower($2))`, tenantID, email).Scan(&exists)
	return exists, err
}

func CreateInvitation(ctx context.Context, db *sql.DB, tenantID uuid.UUID, email string, fullName *string, orgRole string, invitedBy *uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	var invitedByArg interface{}
	if invitedBy != nil {
		invitedByArg = *invitedBy
	}
	err := db.QueryRowContext(ctx, `INSERT INTO user_invitations(tenant_id,email,full_name,org_role,status,invited_by)
	VALUES($1,$2,$3,$4,'pending',$5) RETURNING id`, tenantID, email, fullName, orgRole, invitedByArg).Scan(&id)
	return id, err
}

func UpdateAdminUser(ctx context.Context, db *sql.DB, tenantID, userID uuid.UUID, orgRole, status *string) error {
	_, err := db.ExecContext(ctx, `UPDATE users
	SET org_role = COALESCE($3, org_role),
		status = COALESCE($4, status),
		deactivated_at = CASE WHEN $4='deactivated' THEN NOW() ELSE deactivated_at END
	WHERE tenant_id=$1 AND id=$2`, tenantID, userID, orgRole, status)
	return err
}

func GetUserAccessView(ctx context.Context, db *sql.DB, tenantID, userID uuid.UUID) (*UserAccessView, error) {
	view := &UserAccessView{}
	if err := db.QueryRowContext(ctx, `SELECT org_role FROM users WHERE tenant_id=$1 AND id=$2`, tenantID, userID).Scan(&view.OrgRole); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	teamRows, err := db.QueryContext(ctx, `SELECT t.id,t.name FROM team_members tm JOIN teams t ON t.tenant_id=tm.tenant_id AND t.id=tm.team_id WHERE tm.tenant_id=$1 AND tm.user_id=$2 ORDER BY t.name`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer teamRows.Close()
	for teamRows.Next() {
		var tr TeamRef
		if err := teamRows.Scan(&tr.ID, &tr.Name); err != nil {
			return nil, err
		}
		view.Teams = append(view.Teams, tr)
	}
	roleRows, err := db.QueryContext(ctx, `SELECT pur.product_id,p.name,pur.role FROM product_user_roles pur JOIN products p ON p.tenant_id=pur.tenant_id AND p.id=pur.product_id WHERE pur.tenant_id=$1 AND pur.user_id=$2`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer roleRows.Close()
	for roleRows.Next() {
		var pr UserProductRoleView
		if err := roleRows.Scan(&pr.ProductID, &pr.ProductName, &pr.Role); err != nil {
			return nil, err
		}
		view.ProductRoles = append(view.ProductRoles, pr)
	}
	return view, nil
}

func ReplaceUserTeams(ctx context.Context, db *sql.DB, tenantID, userID uuid.UUID, teamIDs []uuid.UUID) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM team_members WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID); err != nil {
		return err
	}
	for _, teamID := range teamIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO team_members(tenant_id,team_id,user_id) VALUES($1,$2,$3)`, tenantID, teamID, userID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func UpsertUserProductRole(ctx context.Context, db *sql.DB, tenantID, userID, productID uuid.UUID, role string) error {
	_, err := db.ExecContext(ctx, `INSERT INTO product_user_roles(tenant_id,product_id,user_id,role)
	VALUES($1,$2,$3,$4)
	ON CONFLICT(product_id,user_id) DO UPDATE SET role=EXCLUDED.role`, tenantID, productID, userID, role)
	return err
}

func DeleteUserProductRole(ctx context.Context, db *sql.DB, tenantID, userID, productID uuid.UUID) error {
	_, err := db.ExecContext(ctx, `DELETE FROM product_user_roles WHERE tenant_id=$1 AND product_id=$2 AND user_id=$3`, tenantID, productID, userID)
	return err
}
