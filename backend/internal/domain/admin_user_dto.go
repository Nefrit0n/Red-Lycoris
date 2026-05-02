package domain

import (
	"time"

	"github.com/google/uuid"
)

// AdminUserResponse is the rich DTO returned by GET /api/v1/admin/users v2.
type AdminUserResponse struct {
	ID                 uuid.UUID  `json:"id"`
	Email              string     `json:"email"`
	DisplayName        string     `json:"display_name"`
	Status             string     `json:"status"`
	IsSystemAccount    bool       `json:"is_system_account"`
	Role               RoleRef    `json:"role"`
	Groups             []GroupRef `json:"groups"`
	MFAEnabled         bool       `json:"mfa_enabled"`
	IdentityKind       string     `json:"identity_kind"`
	LastLoginAt        *time.Time `json:"last_login_at"`
	LastLoginIP        *string    `json:"last_login_ip,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	MustChangePassword bool       `json:"must_change_password"`
}

type RoleRef struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type GroupRef struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	ColorKey string    `json:"color_key"`
}

type GroupSummary struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	ColorKey    string    `json:"color_key"`
	Description string    `json:"description,omitempty"`
}

type UserListFilter struct {
	Q        string
	Roles    []string
	Statuses []string
	GroupID  *uuid.UUID
	MFA      *bool
	Source   string
	Dormant  bool
	Sort     string
	Cursor   string
	Limit    int
}
