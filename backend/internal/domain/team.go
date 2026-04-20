package domain

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Team struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (t *Team) Validate() error {
	if strings.TrimSpace(t.Name) == "" {
		return errors.New("team name is required")
	}
	if len(t.Name) > 128 {
		return errors.New("team name must be 128 characters or less")
	}
	return nil
}
