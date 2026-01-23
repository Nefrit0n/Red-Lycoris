package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	ImportJobQueued    = "queued"
	ImportJobRunning   = "running"
	ImportJobSucceeded = "succeeded"
	ImportJobFailed    = "failed"
)

type ImportJob struct {
	ID                uuid.UUID  `db:"id"`
	TenantID          *uuid.UUID `db:"tenant_id"`
	Scanner           string     `db:"scanner"`
	SourceType        *string    `db:"source_type"`
	SourceVersion     *string    `db:"source_version"`
	ProductID         *uuid.UUID `db:"product_id"`
	ProductName       *string    `db:"product_name"`
	ProductVersion    *string    `db:"product_version"`
	ProductIdentifier *string    `db:"product_identifier"`
	Status            string     `db:"status"`
	FindingsTotal     int        `db:"findings_total"`
	FindingsNew       int        `db:"findings_new"`
	DuplicatesTotal   int        `db:"duplicates_total"`
	GateFailed        bool       `db:"gate_failed"`
	Checksum          string     `db:"checksum"`
	ErrorMessage      *string    `db:"error_message"`
	CreatedAt         time.Time  `db:"created_at"`
	StartedAt         *time.Time `db:"started_at"`
	FinishedAt        *time.Time `db:"finished_at"`
	CreatedBy         *uuid.UUID `db:"created_by"`
}

func (j *ImportJob) Validate() error {
	if err := validateRequired(j.Scanner, "scanner"); err != nil {
		return err
	}
	if err := validateMaxLen(j.Scanner, 100, "scanner"); err != nil {
		return err
	}
	if err := validateRequired(j.Checksum, "checksum"); err != nil {
		return err
	}
	switch j.Status {
	case ImportJobQueued, ImportJobRunning, ImportJobSucceeded, ImportJobFailed:
		return nil
	default:
		return fmt.Errorf("status must be one of queued, running, succeeded, failed")
	}
}

func (j *ImportJob) PrepareForInsert() {
	if j.ID == uuid.Nil {
		j.ID = uuid.New()
	}
	if j.CreatedAt.IsZero() {
		j.CreatedAt = time.Now().UTC()
	}
}
