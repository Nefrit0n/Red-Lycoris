package domain

import (
	"time"

	"github.com/google/uuid"
)

type GlobalRole int

const (
	RoleUser  GlobalRole = 0
	RoleAdmin GlobalRole = 1
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	FullName     string     `json:"full_name"`
	IsActive     bool       `json:"is_active"`
	GlobalRole   GlobalRole `json:"global_role"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

func (u *User) IsAdmin() bool {
	return u.GlobalRole == RoleAdmin
}
