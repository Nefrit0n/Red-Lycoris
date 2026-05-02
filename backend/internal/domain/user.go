package domain

import (
	"net"
	"time"

	"github.com/google/uuid"
)

type GlobalRole int

const (
	RoleUser  GlobalRole = 0
	RoleAdmin GlobalRole = 1
)

// UserStatus отражает состояние учётной записи.
// pending = создан, ещё не сменил временный пароль.
// disabled = деактивирован администратором.
type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusPending  UserStatus = "pending"
	UserStatusDisabled UserStatus = "disabled"
)

type User struct {
	ID              uuid.UUID  `json:"id"`
	Email           string     `json:"email"`
	PasswordHash    string     `json:"-"`
	FullName        string     `json:"full_name"`
	IsActive        bool       `json:"is_active"`
	GlobalRole      GlobalRole `json:"global_role"`
	Status          UserStatus `json:"status"`
	IsSystemAccount bool       `json:"is_system_account"`
	CreatedByUserID *uuid.UUID `json:"created_by_user_id,omitempty"`
	LastLoginIP     net.IP     `json:"last_login_ip,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	LastLoginAt           *time.Time `json:"last_login_at,omitempty"`
	MustChangePassword    bool       `json:"must_change_password,omitempty"`
}

func (u *User) IsAdmin() bool {
	return u.GlobalRole == RoleAdmin
}
