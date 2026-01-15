package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ScanResult struct {
	ID           uuid.UUID       `db:"id"`
	EngagementID *uuid.UUID      `db:"engagement_id"`
	Scanner      string          `db:"scanner"`
	RawReport    json.RawMessage `db:"raw_report"`
	ProcessedAt  time.Time       `db:"processed_at"`
	CreatedAt    time.Time       `db:"created_at"`
}

func (s *ScanResult) Validate() error {
	if err := validateRequired(s.Scanner, "scanner"); err != nil {
		return err
	}
	if err := validateMaxLen(s.Scanner, 100, "scanner"); err != nil {
		return err
	}
	return nil
}

func (s *ScanResult) PrepareForInsert() {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.ProcessedAt.IsZero() {
		s.ProcessedAt = time.Now().UTC()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now().UTC()
	}
}
