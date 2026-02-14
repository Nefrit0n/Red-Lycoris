package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type SLASettings struct {
	Enabled      bool
	CriticalDays int
	HighDays     int
	MediumDays   int
	LowDays      int
	DueSoonDays  int
}

type ProductSLASettings struct {
	SLASettings
	ProductID       *uuid.UUID
	UpdatedAt       time.Time
	UpdatedByUserID *uuid.UUID
}

var defaultSLASettings = SLASettings{
	Enabled:      true,
	CriticalDays: 7,
	HighDays:     30,
	MediumDays:   90,
	LowDays:      180,
	DueSoonDays:  3,
}

func DefaultSLASettings() SLASettings { return defaultSLASettings }

func GetOrgSLASettings(ctx context.Context, db *sql.DB, tenantID uuid.UUID) (SLASettings, error) {
	row := db.QueryRowContext(ctx, `SELECT enabled, critical_days, high_days, medium_days, low_days, due_soon_days FROM sla_settings WHERE tenant_id = $1 AND product_id IS NULL`, tenantID)
	var cfg SLASettings
	if err := row.Scan(&cfg.Enabled, &cfg.CriticalDays, &cfg.HighDays, &cfg.MediumDays, &cfg.LowDays, &cfg.DueSoonDays); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return defaultSLASettings, nil
		}
		return SLASettings{}, err
	}
	return cfg, nil
}

func UpsertOrgSLASettings(ctx context.Context, db *sql.DB, tenantID uuid.UUID, updatedBy *uuid.UUID, cfg SLASettings) error {
	_, err := db.ExecContext(ctx, `INSERT INTO sla_settings(tenant_id, product_id, enabled, critical_days, high_days, medium_days, low_days, due_soon_days, updated_by_user_id, updated_at)
	VALUES($1, NULL, $2, $3, $4, $5, $6, $7, $8, now())
	ON CONFLICT (tenant_id) WHERE product_id IS NULL
	DO UPDATE SET enabled = EXCLUDED.enabled,
		critical_days = EXCLUDED.critical_days,
		high_days = EXCLUDED.high_days,
		medium_days = EXCLUDED.medium_days,
		low_days = EXCLUDED.low_days,
		due_soon_days = EXCLUDED.due_soon_days,
		updated_by_user_id = EXCLUDED.updated_by_user_id,
		updated_at = now()`, tenantID, cfg.Enabled, cfg.CriticalDays, cfg.HighDays, cfg.MediumDays, cfg.LowDays, cfg.DueSoonDays, anyUUIDPtr(updatedBy))
	return err
}

func GetProductSLAOverride(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) (*ProductSLASettings, error) {
	row := db.QueryRowContext(ctx, `SELECT product_id, enabled, critical_days, high_days, medium_days, low_days, due_soon_days, updated_at, updated_by_user_id
	FROM sla_settings WHERE tenant_id = $1 AND product_id = $2`, tenantID, productID)
	var out ProductSLASettings
	var updatedBy uuid.NullUUID
	if err := row.Scan(&out.ProductID, &out.Enabled, &out.CriticalDays, &out.HighDays, &out.MediumDays, &out.LowDays, &out.DueSoonDays, &out.UpdatedAt, &updatedBy); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if updatedBy.Valid {
		out.UpdatedByUserID = &updatedBy.UUID
	}
	return &out, nil
}

func UpsertProductSLAOverride(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID, updatedBy *uuid.UUID, cfg SLASettings) error {
	_, err := db.ExecContext(ctx, `INSERT INTO sla_settings(tenant_id, product_id, enabled, critical_days, high_days, medium_days, low_days, due_soon_days, updated_by_user_id, updated_at)
	VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
	ON CONFLICT (tenant_id, product_id) WHERE product_id IS NOT NULL
	DO UPDATE SET enabled = EXCLUDED.enabled,
		critical_days = EXCLUDED.critical_days,
		high_days = EXCLUDED.high_days,
		medium_days = EXCLUDED.medium_days,
		low_days = EXCLUDED.low_days,
		due_soon_days = EXCLUDED.due_soon_days,
		updated_by_user_id = EXCLUDED.updated_by_user_id,
		updated_at = now()`, tenantID, productID, cfg.Enabled, cfg.CriticalDays, cfg.HighDays, cfg.MediumDays, cfg.LowDays, cfg.DueSoonDays, anyUUIDPtr(updatedBy))
	return err
}

func DeleteProductSLAOverride(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) error {
	_, err := db.ExecContext(ctx, `DELETE FROM sla_settings WHERE tenant_id = $1 AND product_id = $2`, tenantID, productID)
	return err
}

func GetEffectiveProductSLA(ctx context.Context, db *sql.DB, tenantID, productID uuid.UUID) (SLASettings, *SLASettings, error) {
	org, err := GetOrgSLASettings(ctx, db, tenantID)
	if err != nil {
		return SLASettings{}, nil, err
	}
	override, err := GetProductSLAOverride(ctx, db, tenantID, productID)
	if err != nil {
		return SLASettings{}, nil, err
	}
	if override == nil {
		return org, nil, nil
	}
	cfg := override.SLASettings
	return cfg, &cfg, nil
}

func MustValidateSLASettings(cfg SLASettings) error {
	values := []int{cfg.CriticalDays, cfg.HighDays, cfg.MediumDays, cfg.LowDays, cfg.DueSoonDays}
	for _, value := range values {
		if value < 1 || value > 3650 {
			return fmt.Errorf("range")
		}
	}
	minDays := cfg.CriticalDays
	if cfg.HighDays < minDays {
		minDays = cfg.HighDays
	}
	if cfg.MediumDays < minDays {
		minDays = cfg.MediumDays
	}
	if cfg.LowDays < minDays {
		minDays = cfg.LowDays
	}
	if cfg.DueSoonDays > minDays {
		return fmt.Errorf("due_soon")
	}
	return nil
}
