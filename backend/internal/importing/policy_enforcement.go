package importing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/parser"
	"red-lycoris/backend/internal/policies"
	"red-lycoris/backend/internal/storage"
)

type policyFindingParams struct {
	DecisionEngine policies.Evaluator
	Finding        *models.Finding
	ParserFinding  parser.Finding
	Scanner        string
	SourceType     *string
	SourceVersion  *string
	ProductID      *uuid.UUID
	ImportJobID    *uuid.UUID
	ActorID        *uuid.UUID
	CorrelationID  *string
}

type policyAggregateParams struct {
	DecisionEngine policies.Evaluator
	ImportJob      *models.ImportJob
	ScanResult     *models.ScanResult
	Findings       []parser.Finding
	ProductID      *uuid.UUID
	ActorID        *uuid.UUID
	CorrelationID  *string
	Callbacks      *ImportCallbacks
}

type policyEventPayload struct {
	PolicyID      string               `json:"policy_id,omitempty"`
	PolicyRuleID  *string              `json:"policy_rule_id,omitempty"`
	PolicyVersion string               `json:"policy_version,omitempty"`
	Decision      string               `json:"decision"`
	Actions       []policies.Action    `json:"actions,omitempty"`
	Violations    []policies.Violation `json:"violations,omitempty"`
	InputHash     string               `json:"input_hash"`
	DecisionID    *string              `json:"decision_id,omitempty"`
	CorrelationID *string              `json:"correlation_id,omitempty"`
}

func buildPolicyEventPayload(decision policies.Decision, inputHash string, correlationID *string) policyEventPayload {
	payload := policyEventPayload{
		Decision:      decision.Outcome,
		Actions:       decision.Actions,
		Violations:    decision.Violations,
		InputHash:     inputHash,
		DecisionID:    decision.DecisionID,
		CorrelationID: correlationID,
	}
	if decision.Policy != nil {
		payload.PolicyID = decision.Policy.PolicyID
		payload.PolicyRuleID = decision.Policy.PolicyRuleID
		payload.PolicyVersion = decision.Policy.PolicyVersion
	}
	return payload
}

func applyFindingPolicies(ctx context.Context, db *sql.DB, params policyFindingParams) error {
	if params.DecisionEngine == nil || params.Finding == nil {
		return nil
	}

	policyFinding := buildPolicyFindingInput(params)
	policyCtx := policies.Context{
		Subject: policies.Subject{
			Type: "finding",
			ID:   params.Finding.ID.String(),
		},
		Event: policies.Event{
			Type:  "import",
			Actor: buildPolicyActor(params.ActorID),
		},
		Finding: policyFinding,
	}
	if params.ProductID != nil {
		policyCtx.Product = &policies.Product{ID: params.ProductID.String()}
	}

	decision, err := params.DecisionEngine.Evaluate(policyCtx)
	if err != nil {
		return err
	}

	inputHash, err := policies.InputHash(policyCtx)
	if err != nil {
		return err
	}

	payload := buildPolicyEventPayload(decision, inputHash, params.CorrelationID)
	payloadJSON, _ := json.Marshal(payload)

	_ = storage.CreateFindingEventIfNotExists(ctx, db, &models.FindingEvent{
		FindingID: params.Finding.ID,
		ActorID:   params.ActorID,
		EventType: "policy_evaluated",
		Payload:   payloadJSON,
	})

	current := params.Finding
	for _, action := range decision.Actions {
		switch action.Type {
		case "auto_status":
			if action.Status == nil || strings.TrimSpace(*action.Status) == "" {
				continue
			}
			if current.Status == models.StatusDuplicate {
				continue
			}
			if !isAllowedFindingStatus(*action.Status) || current.Status == *action.Status {
				continue
			}
			updated, err := storage.UpdateFinding(ctx, db, current.ID, storage.UpdateFindingParams{
				Status: action.Status,
			})
			if err != nil {
				return err
			}
			if updated == nil {
				return errors.New("finding not found")
			}
			statusPayload := map[string]any{
				"status": map[string]any{
					"from": current.Status,
					"to":   updated.Status,
				},
				"policy": payload,
			}
			statusJSON, _ := json.Marshal(statusPayload)
			_ = storage.CreateFindingEventIfNotExists(ctx, db, &models.FindingEvent{
				FindingID: current.ID,
				ActorID:   params.ActorID,
				EventType: "status_changed_by_policy",
				Payload:   statusJSON,
			})
			current = updated
		case "auto_assign":
			if action.AssigneeID == nil || strings.TrimSpace(*action.AssigneeID) == "" {
				continue
			}
			assigneeUUID, err := uuid.Parse(*action.AssigneeID)
			if err != nil {
				continue
			}
			if current.AssigneeID != nil && *current.AssigneeID == assigneeUUID {
				continue
			}
			updated, err := storage.UpdateFinding(ctx, db, current.ID, storage.UpdateFindingParams{
				AssigneeID: &assigneeUUID,
			})
			if err != nil {
				return err
			}
			if updated == nil {
				return errors.New("finding not found")
			}
			from := ""
			if current.AssigneeID != nil {
				from = current.AssigneeID.String()
			}
			assignPayload := map[string]any{
				"assignee": map[string]any{
					"from": from,
					"to":   assigneeUUID.String(),
				},
				"policy": payload,
			}
			assignJSON, _ := json.Marshal(assignPayload)
			_ = storage.CreateFindingEventIfNotExists(ctx, db, &models.FindingEvent{
				FindingID: current.ID,
				ActorID:   params.ActorID,
				EventType: "assigned_by_policy",
				Payload:   assignJSON,
			})
			current = updated
		}
	}

	return nil
}

