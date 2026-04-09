package domain

import (
	"time"

	"github.com/google/uuid"
)

type ProjectRole int

const (
	RoleViewer       ProjectRole = 0
	RoleTriager      ProjectRole = 1
	RoleProjectAdmin ProjectRole = 2
)

type ProjectMember struct {
	UserID    uuid.UUID   `json:"user_id"`
	Email     string      `json:"email"`
	FullName  string      `json:"full_name"`
	Role      ProjectRole `json:"role"`
	GrantedAt time.Time   `json:"granted_at"`
	GrantedBy *uuid.UUID  `json:"granted_by,omitempty"`
}

type UserProjectRole struct {
	ProjectID   uuid.UUID   `json:"project_id"`
	ProjectName string      `json:"project_name"`
	Role        ProjectRole `json:"role"`
	GrantedAt   time.Time   `json:"granted_at"`
	GrantedBy   *uuid.UUID  `json:"granted_by,omitempty"`
}
