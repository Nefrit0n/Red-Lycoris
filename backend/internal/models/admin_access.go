package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type OrgRole string

const (
	OrgRoleOwner           OrgRole = "owner"
	OrgRoleAdmin           OrgRole = "admin"
	OrgRoleSecurityManager OrgRole = "security_manager"
	OrgRoleViewer          OrgRole = "viewer"
)

type ProjectRole string

const (
	ProjectRoleMaintainer ProjectRole = "maintainer"
	ProjectRoleEngineer   ProjectRole = "engineer"
	ProjectRoleViewer     ProjectRole = "viewer"
)

func (r ProjectRole) Rank() int {
	switch r {
	case ProjectRoleViewer:
		return 1
	case ProjectRoleEngineer:
		return 2
	case ProjectRoleMaintainer:
		return 3
	default:
		return 0
	}
}

func (r ProjectRole) Validate() error {
	switch r {
	case ProjectRoleMaintainer, ProjectRoleEngineer, ProjectRoleViewer:
		return nil
	default:
		return fmt.Errorf("invalid project role: %s", string(r))
	}
}

type Team struct {
	ID          uuid.UUID `db:"id"`
	TenantID    uuid.UUID `db:"tenant_id"`
	Name        string    `db:"name"`
	Description *string   `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
}

type TeamMember struct {
	TenantID  uuid.UUID `db:"tenant_id"`
	TeamID    uuid.UUID `db:"team_id"`
	UserID    uuid.UUID `db:"user_id"`
	CreatedAt time.Time `db:"created_at"`
}

type ProductTeamRole struct {
	TenantID  uuid.UUID   `db:"tenant_id"`
	ProductID uuid.UUID   `db:"product_id"`
	TeamID    uuid.UUID   `db:"team_id"`
	Role      ProjectRole `db:"role"`
	CreatedAt time.Time   `db:"created_at"`
}

type ProductUserRole struct {
	TenantID  uuid.UUID   `db:"tenant_id"`
	ProductID uuid.UUID   `db:"product_id"`
	UserID    uuid.UUID   `db:"user_id"`
	Role      ProjectRole `db:"role"`
	CreatedAt time.Time   `db:"created_at"`
}