func applyImportAggregatePolicies(ctx context.Context, db *sql.DB, params policyAggregateParams) error {
	if params.DecisionEngine == nil || params.ImportJob == nil || params.ScanResult == nil {
		return nil
	}

	severityCounts := countBySeverity(params.Findings)
	categoryCounts := countByCategory(params.Findings)

	importCtx := policies.Context{
		Subject: policies.Subject{Type: "import_job", ID: params.ImportJob.ID.String()},
		Event: policies.Event{
			Type:  "import",
			Actor: buildPolicyActor(params.ActorID),
		},
		ImportJob: &policies.ImportJob{
			ID:              params.ImportJob.ID.String(),
			Scanner:         params.ImportJob.Scanner,
			Status:          params.ImportJob.Status,
			FindingsTotal:   params.ImportJob.FindingsTotal,
			FindingsNew:     params.ImportJob.FindingsNew,
			DuplicatesTotal: params.ImportJob.DuplicatesTotal,
			CreatedAt:       params.ImportJob.CreatedAt.Format(time.RFC3339),
			SeverityCounts:  severityCounts,
			CategoryCounts:  categoryCounts,
		},
	}
	if params.ImportJob.StartedAt != nil {
		value := params.ImportJob.StartedAt.Format(time.RFC3339)
		importCtx.ImportJob.StartedAt = &value
	}
	if params.ImportJob.FinishedAt != nil {
		value := params.ImportJob.FinishedAt.Format(time.RFC3339)
		importCtx.ImportJob.FinishedAt = &value
	}
	if params.ProductID != nil {
		importCtx.Product = &policies.Product{ID: params.ProductID.String()}
	}

	decision, err := params.DecisionEngine.Evaluate(importCtx)
	if err != nil {
		return err
	}
	inputHash, err := policies.InputHash(importCtx)
	if err != nil {
		return err
	}
	if isGateFailed(decision) {
		if err := storage.UpdateImportJobGateFailed(ctx, db, params.ImportJob.ID, true); err != nil {
			return err
		}
		if params.Callbacks != nil && params.Callbacks.OnPolicyGateFailed != nil {
			params.Callbacks.OnPolicyGateFailed("import_job", params.ImportJob.ID, decision, inputHash)
		}
	}

	scanCtx := policies.Context{
		Subject: policies.Subject{Type: "scan_result", ID: params.ScanResult.ID.String()},
		Event: policies.Event{
			Type:  "import",
			Actor: buildPolicyActor(params.ActorID),
		},
		ScanResult: &policies.ScanResult{
			ID:             params.ScanResult.ID.String(),
			Scanner:        params.ScanResult.Scanner,
			CreatedAt:      params.ScanResult.CreatedAt.Format(time.RFC3339),
			SeverityCounts: severityCounts,
			CategoryCounts: categoryCounts,
		},
	}
	processedAt := params.ScanResult.ProcessedAt.Format(time.RFC3339)
	scanCtx.ScanResult.ProcessedAt = &processedAt
	if params.ProductID != nil {
		scanCtx.Product = &policies.Product{ID: params.ProductID.String()}
	}

	scanDecision, err := params.DecisionEngine.Evaluate(scanCtx)
	if err != nil {
		return err
	}
	scanHash, err := policies.InputHash(scanCtx)
	if err != nil {
		return err
	}
	if isGateFailed(scanDecision) {
		if err := storage.UpdateScanResultGateFailed(ctx, db, params.ScanResult.ID, true); err != nil {
			return err
		}
		if params.Callbacks != nil && params.Callbacks.OnPolicyGateFailed != nil {
			params.Callbacks.OnPolicyGateFailed("scan_result", params.ScanResult.ID, scanDecision, scanHash)
		}
	}

	return nil
}

