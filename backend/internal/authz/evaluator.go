package authz

import (
	"context"
	"errors"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

var ErrForbidden = errors.New("forbidden")

type RequestContext struct {
	UserID   uuid.UUID
	TenantID uuid.UUID
	OrgRole  models.OrgRole
}

type AccessReader interface {
	GetEffectiveProductRole(ctx context.Context, tenantID, userID, productID uuid.UUID) (models.ProjectRole, error)
}

type Evaluator struct {
	accessReader AccessReader
}

func NewEvaluator(accessReader AccessReader) *Evaluator {
	return &Evaluator{accessReader: accessReader}
}

var orgPermissionMatrix = map[Permission]map[models.OrgRole]struct{}{
	PermAdminUsersRead: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {}, models.OrgRoleSecurityManager: {},
	},
	PermAdminUsersInvite: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminUsersUpdateRole: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminUsersDeactivate: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminTeamsRead: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {}, models.OrgRoleSecurityManager: {},
	},
	PermAdminTeamsWrite: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminProjectsRead: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {}, models.OrgRoleSecurityManager: {},
	},
	PermAdminProjectsWrite: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminPoliciesRead: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {}, models.OrgRoleSecurityManager: {},
	},
	PermAdminPoliciesWrite: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {},
	},
	PermAdminAuditRead: {
		models.OrgRoleOwner: {}, models.OrgRoleAdmin: {}, models.OrgRoleSecurityManager: {},
	},
}

func (e *Evaluator) Can(ctx RequestContext, permission Permission) bool {
	allowedRoles, ok := orgPermissionMatrix[permission]
	if !ok {
		return false
	}
	_, ok = allowedRoles[ctx.OrgRole]
	return ok
}

func (e *Evaluator) Require(ctx RequestContext, permission Permission) error {
	if !e.Can(ctx, permission) {
		return ErrForbidden
	}
	return nil
}

func (e *Evaluator) RequireProjectRole(ctx context.Context, requestCtx RequestContext, productID uuid.UUID, minRole models.ProjectRole) error {
	if requestCtx.TenantID == uuid.Nil || requestCtx.UserID == uuid.Nil {
		return ErrForbidden
	}
	if requestCtx.OrgRole == models.OrgRoleOwner || requestCtx.OrgRole == models.OrgRoleAdmin {
		return nil
	}

	if e.accessReader == nil {
		return ErrForbidden
	}
	effectiveRole, err := e.accessReader.GetEffectiveProductRole(ctx, requestCtx.TenantID, requestCtx.UserID, productID)
	if err != nil {
		return err
	}
	if effectiveRole.Rank() < minRole.Rank() {
		return ErrForbidden
	}
	return nil
}
