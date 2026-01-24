package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/metrics"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const (
	riskSchedulerBatchSize = 1000
	riskSchedulerSleepMin  = 100 * time.Millisecond
	riskSchedulerSleepMax  = 250 * time.Millisecond
)

var schedulerRand = rand.New(rand.NewSource(time.Now().UnixNano()))
var schedulerRandMu sync.Mutex

func handleIntelRefreshMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, publisher *events.Publisher, subject string) error {
	updatedAt, source, err := parseIntelRefreshPayload(msg.Data, subject)
	if err != nil {
		return permanent(err)
	}
	if updatedAt.IsZero() {
		updatedAt = time.Now().UTC()
	}

	if publisher == nil {
		return nil
	}

	tenants, err := storage.ListTenantIDs(ctx, db)
	if err != nil {
		return err
	}

	for _, tenantID := range tenants {
		cursor, err := storage.GetRiskRecomputeCursor(ctx, db, tenantID, source)
		if err != nil {
			return err
		}
		if !updatedAt.After(cursor) {
			continue
		}

		lastID := uuid.Nil
		for {
			findingIDs, err := storage.ListAffectedFindingsByIntel(ctx, db, tenantID, cursor, updatedAt, lastID, riskSchedulerBatchSize)
			if err != nil {
				return err
			}
			if len(findingIDs) == 0 {
				break
			}
			if err := publishRiskRecomputeBatch(ctx, publisher, findingIDs, tenantID, source, "", updatedAt); err != nil {
				return err
			}
			lastID = findingIDs[len(findingIDs)-1]
			if len(findingIDs) < riskSchedulerBatchSize {
				break
			}
			jitterSleep()
		}

		if err := storage.UpsertRiskRecomputeCursor(ctx, db, tenantID, source, updatedAt); err != nil {
			return err
		}
	}

	return nil
}

func handleAssetContextMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, publisher *events.Publisher) error {
	var payload events.AssetContextUpdatedEvent
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid payload: %w", err))
	}
	if payload.ProductID == "" || payload.TenantID == "" {
		return permanent(fmt.Errorf("missing product_id or tenant_id"))
	}
	productID, err := uuid.Parse(payload.ProductID)
	if err != nil {
		return permanent(fmt.Errorf("invalid product_id: %w", err))
	}
	tenantID, err := uuid.Parse(payload.TenantID)
	if err != nil {
		return permanent(fmt.Errorf("invalid tenant_id: %w", err))
	}
	updatedAt := payload.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = time.Now().UTC()
	}

	if publisher == nil {
		return nil
	}

	lastID := uuid.Nil
	for {
		findingIDs, err := storage.ListAffectedFindingsByProduct(ctx, db, tenantID, productID, lastID, riskSchedulerBatchSize)
		if err != nil {
			return err
		}
		if len(findingIDs) == 0 {
			break
		}
		if err := publishRiskRecomputeBatch(ctx, publisher, findingIDs, tenantID, "asset_context", "", updatedAt); err != nil {
			return err
		}
		lastID = findingIDs[len(findingIDs)-1]
		if len(findingIDs) < riskSchedulerBatchSize {
			break
		}
		jitterSleep()
	}

	return nil
}

func handleRiskModelActivatedMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, publisher *events.Publisher) error {
	var payload events.RiskModelActivatedEvent
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid payload: %w", err))
	}
	if payload.ModelVersion == "" {
		return permanent(fmt.Errorf("missing model_version"))
	}
	activatedAt := payload.ActivatedAt
	if activatedAt.IsZero() {
		activatedAt = time.Now().UTC()
	}

	if publisher == nil {
		return nil
	}

	var tenantIDs []uuid.UUID
	if payload.TenantID != nil && *payload.TenantID != "" {
		tenantID, err := uuid.Parse(*payload.TenantID)
		if err != nil {
			return permanent(fmt.Errorf("invalid tenant_id: %w", err))
		}
		tenantIDs = []uuid.UUID{tenantID}
	} else {
		ids, err := storage.ListTenantIDs(ctx, db)
		if err != nil {
			return err
		}
		tenantIDs = ids
	}

	for _, tenantID := range tenantIDs {
		lockKey := fmt.Sprintf("%s:%s", tenantID.String(), payload.ModelVersion)
		locked, err := storage.TryRiskRescoreLock(ctx, db, lockKey)
		if err != nil {
			return err
		}
		if !locked {
			log.Printf("[risk-scheduler] rescore already running tenant=%s model=%s", tenantID, payload.ModelVersion)
			continue
		}
		err = runRiskModelRescore(ctx, db, publisher, tenantID, payload.ModelVersion, activatedAt)
		_ = storage.ReleaseRiskRescoreLock(ctx, db, lockKey)
		if err != nil {
			return err
		}
	}

	return nil
}

