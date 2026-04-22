package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"redlycoris/internal/domain"
)

type checkovReportSection struct {
	CheckType string `json:"check_type"`
	Results   struct {
		PassedChecks  []checkovCheck    `json:"passed_checks"`
		FailedChecks  []checkovCheck    `json:"failed_checks"`
		SkippedChecks []checkovCheck    `json:"skipped_checks"`
		ParsingErrors []json.RawMessage `json:"parsing_errors"`
	} `json:"results"`
	Summary struct {
		Passed        int    `json:"passed"`
		Failed        int    `json:"failed"`
		Skipped       int    `json:"skipped"`
		ParsingErrors int    `json:"parsing_errors"`
		ResourceCount int    `json:"resource_count"`
		CheckovVer    string `json:"checkov_version"`
	} `json:"summary"`
	URL string `json:"url"`
}

type checkovCheck struct {
	CheckID                   string            `json:"check_id"`
	BCCheckID                 string            `json:"bc_check_id"`
	CheckName                 string            `json:"check_name"`
	CheckResult               checkovResult     `json:"check_result"`
	CodeBlock                 []checkovCodeLine `json:"code_block"`
	FilePath                  string            `json:"file_path"`
	FileAbsPath               string            `json:"file_abs_path"`
	RepoFilePath              string            `json:"repo_file_path"`
	FileLineRange             []int             `json:"file_line_range"`
	Resource                  string            `json:"resource"`
	Evaluations               map[string]any    `json:"evaluations"`
	CheckClass                string            `json:"check_class"`
	FixedDefinition           string            `json:"fixed_definition"`
	EntityTags                map[string]any    `json:"entity_tags"`
	CallerFilePath            string            `json:"caller_file_path"`
	CallerFileLineRange       []int             `json:"caller_file_line_range"`
	ResourceAddress           string            `json:"resource_address"`
	Severity                  string            `json:"severity"`
	BCCategory                string            `json:"bc_category"`
	Benchmarks                []string          `json:"benchmarks"`
	Description               string            `json:"description"`
	ShortDescription          string            `json:"short_description"`
	VulnerabilityDetails      string            `json:"vulnerability_details"`
	ConnectedNode             any               `json:"connected_node"`
	Guideline                 string            `json:"guideline"`
	Details                   []string          `json:"details"`
	CheckLen                  int               `json:"check_len"`
	DefinitionContextFilePath string            `json:"definition_context_file_path"`
}

type checkovResult struct {
	Result               string                       `json:"result"`
	ResultsConfiguration []checkovResultConfiguration `json:"results_configuration"`
}

type checkovResultConfiguration struct {
	Instruction string `json:"instruction"`
	StartLine   int    `json:"startline"`
	EndLine     int    `json:"endline"`
	Content     string `json:"content"`
	Value       any    `json:"value"`
}

type checkovCodeLine []any

type CheckovParser struct{}

func (p *CheckovParser) CanParse(data []byte) bool {
	sections, err := parseCheckovSections(data)
	if err != nil || len(sections) == 0 {
		return false
	}

	for _, section := range sections {
		if strings.TrimSpace(section.CheckType) != "" {
			return true
		}
		if section.Results.PassedChecks != nil || section.Results.FailedChecks != nil || section.Results.SkippedChecks != nil || section.Results.ParsingErrors != nil {
			return true
		}
		if section.Summary.ResourceCount > 0 || strings.TrimSpace(section.Summary.CheckovVer) != "" {
			return true
		}
	}
	return false
}

