package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	SbomFormatCycloneDX = "cyclonedx"
	SbomFormatSPDX      = "spdx"
	SbomFormatSPDXJSON  = "spdx-json"
)

type Sbom struct {
	ID               uuid.UUID       `db:"id"`
	ProductID        uuid.UUID       `db:"product_id"`
	Format           string          `db:"format"`
	ObjectKey        string          `db:"object_key"`
	SHA256           string          `db:"sha256"`
	OriginalFilename string          `db:"original_filename"`
	SizeBytes        int64           `db:"size_bytes"`
	Metadata         json.RawMessage `db:"metadata"`
	IndexStatus      string          `db:"index_status"`
	IndexedAt        *time.Time      `db:"indexed_at"`
	IndexError       *string         `db:"index_error"`
	ComponentCount   int             `db:"component_count"`
	EdgeCount        int             `db:"edge_count"`
	CreatedAt        time.Time       `db:"created_at"`
}

func (s *Sbom) PrepareForInsert() {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now().UTC()
	}
}

func (s *Sbom) Validate() error {
	if s.ProductID == uuid.Nil {
		return fmt.Errorf("product_id is required")
	}
	if strings.TrimSpace(s.ObjectKey) == "" {
		return fmt.Errorf("object_key is required")
	}
	if strings.TrimSpace(s.SHA256) == "" {
		return fmt.Errorf("sha256 is required")
	}
	if strings.TrimSpace(s.OriginalFilename) == "" {
		return fmt.Errorf("original_filename is required")
	}
	if s.SizeBytes <= 0 {
		return fmt.Errorf("size_bytes must be positive")
	}
	switch s.Format {
	case SbomFormatCycloneDX, SbomFormatSPDX, SbomFormatSPDXJSON:
		return nil
	default:
		return fmt.Errorf("invalid sbom format")
	}
}
