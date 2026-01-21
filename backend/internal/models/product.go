package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID               uuid.UUID `db:"id"`
	Name             string    `db:"name"`
	Slug             string    `db:"slug"`
	Description      *string   `db:"description"`
	Identifier       *string   `db:"identifier"`
	Version          *string   `db:"version"`
	AssetCriticality *string   `db:"asset_criticality"`
	CreatedAt        time.Time `db:"created_at"`
	UpdatedAt        time.Time `db:"updated_at"`
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
	if p.Identifier != nil {
		if err := validateMaxLen(*p.Identifier, 200, "identifier"); err != nil {
			return err
		}
	}
	if p.Version != nil {
		if err := validateMaxLen(*p.Version, 100, "version"); err != nil {
			return err
		}
	}
	if p.AssetCriticality != nil && *p.AssetCriticality != "" {
		switch *p.AssetCriticality {
		case SeverityLow, SeverityMedium, SeverityHigh, SeverityCritical:
			// ok
		default:
			return fmt.Errorf("asset_criticality must be one of low, medium, high, critical")
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
