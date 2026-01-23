package handlers

import (
	"strings"
	"time"

	"lotus-warden/backend/internal/policies"
	"lotus-warden/backend/internal/storage"
)

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

func buildPolicyFindingFromDetail(detail *storage.FindingDetail, fixedVersion *string) *policies.Finding {
	if detail == nil {
		return nil
	}
	severity := strings.ToUpper(detail.Severity)
	category := detail.Category
	status := detail.Status
	title := detail.Title
	var firstSeen *string
	if detail.FirstSeenAt.Valid {
		value := detail.FirstSeenAt.Time.Format(time.RFC3339)
		firstSeen = &value
	}
	var lastSeen *string
	if detail.LastSeenAt.Valid {
		value := detail.LastSeenAt.Time.Format(time.RFC3339)
		lastSeen = &value
	}

	policyFinding := &policies.Finding{
		Title:        &title,
		Severity:     severity,
		Status:       &status,
		Category:     &category,
		FixedVersion: fixedVersion,
	}
	if detail.SourceType.Valid {
		value := detail.SourceType.String
		policyFinding.SourceType = &value
	}
	if firstSeen != nil {
		policyFinding.FirstSeenAt = firstSeen
	}
	if lastSeen != nil {
		policyFinding.LastSeenAt = lastSeen
	}
	if detail.ProductID.Valid {
		value := detail.ProductID.UUID.String()
		policyFinding.ProductID = &value
	}
	if detail.ImportJobID.Valid {
		value := detail.ImportJobID.UUID.String()
		policyFinding.ImportJobID = &value
	}
	return policyFinding
}

func policyHasAction(decision policies.Decision, actionType string) bool {
	for _, action := range decision.Actions {
		if action.Type == actionType {
			return true
		}
	}
	return false
}
