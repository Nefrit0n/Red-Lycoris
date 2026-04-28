package domain

import (
	"time"

	"github.com/google/uuid"
)

type AccessLevel string

const (
	AccessRead  AccessLevel = "read"
	AccessWrite AccessLevel = "write"
	AccessAdmin AccessLevel = "admin"
)

type EffectiveAccessSource struct {
	Kind         string      `json:"kind"`
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	ColorKey     *string     `json:"color_key,omitempty"`
	GrantedLevel AccessLevel `json:"granted_level"`
}

type EffectiveProjectAccess struct {
	ProjectID          string                  `json:"project_id"`
	ProjectName        string                  `json:"project_name"`
	Level              *AccessLevel            `json:"level"`
	Sources            []EffectiveAccessSource `json:"sources"`
	IsPersonalOverride bool                    `json:"is_personal_override"`
}

type AdminGroup struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	ColorKey      string    `json:"color_key"`
	Source        string    `json:"source"`
	ExternalID    *string   `json:"external_id,omitempty"`
	MembersCount  int       `json:"members_count"`
	ProjectsCount int       `json:"projects_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	CreatedBy     *string   `json:"created_by,omitempty"`
}

type GroupMember struct {
	UserID      uuid.UUID  `json:"user_id"`
	Email       string     `json:"email"`
	DisplayName string     `json:"display_name"`
	Status      string     `json:"status"`
	AddedAt     time.Time  `json:"added_at"`
	AddedBy     *uuid.UUID `json:"added_by_user_id,omitempty"`
}

type GroupProjectAccess struct {
	ProjectID   uuid.UUID   `json:"project_id"`
	ProjectName string      `json:"project_name"`
	Level       AccessLevel `json:"level"`
	GrantedAt   time.Time   `json:"granted_at"`
}

type RolePermission struct {
	Key         string `json:"key"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
	Description string `json:"description"`
}

type AdminRole struct {
	ID          uuid.UUID        `json:"id"`
	Key         string           `json:"key"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	UsersCount  int              `json:"users_count"`
	Permissions []RolePermission `json:"permissions"`
}

type AdminUserSession struct {
	ID         uuid.UUID `json:"id"`
	UserAgent  string    `json:"user_agent"`
	IP         string    `json:"ip"`
	IssuedAt   time.Time `json:"issued_at"`
	LastActive time.Time `json:"last_active"`
	ExpiresAt  time.Time `json:"expires_at"`
}
