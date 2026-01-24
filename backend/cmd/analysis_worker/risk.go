package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/metrics"
	"lotus-warden/backend/internal/risk"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

func handleRiskMessage(ctx context.Context, msg *nats.Msg, db *sql.DB) error {
	var payload riskRecomputeMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return permanent(fmt.Errorf("invalid payload: %w", err))
	}
	if payload.FindingID == "" {
		return permanent(fmt.Errorf("missing finding_id"))
	}
	findingID, err := uuid.Parse(payload.FindingID)
	if err != nil {
		return permanent(fmt.Errorf("invalid finding_id: %w", err))
	}

	riskContext, err := storage.GetFindingRiskContext(ctx, db, findingID)
	if err != nil {
		return err
	}
	if riskContext == nil {
		return permanent(fmt.Errorf("finding not found: %s", findingID))
	}

	calculator := risk.NewCalculator(risk.DefaultModelV1())
	computedAt := time.Now().UTC()

	firstSeen := time.Time{}
	if riskContext.FirstSeenAt.Valid {
		firstSeen = riskContext.FirstSeenAt.Time
	}
	lastSeen := time.Time{}
	if riskContext.LastSeenAt.Valid {
		lastSeen = riskContext.LastSeenAt.Time
	}

	result, err := calculator.Compute(risk.RiskContext{
		Severity:         riskContext.Severity,
		Status:           riskContext.Status,
		Category:         riskContext.Category,
		Identifiers:      riskContext.Identifiers,
		AssetCriticality: riskContext.AssetCriticality,
		Environment:      riskContext.Environment,
		InternetExposed:  riskContext.InternetExposed,
		CVSSScore:        riskContext.CVSSScore,
		EPSSScore:        riskContext.EPSSScore,
		KEV:              riskContext.KEV,
		FirstSeenAt:      firstSeen,
		LastSeenAt:       lastSeen,
	})
	if err != nil {
		return err
	}

	factors, err := json.Marshal(result.Factors)
	if err != nil {
		return err
	}

	source := payload.Source
	if source == "" {
		source = "import"
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	updated, err := storage.UpsertFindingRiskTx(ctx, tx, storage.FindingRiskUpsert{
		FindingID:    findingID,
		TenantID:     riskContext.TenantID,
		ModelVersion: result.ModelVersion,
		RiskScore:    result.Score,
		RiskBand:     result.Band,
		Factors:      factors,
		ComputedAt:   computedAt,
		InputHash:    result.InputHash,
		Source:       source,
	})
	if err != nil {
		_ = tx.Rollback()
		metrics.RecordRiskComputeProcessed("error", 1)
		return err
	}
	if err := tx.Commit(); err != nil {
		metrics.RecordRiskComputeProcessed("error", 1)
		return err
	}
	if updated {
		log.Printf("[risk] updated risk for finding %s", findingID)
		metrics.RecordRiskComputeProcessed("updated", 1)
	} else {
		metrics.RecordRiskComputeProcessed("noop", 1)
	}

	return nil
}

func publishRiskRecompute(ctx context.Context, publisher *events.Publisher, findingID uuid.UUID, tenantID *uuid.UUID, source string) {
	if publisher == nil {
		return
	}
	var tenantValue *string
	if tenantID != nil {
		value := tenantID.String()
		tenantValue = &value
	}
	payload := events.RiskRecomputeRequest{
		TenantID:  tenantValue,
		FindingID: findingID.String(),
		Source:    source,
	}
	if err := publisher.PublishJSON(ctx, events.RiskRecomputeRequestedSubject, payload); err != nil {
		log.Printf("[risk] publish recompute failed: %v", err)
	}
}
