package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"redlycoris/internal/domain"
)

type checkovReport struct {
	Results struct {
		FailedChecks []checkovCheck `json:"failed_checks"`
	} `json:"results"`
}

type checkovCheck struct {
	CheckID       string `json:"check_id"`
	CheckName     string `json:"check_name"`
	Guideline     string `json:"guideline"`
	Severity      string `json:"severity"`
	FilePath      string `json:"file_path"`
	FileLineRange []int  `json:"file_line_range"`
	Resource      string `json:"resource"`
	CodeBlock     []any  `json:"code_block"`
}

type CheckovParser struct{}

func (p *CheckovParser) CanParse(data []byte) bool {
	var probe struct {
		Results struct {
			FailedChecks []json.RawMessage `json:"failed_checks"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	return len(probe.Results.FailedChecks) > 0
}

func (p *CheckovParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report checkovReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.CheckovParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report.Results.FailedChecks))
	for _, check := range report.Results.FailedChecks {
		lineStart, lineEnd := checkovLines(check.FileLineRange)
		ruleID := emptyToNil(check.CheckID)
		ruleName := emptyToNil(check.CheckName)
		iacResource := emptyToNil(check.Resource)
		iacProvider := emptyToNil(checkovProvider(check.CheckID))
		codeSnippet := emptyToNil(checkovCodeSnippet(check.CodeBlock))

		f := domain.Finding{
			Kind:        domain.KindIaC,
			Title:       strings.TrimSpace(check.CheckName),
			Description: strings.TrimSpace(check.Guideline),
			Severity:    mapCheckovSeverity(check.Severity),
			Confidence:  2,
			Status:      domain.StatusOpen,
			FilePath:    strings.TrimSpace(check.FilePath),
			LineStart:   lineStart,
			LineEnd:     lineEnd,
			RuleID:      ruleID,
			RuleName:    ruleName,
			IacResource: iacResource,
			IacProvider: iacProvider,
			CodeSnippet: codeSnippet,
			CVEIDs:      []string{},
			CWEIDs:      []int{},
			SourceType:  "checkov",
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func mapCheckovSeverity(severity string) int {
	switch strings.ToUpper(strings.TrimSpace(severity)) {
	case "CRITICAL":
		return domain.SeverityCritical
	case "HIGH":
		return domain.SeverityHigh
	case "MEDIUM":
		return domain.SeverityMedium
	case "LOW":
		return domain.SeverityLow
	case "INFO":
		return domain.SeverityInfo
	case "":
		return domain.SeverityMedium
	default:
		return domain.SeverityMedium
	}
}

func checkovProvider(checkID string) string {
	re := []struct {
		pattern *regexp.Regexp
		value   string
	}{
		{regexp.MustCompile(`^CKV_AWS_`), "aws"},
		{regexp.MustCompile(`^CKV_AZURE_`), "azure"},
		{regexp.MustCompile(`^CKV_GCP_`), "gcp"},
		{regexp.MustCompile(`^CKV_K8S_`), "kubernetes"},
		{regexp.MustCompile(`^CKV_DOCKER_`), "docker"},
	}

	upper := strings.ToUpper(strings.TrimSpace(checkID))
	for _, item := range re {
		if item.pattern.MatchString(upper) {
			return item.value
		}
	}
	return ""
}

func checkovLines(lineRange []int) (int, int) {
	if len(lineRange) >= 2 {
		return lineRange[0], lineRange[1]
	}
	if len(lineRange) == 1 {
		return lineRange[0], lineRange[0]
	}
	return 0, 0
}

func checkovCodeSnippet(codeBlock []any) string {
	lines := make([]string, 0, len(codeBlock))
	for _, raw := range codeBlock {
		pair, ok := raw.([]any)
		if !ok || len(pair) < 2 {
			continue
		}
		text, ok := pair[1].(string)
		if !ok {
			continue
		}
		lines = append(lines, text)
	}
	return strings.Join(lines, "\n")
}
