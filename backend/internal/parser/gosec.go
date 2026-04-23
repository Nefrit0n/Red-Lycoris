package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"redlycoris/internal/domain"
)

type gosecReport struct {
	Issues []gosecIssue `json:"Issues"`
}

type gosecIssue struct {
	Severity   string `json:"severity"`
	Confidence string `json:"confidence"`
	CWE        struct {
		ID string `json:"id"`
	} `json:"cwe"`
	RuleID  string `json:"rule_id"`
	Details string `json:"details"`
	File    string `json:"file"`
	Code    string `json:"code"`
	Line    string `json:"line"`
	Column  string `json:"column"`
}

type GosecParser struct{}

func (p *GosecParser) CanParse(data []byte) bool {
	var probe struct {
		Issues       json.RawMessage `json:"Issues"`
		GosecVersion any             `json:"GosecVersion"`
		Stats        json.RawMessage `json:"Stats"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}

	if len(probe.Issues) > 0 {
		return true
	}
	if probe.GosecVersion != nil && len(probe.Stats) > 0 {
		return true
	}
	return false
}

func (p *GosecParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	_ = ctx

	var report gosecReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.GosecParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report.Issues))
	for _, issue := range report.Issues {
		ruleID := emptyToNil(issue.RuleID)
		ruleName := emptyToNil(issue.Details)
		codeSnippet := emptyToNil(issue.Code)

		line := parseGosecPos(issue.Line)
		column := parseGosecPos(issue.Column)
		if line == 0 {
			line = column
		}

		f := domain.Finding{
			Kind:        domain.KindSAST,
			Title:       firstNonEmpty(strings.TrimSpace(issue.Details), strings.TrimSpace(issue.RuleID), "gosec issue"),
			Description: buildGosecDescription(issue),
			Severity:    mapGosecSeverity(issue.Severity),
			Confidence:  mapGosecConfidence(issue.Confidence),
			Status:      domain.StatusOpen,
			FilePath:    strings.TrimSpace(issue.File),
			LineStart:   line,
			LineEnd:     line,
			RuleID:      ruleID,
			RuleName:    ruleName,
			CodeSnippet: codeSnippet,
			CWEIDs:      parseGosecCWEs(issue.CWE.ID),
			CVEIDs:      []string{},
			SourceType:  "gosec",
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func mapGosecSeverity(severity string) int {
	switch strings.ToUpper(strings.TrimSpace(severity)) {
	case "HIGH":
		return domain.SeverityHigh
	case "MEDIUM":
		return domain.SeverityMedium
	case "LOW":
		return domain.SeverityLow
	default:
		return domain.SeverityInfo
	}
}

func mapGosecConfidence(confidence string) int {
	switch strings.ToUpper(strings.TrimSpace(confidence)) {
	case "HIGH":
		return 3
	case "MEDIUM":
		return 2
	case "LOW":
		return 1
	default:
		return 0
	}
}

func parseGosecCWEs(raw string) []int {
	id, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || id <= 0 {
		return []int{}
	}
	return []int{id}
}

func parseGosecPos(raw string) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return 0
	}
	return value
}

func buildGosecDescription(issue gosecIssue) string {
	parts := make([]string, 0, 4)
	if v := strings.TrimSpace(issue.Details); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(issue.RuleID); v != "" {
		parts = append(parts, "Rule: "+v)
	}
	if v := strings.TrimSpace(issue.CWE.ID); v != "" {
		parts = append(parts, "CWE: "+v)
	}
	return strings.Join(parts, "\n\n")
}
