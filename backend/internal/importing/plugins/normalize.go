package plugins

import (
	"fmt"
	"strings"

	"lotus-warden/backend/internal/parser"
)

func normalizeFindings(findings []parser.Finding) ([]CanonicalFinding, error) {
	canonical := make([]CanonicalFinding, 0, len(findings))
	for _, finding := range findings {
		base, err := baseCanonicalFinding(finding)
		if err != nil {
			return nil, err
		}
		canonical = append(canonical, base)
	}
	return canonical, nil
}

func baseCanonicalFinding(finding parser.Finding) (CanonicalFinding, error) {
	title := strings.TrimSpace(finding.Title)
	if title == "" {
		return CanonicalFinding{}, fmt.Errorf("finding title is required")
	}
	severity := strings.ToLower(strings.TrimSpace(finding.Severity))
	if severity == "" {
		severity = "low"
	}
	if !isValidSeverity(severity) {
		return CanonicalFinding{}, fmt.Errorf("invalid severity: %s", severity)
	}

	location := strings.TrimSpace(finding.Location)
	ruleID := strings.TrimSpace(finding.RuleID)

	rawData := finding.RawData
	if rawData == nil {
		rawData = map[string]any{}
	}

	category := strings.TrimSpace(finding.Category)
	return CanonicalFinding{
		Category:    category,
		Kind:        category,
		Title:       title,
		Description: finding.Description,
		Severity:    severity,
		Location:    location,
		RuleID:      ruleID,
		Evidence:    finding.Evidence,
		RawData:     rawData,
	}, nil
}

func isValidSeverity(value string) bool {
	switch value {
	case "low", "medium", "high", "critical":
		return true
	default:
		return false
	}
}
