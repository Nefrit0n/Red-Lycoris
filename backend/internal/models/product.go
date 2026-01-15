package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID          uuid.UUID `db:"id"`
	Name        string    `db:"name"`
	Slug        string    `db:"slug"`
	Description *string   `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func (p *Product) Validate() error {
	if err := validateRequired(p.Name, "name"); err != nil {
		return err
	}
	if err := validateMinLen(p.Name, 2, "name"); err != nil {
		return err
	}
	if err := validateRequired(p.Slug, "slug"); err != nil {
		return err
	}
	if err := validateSlug(p.Slug); err != nil {
		return err
	}
	if err := validateMaxLen(p.Slug, 100, "slug"); err != nil {
		return err
	}
	if p.Description != nil {
		if err := validateMaxLen(*p.Description, 2000, "description"); err != nil {
			return err
		}
	}
	return nil
}

func (p *Product) PrepareForInsert() {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	if p.UpdatedAt.IsZero() {
		p.UpdatedAt = p.CreatedAt
	}
}

func (p *Product) Touch() {
	p.UpdatedAt = time.Now().UTC()
}

func (p *Product) ValidateID() error {
	if p.ID == uuid.Nil {
		return fmt.Errorf("id is required")
	}
	return nil
}
