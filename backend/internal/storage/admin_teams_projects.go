package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type TeamListItem struct {
	ID            uuid.UUID
	Name          string
	MembersCount  int
	ProductsCount int
	UpdatedAt     time.Time
}

type TeamDetail struct {
	ID           uuid.UUID
	Name         string
	Description  sql.NullString
	Members      []TeamMemberView
	ProductRoles []TeamProductRoleView
}

type TeamMemberView struct {
	UserID   uuid.UUID
	Email    string
	FullName sql.NullString
}
type TeamProductRoleView struct {
	ProductID   uuid.UUID
	ProductName string
	Role        string
}

type ProductAccessView struct {
	Teams []ProductTeamAccess
	Users []ProductUserAccess
}

type ProductTeamAccess struct {
	TeamID   uuid.UUID
	TeamName string
	Role     string
}
type ProductUserAccess struct {
	UserID   uuid.UUID
	Email    string
	FullName sql.NullString
	Role     string
}

type EffectiveAccessSource struct {
	Type     string
	TeamID   *uuid.UUID
	TeamName *string
	Role     string
	Detail   string
}

func ListAdminTeams(ctx context.Context, db *sql.DB, tenantID uuid.UUID, q string, cursor *uuid.UUID, limit int) ([]TeamListItem, *uuid.UUID, error) {
	where := []string{"t.tenant_id = $1"}
	args := []interface{}{tenantID}
	if q != "" {
		args = append(args, "%"+q+"%")
		where = append(where, fmt.Sprintf("t.name ILIKE $%d", len(args)))
	}
	if cursor != nil {
		args = append(args, *cursor)
		where = append(where, fmt.Sprintf("t.id < $%d", len(args)))
	}
	args = append(args, limit+1)
	query := `SELECT t.id,t.name,
	(SELECT COUNT(*) FROM team_members tm WHERE tm.tenant_id=t.tenant_id AND tm.team_id=t.id),
	(SELECT COUNT(*) FROM product_team_roles ptr WHERE ptr.tenant_id=t.tenant_id AND ptr.team_id=t.id),
	COALESCE(MAX(tm.created_at), t.created_at) AS updated_at
	FROM teams t
	LEFT JOIN team_members tm ON tm.tenant_id=t.tenant_id AND tm.team_id=t.id
	WHERE ` + strings.Join(where, " AND ") + `
	GROUP BY t.id,t.name,t.created_at
	ORDER BY t.id DESC
	LIMIT $` + fmt.Sprint(len(args))
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	items := []TeamListItem{}
	for rows.Next() {
		var it TeamListItem
		if err := rows.Scan(&it.ID, &it.Name, &it.MembersCount, &it.ProductsCount, &it.UpdatedAt); err != nil {
			return nil, nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	var next *uuid.UUID
	if len(items) > limit {
		id := items[limit-1].ID
		next = &id
		items = items[:limit]
	}
	return items, next, nil
}

func CreateTeam(ctx context.Context, db *sql.DB, tenantID uuid.UUID, name string, description *string) (uuid.UUID, error) {
	var id uuid.UUID
	err := db.QueryRowContext(ctx, `INSERT INTO teams(tenant_id,name,description) VALUES($1,$2,$3) RETURNING id`, tenantID, name, description).Scan(&id)
	return id, err
}

func UpdateTeam(ctx context.Context, db *sql.DB, tenantID, teamID uuid.UUID, name, description *string) error {
	_, err := db.ExecContext(ctx, `UPDATE teams SET name=COALESCE($3,name), description=COALESCE($4,description) WHERE tenant_id=$1 AND id=$2`, tenantID, teamID, name, description)
	return err
}

func GetTeamDetail(ctx context.Context, db *sql.DB, tenantID, teamID uuid.UUID) (*TeamDetail, error) {
	var td TeamDetail
	err := db.QueryRowContext(ctx, `SELECT id,name,description FROM teams WHERE tenant_id=$1 AND id=$2`, tenantID, teamID).Scan(&td.ID, &td.Name, &td.Description)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	mrows, err := db.QueryContext(ctx, `SELECT u.id,u.email,u.full_name FROM team_members tm JOIN users u ON u.tenant_id=tm.tenant_id AND u.id=tm.user_id WHERE tm.tenant_id=$1 AND tm.team_id=$2`, tenantID, teamID)
	if err != nil {
		return nil, err
	}
	defer mrows.Close()
	for mrows.Next() {
		var mv TeamMemberView
		if err := mrows.Scan(&mv.UserID, &mv.Email, &mv.FullName); err != nil {
			return nil, err
		}
		td.Members = append(td.Members, mv)
	}
	prows, err := db.QueryContext(ctx, `SELECT ptr.product_id,p.name,ptr.role FROM product_team_roles ptr JOIN products p ON p.tenant_id=ptr.tenant_id AND p.id=ptr.product_id WHERE ptr.tenant_id=$1 AND ptr.team_id=$2`, tenantID, teamID)
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	for prows.Next() {
		var pv TeamProductRoleView
		if err := prows.Scan(&pv.ProductID, &pv.ProductName, &pv.Role); err != nil {
			return nil, err
		}
		td.ProductRoles = append(td.ProductRoles, pv)
	}
	return &td, nil
}

func ReplaceTeamMembers(ctx context.Context, db *sql.DB, tenantID, teamID uuid.UUID, userIDs []uuid.UUID) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM team_members WHERE tenant_id=$1 AND team_id=$2`, tenantID, teamID); err != nil {
		return err
	}
	for _, uid := range userIDs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO team_members(tenant_id,team_id,user_id) VALUES($1,$2,$3)`, tenantID, teamID, uid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func SetTeamProductRole(ctx context.Context, db *sql.DB, tenantID, productID, teamID uuid.UUID, role string) error {
	_, err := db.ExecContext(ctx, `INSERT INTO product_team_roles(tenant_id,product_id,team_id,role) VALUES($1,$2,$3,$4)
	ON CONFLICT(product_id,team_id) DO UPDATE SET role=EXCLUDED.role`, tenantID, productID, teamID, role)
	return err
}

func DeleteTeamProductRole(ctx context.Context, db *sql.DB, tenantID, productID, teamID uuid.UUID) error {
	_, err := db.ExecContext(ctx, `DELETE FROM product_team_roles WHERE tenant_id=$1 AND product_id=$2 AND team_id=$3`, tenantID, productID, teamID)
	return err
}

func ListAdminProducts(ctx context.Context, db *sql.DB, tenantID uuid.UUID) ([]map[string]interface{}, error) {
	rows, err := db.QueryContext(ctx, `SELECT id,name FROM products WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"id": id, "name": name})
	}
	return out, rows.Err()
}

func GetProductAccessView(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) (*ProductAccessView, error) {
	view := &ProductAccessView{}
	trows, err := db.QueryContext(ctx, `SELECT ptr.team_id,t.name,ptr.role FROM product_team_roles ptr JOIN teams t ON t.tenant_id=ptr.tenant_id AND t.id=ptr.team_id WHERE ptr.tenant_id=$1 AND ptr.product_id=$2`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer trows.Close()
	for trows.Next() {
		var it ProductTeamAccess
		if err := trows.Scan(&it.TeamID, &it.TeamName, &it.Role); err != nil {
			return nil, err
		}
		view.Teams = append(view.Teams, it)
	}
	urows, err := db.QueryContext(ctx, `SELECT pur.user_id,u.email,u.full_name,pur.role FROM product_user_roles pur JOIN users u ON u.tenant_id=pur.tenant_id AND u.id=pur.user_id WHERE pur.tenant_id=$1 AND pur.product_id=$2`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer urows.Close()
	for urows.Next() {
		var it ProductUserAccess
		if err := urows.Scan(&it.UserID, &it.Email, &it.FullName, &it.Role); err != nil {
			return nil, err
		}
		view.Users = append(view.Users, it)
	}
	return view, nil
}

func GetEffectiveAccess(ctx context.Context, db *sql.DB, tenantID, productID, userID uuid.UUID) (string, []EffectiveAccessSource, error) {
	sources := []EffectiveAccessSource{}
	effective := "none"
	var direct sql.NullString
	err := db.QueryRowContext(ctx, `SELECT role FROM product_user_roles WHERE tenant_id=$1 AND product_id=$2 AND user_id=$3`, tenantID, productID, userID).Scan(&direct)
	if err != nil && err != sql.ErrNoRows {
		return "none", nil, err
	}
	if direct.Valid {
		sources = append(sources, EffectiveAccessSource{Type: "direct", Role: direct.String, Detail: "Прямой доступ"})
		effective = maxRole(effective, direct.String)
	}
	rows, err := db.QueryContext(ctx, `SELECT t.id,t.name,ptr.role FROM team_members tm JOIN product_team_roles ptr ON ptr.tenant_id=tm.tenant_id AND ptr.team_id=tm.team_id JOIN teams t ON t.tenant_id=tm.tenant_id AND t.id=tm.team_id WHERE tm.tenant_id=$1 AND tm.user_id=$2 AND ptr.product_id=$3`, tenantID, userID, productID)
	if err != nil {
		return "none", nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var tid uuid.UUID
		var tname string
		var role string
		if err := rows.Scan(&tid, &tname, &role); err != nil {
			return "none", nil, err
		}
		nm := tname
		sources = append(sources, EffectiveAccessSource{Type: "team", TeamID: &tid, TeamName: &nm, Role: role, Detail: "Доступ через команду"})
		effective = maxRole(effective, role)
	}
	return effective, sources, rows.Err()
}

func maxRole(a, b string) string {
	r := map[string]int{"none": 0, "viewer": 1, "engineer": 2, "maintainer": 3}
	if r[b] > r[a] {
		return b
	}
	return a
}