func (p *CheckovParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	sections, err := parseCheckovSections(data)
	if err != nil {
		return nil, fmt.Errorf("parser.CheckovParser.Parse: unmarshal: %w", err)
	}

	total := 0
	for _, section := range sections {
		total += len(section.Results.FailedChecks)
	}

	findings := make([]domain.Finding, 0, total)
	for _, section := range sections {
		for _, check := range section.Results.FailedChecks {
			lineStart, lineEnd := checkovLines(check.FileLineRange, check.CheckResult.ResultsConfiguration)
			ruleID := emptyToNil(firstNonEmpty(check.CheckID, check.BCCheckID))
			ruleName := emptyToNil(firstNonEmpty(check.CheckName, check.ShortDescription))
			iacResource := emptyToNil(firstNonEmpty(check.Resource, check.ResourceAddress))
			iacProvider := emptyToNil(checkovProvider(check.CheckID))
			codeSnippet := emptyToNil(checkovCodeSnippet(check.CodeBlock, check.CheckResult.ResultsConfiguration))

			f := domain.Finding{
				Kind:        domain.KindIaC,
				Title:       firstNonEmpty(strings.TrimSpace(check.CheckName), strings.TrimSpace(check.CheckID), "Checkov policy violation"),
				Description: checkovDescription(section, check),
				Severity:    mapCheckovSeverity(check.Severity),
				Confidence:  2,
				Status:      domain.StatusOpen,
				FilePath:    checkovFilePath(check),
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
	}

	return findings, nil
}

func parseCheckovSections(data []byte) ([]checkovReportSection, error) {
	var list []checkovReportSection
	if err := json.Unmarshal(data, &list); err == nil {
		return list, nil
	}

	var single checkovReportSection
	if err := json.Unmarshal(data, &single); err != nil {
		return nil, err
	}
	return []checkovReportSection{single}, nil
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

func checkovLines(lineRange []int, conf []checkovResultConfiguration) (int, int) {
	if len(lineRange) >= 2 {
		return lineRange[0], lineRange[1]
	}
	if len(lineRange) == 1 {
		return lineRange[0], lineRange[0]
	}
	for _, item := range conf {
		if item.StartLine > 0 && item.EndLine > 0 {
			return item.StartLine, item.EndLine
		}
	}
	return 0, 0
}

func checkovCodeSnippet(codeBlock []checkovCodeLine, conf []checkovResultConfiguration) string {
	lines := make([]string, 0, len(codeBlock)+len(conf))
	for _, pair := range codeBlock {
		if len(pair) < 2 {
			continue
		}
		text, ok := pair[1].(string)
		if !ok {
			continue
		}
		lines = append(lines, text)
	}
	if len(lines) > 0 {
		return strings.Join(lines, "\n")
	}
	for _, item := range conf {
		if value := strings.TrimSpace(item.Content); value != "" {
			lines = append(lines, value)
		}
	}
	return strings.Join(lines, "\n")
}

func checkovFilePath(check checkovCheck) string {
	return firstNonEmpty(
		strings.TrimSpace(check.RepoFilePath),
		strings.TrimSpace(check.FilePath),
		strings.TrimSpace(check.CallerFilePath),
		strings.TrimSpace(check.FileAbsPath),
	)
}

func checkovDescription(section checkovReportSection, check checkovCheck) string {
	parts := make([]string, 0, 12)
	if v := strings.TrimSpace(check.Description); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(check.ShortDescription); v != "" {
		parts = append(parts, "Summary: "+v)
	}
	if v := strings.TrimSpace(check.Guideline); v != "" {
		parts = append(parts, "Guideline: "+v)
	}
	if v := strings.TrimSpace(check.VulnerabilityDetails); v != "" {
		parts = append(parts, "Details: "+v)
	}
	if v := strings.TrimSpace(check.BCCategory); v != "" {
		parts = append(parts, "Category: "+v)
	}
	if len(check.Benchmarks) > 0 {
		parts = append(parts, "Benchmarks: "+strings.Join(check.Benchmarks, ", "))
	}
	if v := strings.TrimSpace(section.CheckType); v != "" {
		parts = append(parts, "Check type: "+v)
	}
	if v := strings.TrimSpace(section.URL); v != "" {
		parts = append(parts, "Report URL: "+v)
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, "\n\n")
}
