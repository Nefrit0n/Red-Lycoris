package api

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

// stubAdminCounter реализует adminCountRepo для тестов.
type stubAdminCounter struct {
	count int
	err   error
}

func (s *stubAdminCounter) CountActiveAdmins(_ context.Context) (int, error) {
	return s.count, s.err
}

func adminUser(id uuid.UUID, isSystem bool) *domain.User {
	return &domain.User{
		ID:              id,
		GlobalRole:      domain.RoleAdmin,
		IsSystemAccount: isSystem,
		Status:          domain.UserStatusActive,
		IsActive:        true,
	}
}

func regularUser(id uuid.UUID) *domain.User {
	return &domain.User{
		ID:         id,
		GlobalRole: domain.RoleUser,
		Status:     domain.UserStatusActive,
		IsActive:   true,
	}
}

func TestCanModifyUser(t *testing.T) {
	actorID := uuid.New()
	targetID := uuid.New()
	sameID := actorID

	tests := []struct {
		name        string
		repo        adminCountRepo
		actorID     uuid.UUID
		target      *domain.User
		action      AdminAction
		wantErr     error
		wantErrCode string
	}{
		// Правило 1: self-modification
		{
			name:    "self deactivate → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: sameID,
			target:  adminUser(sameID, false),
			action:  ActionDeactivate,
			wantErr: errSelfModification,
		},
		{
			name:    "self reset password → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: sameID,
			target:  adminUser(sameID, false),
			action:  ActionResetPassword,
			wantErr: errSelfModification,
		},
		{
			name:    "self delete → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: sameID,
			target:  regularUser(sameID),
			action:  ActionDelete,
			wantErr: errSelfModification,
		},
		{
			name:    "self remove admin role → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: sameID,
			target:  adminUser(sameID, false),
			action:  ActionRemoveRoleAdmin,
			wantErr: errSelfModification,
		},
		{
			name:    "self activate → allowed (не деструктивное)",
			repo:    &stubAdminCounter{count: 5},
			actorID: sameID,
			target:  regularUser(sameID),
			action:  ActionActivate,
			wantErr: nil,
		},

		// Правило 2: system account protection
		{
			name:    "delete system account → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: actorID,
			target:  adminUser(targetID, true),
			action:  ActionDelete,
			wantErr: errSystemAccountProtected,
		},
		{
			name:    "deactivate system account → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: actorID,
			target:  adminUser(targetID, true),
			action:  ActionDeactivate,
			wantErr: errSystemAccountProtected,
		},
		{
			name:    "remove admin from system account → forbidden",
			repo:    &stubAdminCounter{count: 5},
			actorID: actorID,
			target:  adminUser(targetID, true),
			action:  ActionRemoveRoleAdmin,
			wantErr: errSystemAccountProtected,
		},
		{
			name:    "reset password for system account → allowed (не защищено этим правилом)",
			repo:    &stubAdminCounter{count: 5},
			actorID: actorID,
			target:  adminUser(targetID, true),
			action:  ActionResetPassword,
			wantErr: nil,
		},

		// Правило 3: last admin protection
		{
			name:    "deactivate last admin → forbidden",
			repo:    &stubAdminCounter{count: 1},
			actorID: actorID,
			target:  adminUser(targetID, false),
			action:  ActionDeactivate,
			wantErr: errLastAdminProtected,
		},
		{
			name:    "remove admin role from last admin → forbidden",
			repo:    &stubAdminCounter{count: 1},
			actorID: actorID,
			target:  adminUser(targetID, false),
			action:  ActionRemoveRoleAdmin,
			wantErr: errLastAdminProtected,
		},
		{
			name:    "deactivate admin when 2 active admins → allowed",
			repo:    &stubAdminCounter{count: 2},
			actorID: actorID,
			target:  adminUser(targetID, false),
			action:  ActionDeactivate,
			wantErr: nil,
		},
		{
			name:    "deactivate regular user (not admin) → allowed regardless of admin count",
			repo:    &stubAdminCounter{count: 1},
			actorID: actorID,
			target:  regularUser(targetID),
			action:  ActionDeactivate,
			wantErr: nil,
		},

		// Ошибка от репозитория
		{
			name:    "repo error propagates",
			repo:    &stubAdminCounter{count: 0, err: errors.New("db down")},
			actorID: actorID,
			target:  adminUser(targetID, false),
			action:  ActionDeactivate,
			wantErr: nil, // не guardError, просто wrapped error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := canModifyUser(context.Background(), tt.repo, tt.actorID, tt.target, tt.action)

			if tt.name == "repo error propagates" {
				// Ожидаем ненулевую ошибку, не guardError
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if errors.As(err, new(*guardError)) {
					t.Fatalf("expected wrapped error, got guardError: %v", err)
				}
				return
			}

			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("want %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestSessionRevokeReason(t *testing.T) {
	tests := []struct {
		action AdminAction
		want   string
	}{
		{ActionDeactivate, "deactivated"},
		{ActionResetPassword, "password_changed"},
		{ActionRemoveRoleAdmin, "role_changed"},
		{ActionDelete, "admin_revoke"},
		{ActionResetMFA, "admin_revoke"},
	}
	for _, tt := range tests {
		got := sessionRevokeReason(tt.action)
		if got != tt.want {
			t.Errorf("sessionRevokeReason(%s) = %q, want %q", tt.action, got, tt.want)
		}
	}
}