func runRiskModelRescore(ctx context.Context, db *sql.DB, publisher *events.Publisher, tenantID uuid.UUID, modelVersion string, activatedAt time.Time) error {
	startedAt := time.Now().UTC()
	job, err := storage.GetRunningRiskRescoreJob(ctx, db, &tenantID, modelVersion)
	if err != nil {
		return err
	}
	if job == nil {
		job, err = storage.CreateRiskRescoreJob(ctx, db, &tenantID, modelVersion, startedAt)
		if err != nil {
			return err
		}
		log.Printf("[risk-scheduler] rescore job started job_id=%s tenant=%s model=%s", job.JobID, tenantID, modelVersion)
	} else {
		log.Printf("[risk-scheduler] rescore job resumed job_id=%s tenant=%s model=%s", job.JobID, tenantID, modelVersion)
	}

	stats := job.Stats
	lastID := uuid.Nil
	if job.CursorLastFinding != nil {
		lastID = *job.CursorLastFinding
	}

	for {
		findingIDs, err := storage.ListFindingsForRescore(ctx, db, tenantID, lastID, riskSchedulerBatchSize)
		if err != nil {
			stats.Errors++
			_ = storage.UpdateRiskRescoreJobStatus(ctx, db, job.JobID, "failed", nil, stats)
			return err
		}
		if len(findingIDs) == 0 {
			break
		}
		if err := publishRiskRecomputeBatch(ctx, publisher, findingIDs, tenantID, "model_change", modelVersion, activatedAt); err != nil {
			stats.Errors++
			_ = storage.UpdateRiskRescoreJobStatus(ctx, db, job.JobID, "failed", nil, stats)
			return err
		}
		stats.Processed += len(findingIDs)
		stats.Enqueued += len(findingIDs)
		lastID = findingIDs[len(findingIDs)-1]
		if err := storage.UpdateRiskRescoreJobProgress(ctx, db, job.JobID, &lastID, stats); err != nil {
			return err
		}
		jitterSleep()
		if len(findingIDs) < riskSchedulerBatchSize {
			break
		}
	}

	finishedAt := time.Now().UTC()
	if err := storage.UpdateRiskRescoreJobStatus(ctx, db, job.JobID, "done", &finishedAt, stats); err != nil {
		return err
	}
	log.Printf("[risk-scheduler] rescore job done job_id=%s tenant=%s model=%s processed=%d enqueued=%d", job.JobID, tenantID, modelVersion, stats.Processed, stats.Enqueued)
	return nil
}

func parseIntelRefreshPayload(data []byte, subject string) (time.Time, string, error) {
	switch subject {
	case events.IntelEPSSRefreshedSubject:
		var payload events.IntelEPSSRefreshedEvent
		if err := json.Unmarshal(data, &payload); err != nil {
			return time.Time{}, "", fmt.Errorf("invalid payload: %w", err)
		}
		return payload.UpdatedAt, "intel_epss", nil
	case events.IntelKEVRefreshedSubject:
		var payload events.IntelKEVRefreshedEvent
		if err := json.Unmarshal(data, &payload); err != nil {
			return time.Time{}, "", fmt.Errorf("invalid payload: %w", err)
		}
		return payload.UpdatedAt, "intel_kev", nil
	case events.IntelNVDRefreshedSubject:
		var payload events.IntelNVDRefreshedEvent
		if err := json.Unmarshal(data, &payload); err != nil {
			return time.Time{}, "", fmt.Errorf("invalid payload: %w", err)
		}
		return payload.UpdatedAt, "intel_nvd", nil
	default:
		return time.Time{}, "", fmt.Errorf("unsupported subject: %s", subject)
	}
}

func publishRiskRecomputeBatch(ctx context.Context, publisher *events.Publisher, findingIDs []uuid.UUID, tenantID uuid.UUID, source string, cause string, causeAt time.Time) error {
	if publisher == nil {
		return nil
	}
	for _, findingID := range findingIDs {
		msgID := riskRecomputeMsgID(findingID, source, cause, causeAt)
		payload := events.RiskRecomputeRequest{
			TenantID:  stringPointer(tenantID.String()),
			FindingID: findingID.String(),
			Source:    source,
			Cause:     cause,
		}
		if err := publisher.PublishJSONWithMsgID(ctx, events.RiskRecomputeRequestedSubject, msgID, payload); err != nil {
			log.Printf("[risk-scheduler] publish recompute failed for %s: %v", findingID, err)
			return err
		}
	}
	causeLabel := source
	if cause != "" {
		causeLabel = fmt.Sprintf("%s:%s", source, cause)
	}
	metrics.RecordRiskSchedulerEnqueued(causeLabel, len(findingIDs))
	return nil
}

func riskRecomputeMsgID(findingID uuid.UUID, source string, cause string, causeAt time.Time) string {
	stamp := causeAt.UTC().Format(time.RFC3339Nano)
	if cause == "" {
		return fmt.Sprintf("risk:%s:%s:%s", findingID.String(), source, stamp)
	}
	return fmt.Sprintf("risk:%s:%s:%s:%s", findingID.String(), source, cause, stamp)
}

func jitterSleep() {
	schedulerRandMu.Lock()
	defer schedulerRandMu.Unlock()
	if riskSchedulerSleepMax <= 0 || riskSchedulerSleepMax <= riskSchedulerSleepMin {
		time.Sleep(riskSchedulerSleepMin)
		return
	}
	delta := riskSchedulerSleepMax - riskSchedulerSleepMin
	sleep := riskSchedulerSleepMin + time.Duration(schedulerRand.Int63n(int64(delta)))
	time.Sleep(sleep)
}

func stringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
