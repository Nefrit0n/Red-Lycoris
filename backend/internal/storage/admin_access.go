package storage

import (
	"context"
	"database/sql"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

func GetUserOrgRole(ctx context.Context, db *sql.DB, userID uuid.UUID) (models.OrgRole, error) {
	rows, err := GetUserRoles(ctx, db, userID)
	if err != nil {
		return models.OrgRoleViewer, err
	}
	set := map[string]struct{}{}
	for _, role := range rows {
		set[role] = struct{}{}
	}
	if _, ok := set[string(models.OrgRoleOwner)]; ok {
		return models.OrgRoleOwner, nil
	}
	if _, ok := set[string(models.OrgRoleAdmin)]; ok {
		return models.OrgRoleAdmin, nil
	}
	if _, ok := set[string(models.OrgRoleSecurityManager)]; ok {
		return models.OrgRoleSecurityManager, nil
	}
	return models.OrgRoleViewer, nil
}

func GetEffectiveProductRole(ctx context.Context, db *sql.DB, tenantID, userID, productID uuid.UUID) (models.ProjectRole, error) {
	var direct sql.NullString
	err := db.QueryRowContext(ctx, `
		SELECT role
		FROM product_user_roles
		WHERE tenant_id = $1 AND user_id = $2 AND product_id = $3
	`, tenantID, userID, productID).Scan(&direct)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	var viaTeam sql.NullString
	err = db.QueryRowContext(ctx, `
		SELECT ptr.role
		FROM team_members tm
		JOIN product_team_roles ptr
		  ON ptr.tenant_id = tm.tenant_id
		 AND ptr.team_id = tm.team_id
		WHERE tm.tenant_id = $1
		  AND tm.user_id = $2
		  AND ptr.product_id = $3
		ORDER BY CASE ptr.role
		  WHEN 'maintainer' THEN 3
		  WHEN 'engineer' THEN 2
		  WHEN 'viewer' THEN 1
		  ELSE 0
		END DESC
		LIMIT 1
	`, tenantID, userID, productID).Scan(&viaTeam)
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	maxRole := models.ProjectRole("")
	if direct.Valid {
		maxRole = models.ProjectRole(direct.String)
	}
	if viaTeam.Valid {
		teamRole := models.ProjectRole(viaTeam.String)
		if teamRole.Rank() > maxRole.Rank() {
			maxRole = teamRole
		}
	}
	return maxRole, nil
}

func ListTeamMembers(ctx context.Context, db *sql.DB, tenantID, teamID uuid.UUID) ([]models.TeamMember, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tenant_id, team_id, user_id, created_at
		FROM team_members
		WHERE tenant_id = $1 AND team_id = $2
		ORDER BY created_at DESC
	`, tenantID, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.TeamMember{}
	for rows.Next() {
		var item models.TeamMember
		if err := rows.Scan(&item.TenantID, &item.TeamID, &item.UserID, &item.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func ListProductTeamRoles(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) ([]models.ProductTeamRole, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tenant_id, product_id, team_id, role, created_at
		FROM product_team_roles
		WHERE tenant_id = $1 AND product_id = $2
		ORDER BY created_at DESC
	`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ProductTeamRole{}
	for rows.Next() {
		var item models.ProductTeamRole
		if err := rows.Scan(&item.TenantID, &item.ProductID, &item.TeamID, &item.Role, &item.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func ListProductUserRoles(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) ([]models.ProductUserRole, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tenant_id, product_id, user_id, role, created_at
		FROM product_user_roles
		WHERE tenant_id = $1 AND product_id = $2
		ORDER BY created_at DESC
	`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []models.ProductUserRole{}
	for rows.Next() {
		var item models.ProductUserRole
		if err := rows.Scan(&item.TenantID, &item.ProductID, &item.UserID, &item.Role, &item.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
