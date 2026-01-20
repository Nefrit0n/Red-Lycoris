// Package importing provides a unified service for importing security findings
// with deduplication logic. This eliminates code duplication between scan_upload
// handler and analysis_worker.
package importing

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"time"

	"lotus-warden/backend/internal/dedup"
	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/parser"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
)

// ImportResult contains the results of a finding import operation
type ImportResult struct {
	ImportJobID uuid.UUID
	ScanID      uuid.UUID
	Total       int
	New         int
	Duplicates  int
}

// ImportParams contains parameters for importing findings
type ImportParams struct {
	Scanner      string
	Report       []byte
	ProductID    *uuid.UUID
	EngagementID *uuid.UUID
	CreatedBy    *uuid.UUID
	Callbacks    *ImportCallbacks
}

// ImportCallbacks contains optional callback functions for import events
type ImportCallbacks struct {
	// OnFindingCreated is called when a new finding is created
	OnFindingCreated func(finding *models.Finding)
	// OnDuplicateCreated is called when a duplicate finding is created
	OnDuplicateCreated func(finding *models.Finding, masterID uuid.UUID)
	// OnImportStarted is called when import job starts
	OnImportStarted func(jobID uuid.UUID)
	// OnImportFailed is called when import job fails
	OnImportFailed func(jobID uuid.UUID, err error)
	// OnImportSucceeded is called when import job succeeds
	OnImportSucceeded func(jobID uuid.UUID, total, new, duplicates int)
}

// ImportFindings parses a security scan report and imports findings with deduplication.
// This is the unified implementation used by both scan_upload handler and analysis_worker.
func ImportFindings(ctx context.Context, db *sql.DB, params ImportParams) (*ImportResult, error) {
	checksum := ComputeChecksum(params.Report)

	importJob := &models.ImportJob{
		Scanner:   params.Scanner,
		Status:    models.ImportJobQueued,
		Checksum:  checksum,
		CreatedBy: params.CreatedBy,
	}
	if params.ProductID != nil {
		importJob.ProductID = params.ProductID
	}
	if err := storage.CreateImportJob(ctx, db, importJob); err != nil {
		return nil, err
	}

	startedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobRunning, &startedAt, nil, nil); err != nil {
		return nil, err
	}
	if params.Callbacks != nil && params.Callbacks.OnImportStarted != nil {
		params.Callbacks.OnImportStarted(importJob.ID)
	}

	findings, err := parser.ParseReport(params.Scanner, params.Report)
	if err != nil {
		finishedAt := time.Now().UTC()
		errMsg := err.Error()
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		if params.Callbacks != nil && params.Callbacks.OnImportFailed != nil {
			params.Callbacks.OnImportFailed(importJob.ID, err)
		}
		return nil, err
	}

	scan := &models.ScanResult{
		EngagementID: params.EngagementID,
		ProductID:    params.ProductID,
		UploaderID:   params.CreatedBy,
		ImportJobID:  &importJob.ID,
		Scanner:      params.Scanner,
		RawReport:    params.Report,
	}
	if err := storage.CreateScanResult(ctx, db, scan); err != nil {
		finishedAt := time.Now().UTC()
		errMsg := "failed to store scan result"
		_ = storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobFailed, nil, &finishedAt, &errMsg)
		return nil, err
	}

	duplicates := 0
	createdFindings := 0
	seenAt := time.Now().UTC()

	for _, finding := range findings {
		result, err := processFinding(ctx, db, processFindingParams{
			finding:     finding,
			scanner:     params.Scanner,
			productID:   params.ProductID,
			scanID:      scan.ID,
			importJobID: importJob.ID,
			seenAt:      seenAt,
		})
		if err != nil {
			return nil, err
		}
		if result.isNew {
			createdFindings++
			if params.Callbacks != nil && params.Callbacks.OnFindingCreated != nil {
				params.Callbacks.OnFindingCreated(result.finding)
			}
		} else {
			duplicates++
			if params.Callbacks != nil && params.Callbacks.OnDuplicateCreated != nil {
				params.Callbacks.OnDuplicateCreated(result.finding, result.masterID)
			}
		}

		if len(finding.Evidence) > 0 {
			targetID := result.finding.ID
			if !result.isNew {
				targetID = result.masterID
			}
			if err := createFindingImportEvent(ctx, db, targetID, finding.Evidence); err != nil {
				return nil, err
			}
		}
	}

	if params.ProductID != nil {
		_ = storage.UpdateImportJobProductID(ctx, db, importJob.ID, *params.ProductID)
	}

	if err := storage.UpdateImportJobStats(ctx, db, importJob.ID, len(findings), createdFindings, duplicates); err != nil {
		return nil, err
	}

	finishedAt := time.Now().UTC()
	if err := storage.UpdateImportJobStatus(ctx, db, importJob.ID, models.ImportJobSucceeded, nil, &finishedAt, nil); err != nil {
		return nil, err
	}
	if params.Callbacks != nil && params.Callbacks.OnImportSucceeded != nil {
		params.Callbacks.OnImportSucceeded(importJob.ID, len(findings), createdFindings, duplicates)
	}

	return &ImportResult{
		ImportJobID: importJob.ID,
		ScanID:      scan.ID,
		Total:       len(findings),
		New:         createdFindings,
		Duplicates:  duplicates,
	}, nil
}

