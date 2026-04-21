package domain

import (
	"time"

	"github.com/google/uuid"
)

type APIToken struct {
	ID              uuid.UUID  `json:"id"`
	ProjectID       uuid.UUID  `json:"project_id"`
	Name            string     `json:"name"`
	Prefix          string     `json:"prefix"`
	TokenHash       string     `json:"-"`
	Scopes          []string   `json:"scopes"`
	CreatedByUserID uuid.UUID  `json:"created_by_user_id"`
	CreatedByEmail  string     `json:"created_by_email,omitempty"`
	LastUsedAt      *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	RevokedAt       *time.Time `json:"revoked_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}
