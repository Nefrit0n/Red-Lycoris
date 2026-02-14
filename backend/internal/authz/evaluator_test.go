package authz

import (
	"context"
	"testing"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

type fakeAccessReader struct {
	role models.ProjectRole
}

func (f fakeAccessReader) GetEffectiveProductRole(_ context.Context, _, _, _ uuid.UUID) (models.ProjectRole, error) {
	return f.role, nil
}

func TestPermissionMatrixAndDenyByDefault(t *testing.T) {
	e := NewEvaluator(nil)
	ctx := RequestContext{OrgRole: models.OrgRoleViewer}
	if e.Can(ctx, PermAdminUsersRead) {
		t.Fatalf("viewer should not read users")
	}
	ctx.OrgRole = models.OrgRoleSecurityManager
	if !e.Can(ctx, PermAdminAuditRead) {
		t.Fatalf("security_manager should read audit")
	}
	if e.Can(ctx, PermAdminProjectsWrite) {
		t.Fatalf("security_manager should not write projects")
	}
	if e.Can(ctx, Permission("unknown.permission")) {
		t.Fatalf("unknown permission must be denied")
	}
}

func TestRequireProjectRoleWithMaxRole(t *testing.T) {
	e := NewEvaluator(fakeAccessReader{role: models.ProjectRoleEngineer})
	ctx := RequestContext{UserID: uuid.New(), TenantID: uuid.New(), OrgRole: models.OrgRoleViewer}
	if err := e.RequireProjectRole(context.Background(), ctx, uuid.New(), models.ProjectRoleViewer); err != nil {
		t.Fatalf("expected viewer requirement to pass: %v", err)
	}
	if err := e.RequireProjectRole(context.Background(), ctx, uuid.New(), models.ProjectRoleMaintainer); err == nil {
		t.Fatalf("expected maintainer requirement to fail")
	}
}

func TestOrgAdminBypassesProjectRoleCheck(t *testing.T) {
	e := NewEvaluator(nil)
	ctx := RequestContext{UserID: uuid.New(), TenantID: uuid.New(), OrgRole: models.OrgRoleAdmin}
	if err := e.RequireProjectRole(context.Background(), ctx, uuid.New(), models.ProjectRoleMaintainer); err != nil {
		t.Fatalf("admin should pass project role check: %v", err)
	}
}
