package models

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ProductSourceSnapshot struct {
	ID             uuid.UUID  `db:"id"`
	TenantID       *uuid.UUID `db:"tenant_id"`
	ProductID      uuid.UUID  `db:"product_id"`
	ObjectKey      string     `db:"object_key"`
	ArchiveSize    int64      `db:"archive_size"`
	SHA256         *string    `db:"sha256"`
	IdempotencyKey *string    `db:"idempotency_key"`
	CreatedBy      *uuid.UUID `db:"created_by"`
	CreatedAt      time.Time  `db:"created_at"`
	DeletedAt      *time.Time `db:"deleted_at"`
}

func (s *ProductSourceSnapshot) PrepareForInsert() {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now().UTC()
	}
}

func (s *ProductSourceSnapshot) Validate() error {
	if s.TenantID == nil || *s.TenantID == uuid.Nil {
		return fmt.Errorf("tenant_id is required")
	}
	if s.ProductID == uuid.Nil {
		return fmt.Errorf("product_id is required")
	}
	if strings.TrimSpace(s.ObjectKey) == "" {
		return fmt.Errorf("object_key is required")
	}
	if s.ArchiveSize <= 0 {
		return fmt.Errorf("archive_size must be positive")
	}
	return nil
}