func buildPolicyFindingInput(params policyFindingParams) *policies.Finding {
	finding := params.Finding
	severity := strings.ToUpper(finding.Severity)
	category := finding.Category
	status := finding.Status
	title := finding.Title
	firstSeen := finding.FirstSeenAt.Format(time.RFC3339)
	lastSeen := finding.LastSeenAt.Format(time.RFC3339)

	policyFinding := &policies.Finding{
		Title:        &title,
		Severity:     severity,
		Status:       &status,
		Category:     &category,
		Scanner:      &params.Scanner,
		SourceType:   params.SourceType,
		FirstSeenAt:  &firstSeen,
		LastSeenAt:   &lastSeen,
		FixedVersion: extractFixedVersion(params.ParserFinding),
	}
	if finding.ProductID != nil {
		value := finding.ProductID.String()
		policyFinding.ProductID = &value
	}
	if params.ImportJobID != nil {
		value := params.ImportJobID.String()
		policyFinding.ImportJobID = &value
	}
	return policyFinding
}

func extractFixedVersion(finding parser.Finding) *string {
	if finding.Evidence != nil {
		if value, ok := finding.Evidence["fixedVersion"].(string); ok {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				return &trimmed
			}
		}
	}
	if finding.RawData != nil {
		if value, ok := finding.RawData["fixed_version"].(string); ok {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				return &trimmed
			}
		}
	}
	return nil
}

func countBySeverity(findings []parser.Finding) []policies.SeverityCount {
	counts := map[string]int{}
	for _, finding := range findings {
		severity := strings.ToUpper(strings.TrimSpace(finding.Severity))
		if severity == "" {
			continue
		}
		counts[severity]++
	}
	return mapToSeverityCounts(counts)
}

func countByCategory(findings []parser.Finding) []policies.CategoryCount {
	counts := map[string]int{}
	for _, finding := range findings {
		category := strings.TrimSpace(finding.Category)
		if category == "" {
			continue
		}
		counts[category]++
	}
	return mapToCategoryCounts(counts)
}

func mapToSeverityCounts(counts map[string]int) []policies.SeverityCount {
	result := make([]policies.SeverityCount, 0, len(counts))
	for severity, count := range counts {
		result = append(result, policies.SeverityCount{Severity: severity, Count: count})
	}
	return result
}

func mapToCategoryCounts(counts map[string]int) []policies.CategoryCount {
	result := make([]policies.CategoryCount, 0, len(counts))
	for category, count := range counts {
		result = append(result, policies.CategoryCount{Category: category, Count: count})
	}
	return result
}

func buildPolicyActor(actorID *uuid.UUID) *policies.Actor {
	if actorID == nil {
		return nil
	}
	return &policies.Actor{Type: "user", ID: actorID.String()}
}

func isGateFailed(decision policies.Decision) bool {
	if decision.Outcome == policies.OutcomeFail {
		return true
	}
	for _, action := range decision.Actions {
		if action.Type == "gate_fail" {
			return true
		}
	}
	return false
}

func isAllowedFindingStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case models.StatusNew,
		models.StatusUnderReview,
		models.StatusConfirmed,
		models.StatusFalsePositive,
		models.StatusOutOfScope,
		models.StatusRiskAccepted,
		models.StatusMitigated,
		models.StatusDuplicate:
		return true
	default:
		return false
	}
}
