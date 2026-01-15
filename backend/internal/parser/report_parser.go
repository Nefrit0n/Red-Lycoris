package parser

import (
	"encoding/json"
	"fmt"
	"strings"
)

type Finding struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	Severity    string  `json:"severity"`
	Location    string  `json:"location,omitempty"`
}

type genericReport struct {
	Findings []Finding `json:"findings"`
}

func ParseReport(scannerType string, raw json.RawMessage) ([]Finding, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("report is required")
	}
	scannerType = strings.ToLower(strings.TrimSpace(scannerType))
	if scannerType == "" {
		return nil, fmt.Errorf("scanner_type is required")
	}

	var findings []Finding
	if err := json.Unmarshal(raw, &findings); err == nil {
		return normalizeFindings(findings)
	}

	var report genericReport
	if err := json.Unmarshal(raw, &report); err != nil {
		return nil, fmt.Errorf("invalid report json: %w", err)
	}
	return normalizeFindings(report.Findings)
}

func normalizeFindings(findings []Finding) ([]Finding, error) {
	for i := range findings {
		findings[i].Title = strings.TrimSpace(findings[i].Title)
		findings[i].Severity = strings.ToLower(strings.TrimSpace(findings[i].Severity))
		findings[i].Location = strings.TrimSpace(findings[i].Location)
		if findings[i].Title == "" {
			return nil, fmt.Errorf("finding title is required")
		}
		switch findings[i].Severity {
		case "low", "medium", "high", "critical":
		default:
			return nil, fmt.Errorf("invalid severity: %s", findings[i].Severity)
		}
	}
	return findings, nil
}