type processFindingParams struct {
	finding     parser.Finding
	scanner     string
	productID   *uuid.UUID
	scanID      uuid.UUID
	importJobID uuid.UUID
	seenAt      time.Time
}

type processFindingResult struct {
	isNew    bool
	finding  *models.Finding
	masterID uuid.UUID
}

// processFinding handles a single finding with deduplication logic.
// Returns result with finding details and whether it's new or duplicate.
func processFinding(ctx context.Context, db *sql.DB, params processFindingParams) (*processFindingResult, error) {
	fingerprint := dedup.ComputeFingerprint(params.scanner, params.finding)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}

	masterID, repeatCount, found, err := findExistingMaster(ctx, tx, fingerprint, params.productID)
	if err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if !found {
		// Create new finding
		model := &models.Finding{
			ScanResultID: &params.scanID,
			ProductID:    params.productID,
			Fingerprint:  fingerprint,
			Title:        params.finding.Title,
			Description:  params.finding.Description,
			Severity:     params.finding.Severity,
			Status:       models.StatusNew,
			ImportJobID:  &params.importJobID,
			FirstSeenAt:  params.seenAt,
			LastSeenAt:   params.seenAt,
			RepeatCount:  0,
		}
		if err := storage.CreateFindingTx(ctx, tx, model); err != nil {
			_ = tx.Rollback()
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return &processFindingResult{isNew: true, finding: model}, nil
	}

	// Create duplicate finding
	duplicate := &models.Finding{
		ScanResultID: &params.scanID,
		ProductID:    params.productID,
		Fingerprint:  fingerprint,
		Title:        params.finding.Title,
		Description:  params.finding.Description,
		Severity:     params.finding.Severity,
		Status:       models.StatusDuplicate,
		DuplicateID:  &masterID,
		ImportJobID:  &params.importJobID,
		FirstSeenAt:  params.seenAt,
		LastSeenAt:   params.seenAt,
		RepeatCount:  0,
	}
	if err := storage.CreateFindingTx(ctx, tx, duplicate); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	// Update master's repeat count and last_seen_at
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE findings
		 SET repeat_count = $1,
		     last_seen_at = $2,
		     updated_at = $2
		 WHERE id = $3`,
		repeatCount+1,
		params.seenAt,
		masterID,
	); err != nil {
		_ = tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &processFindingResult{isNew: false, finding: duplicate, masterID: masterID}, nil
}

// findExistingMaster looks for an existing master finding with the same fingerprint.
// Returns the master ID, repeat count, whether found, and any error.
func findExistingMaster(ctx context.Context, tx *sql.Tx, fingerprint string, productID *uuid.UUID) (uuid.UUID, int, bool, error) {
	var masterID uuid.UUID
	var repeatCount int

	query := `SELECT id, repeat_count
		 FROM findings
		 WHERE fingerprint = $1
		   AND duplicate_id IS NULL
		   AND deleted_at IS NULL`
	args := []interface{}{fingerprint}

	if productID != nil {
		query += " AND product_id = $2"
		args = append(args, *productID)
	} else {
		query += " AND product_id IS NULL"
	}
	query += " LIMIT 1 FOR UPDATE"

	err := tx.QueryRowContext(ctx, query, args...).Scan(&masterID, &repeatCount)
	if err != nil {
		if err == sql.ErrNoRows {
			return uuid.UUID{}, 0, false, nil
		}
		return uuid.UUID{}, 0, false, err
	}
	return masterID, repeatCount, true, nil
}

// ComputeChecksum calculates SHA256 checksum of data
func ComputeChecksum(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// NullUUIDPtr converts uuid.NullUUID to *uuid.UUID
func NullUUIDPtr(value uuid.NullUUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	return &value.UUID
}

func createFindingImportEvent(ctx context.Context, db *sql.DB, findingID uuid.UUID, evidence map[string]any) error {
	if len(evidence) == 0 {
		return nil
	}
	payload, err := json.Marshal(evidence)
	if err != nil {
		return err
	}
	event := &models.FindingEvent{
		FindingID: findingID,
		EventType: "finding.imported",
		Payload:   payload,
	}
	return storage.CreateFindingEvent(ctx, db, event)
}
