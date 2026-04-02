package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (p *Project) Validate() error {
	if p.Name == "" {
		return errors.New("name is required")
	}
	if len(p.Name) > 255 {
		return errors.New("name must be 255 characters or less")
	}
	return nil
}
