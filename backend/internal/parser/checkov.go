package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// CheckovParser parses Checkov IaC security scanner output.
// Supports JSON format.
type CheckovParser struct{}

func (p *CheckovParser) ScannerType() string { return "checkov" }

func (p *CheckovParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "checkov") {
					return true
				}
			}
		}
		return false
	}

	if !json.Valid(data) {
		return false
	}

	// Checkov outputs a list of check results
	var reports []checkovReport
	if err := json.Unmarshal(data, &reports); err == nil {
		if len(reports) > 0 && reports[0].CheckType != "" {
			return true
		}
	}

	// Single report format
	var report checkovReport
	if err := json.Unmarshal(data, &report); err == nil {
		if report.CheckType != "" || len(report.Results.FailedChecks) > 0 {
			return true
		}
	}

	return false
}

func (p *CheckovParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "checkov")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategoryIAC
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "checkov"
			findings[i].Evidence["findingType"] = "iac"
		}
		return findings, nil
	}

	// Try array format first
	var reports []checkovReport
	if err := json.Unmarshal(data, &reports); err == nil && len(reports) > 0 {
		return p.buildFindingsFromReports(reports)
	}

	// Single report format
	var report checkovReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse checkov report: %w", err)
	}

	return p.buildFindingsFromReports([]checkovReport{report})
}

func (p *CheckovParser) buildFindingsFromReports(reports []checkovReport) ([]Finding, error) {
	var findings []Finding
	for _, report := range reports {
		for _, check := range report.Results.FailedChecks {
			findings = append(findings, p.buildFinding(check, report.CheckType))
		}
	}
	return findings, nil
}

func (p *CheckovParser) buildFinding(check checkovCheck, checkType string) Finding {
	// Title: check_id + check_name
	title := buildCheckovTitle(check)

	// Location: file_path:line
	location := buildCheckovLocation(check)

	// Description
	desc := strings.TrimSpace(check.Guideline)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildCheckovRawData(check, checkType)
	evidence := buildCheckovEvidence(check, checkType)

	return Finding{
		Category:    models.CategoryIAC,
		Title:       title,
		Description: descPtr,
		Severity:    mapCheckovSeverity(check.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(check.CheckID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildCheckovTitle(check checkovCheck) string {
	checkID := strings.TrimSpace(check.CheckID)
	checkName := strings.TrimSpace(check.CheckName)

	if checkID == "" && checkName == "" {
		return "Checkov finding"
	}
	if checkID == "" {
		return checkName
	}
	if checkName == "" {
		return checkID
	}

	// Truncate long names
	if len(checkName) > 60 {
		checkName = checkName[:57] + "..."
	}
	return fmt.Sprintf("%s: %s", checkID, checkName)
}

func buildCheckovLocation(check checkovCheck) string {
	filePath := strings.TrimSpace(check.FilePath)
	if filePath == "" {
		return ""
	}

	// Remove leading slash if present
	filePath = strings.TrimPrefix(filePath, "/")

	if len(check.FileLineRange) >= 1 {
		return fmt.Sprintf("%s:%d", filePath, check.FileLineRange[0])
	}
	return filePath
}

func buildCheckovRawData(check checkovCheck, checkType string) map[string]any {
	rawData := map[string]any{
		"type":       "iac",
		"scanner":    "checkov",
		"check_id":   strings.TrimSpace(check.CheckID),
		"check_name": strings.TrimSpace(check.CheckName),
		"check_type": checkType,
	}

	if check.FilePath != "" {
		rawData["file_path"] = strings.TrimPrefix(check.FilePath, "/")
	}
	if len(check.FileLineRange) > 0 {
		rawData["file_line_range"] = check.FileLineRange
	}
	if check.ResourceAddress != "" {
		rawData["resource_address"] = check.ResourceAddress
	}
	if check.Resource != "" {
		rawData["resource"] = check.Resource
	}
	if check.Guideline != "" {
		rawData["guideline"] = check.Guideline
	}
	if check.CheckClass != "" {
		rawData["check_class"] = check.CheckClass
	}
	if check.Severity != "" {
		rawData["original_severity"] = check.Severity
	}
	if check.BCCheckID != "" {
		rawData["bc_check_id"] = check.BCCheckID
	}
	if check.EvaluatedKeys != "" {
		rawData["evaluated_keys"] = check.EvaluatedKeys
	}

	return rawData
}

func buildCheckovEvidence(check checkovCheck, checkType string) map[string]any {
	evidence := map[string]any{
		"scannerType": "checkov",
		"findingType": "iac",
		"category":    models.CategoryIAC,
		"ruleId":      strings.TrimSpace(check.CheckID),
		"checkType":   checkType,
	}

	if check.FilePath != "" {
		evidence["filePath"] = strings.TrimPrefix(check.FilePath, "/")
	}

	if len(check.FileLineRange) >= 1 {
		evidence["startLine"] = check.FileLineRange[0]
	}
	if len(check.FileLineRange) >= 2 {
		evidence["endLine"] = check.FileLineRange[1]
	}

	if check.CheckName != "" {
		evidence["message"] = check.CheckName
	}

	if check.ResourceAddress != "" {
		evidence["resourceAddress"] = check.ResourceAddress
	}
	if check.Resource != "" {
		evidence["resource"] = check.Resource
	}

	if check.Guideline != "" {
		evidence["primaryUrl"] = check.Guideline
		evidence["references"] = []string{check.Guideline}
	}

	if check.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(check.Severity)
	}

	return evidence
}

var checkovSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
	"NONE":     models.SeverityLow,
}

func mapCheckovSeverity(raw string) string {
	if v, ok := checkovSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Checkov report structures

type checkovReport struct {
	CheckType string          `json:"check_type"`
	Results   checkovResults  `json:"results"`
	Summary   json.RawMessage `json:"summary"`
}

type checkovResults struct {
	PassedChecks  []checkovCheck `json:"passed_checks"`
	FailedChecks  []checkovCheck `json:"failed_checks"`
	SkippedChecks []checkovCheck `json:"skipped_checks"`
}

type checkovCheck struct {
	CheckID     string `json:"check_id"`
	BCCheckID   string `json:"bc_check_id"`
	CheckName   string `json:"check_name"`
	CheckResult struct {
		Result string `json:"result"`
	} `json:"check_result"`
	CodeBlock       json.RawMessage `json:"code_block"`
	FilePath        string          `json:"file_path"`
	FileLineRange   []int           `json:"file_line_range"`
	ResourceAddress string          `json:"resource_address"`
	Resource        string          `json:"resource"`
	Guideline       string          `json:"guideline"`
	EvaluatedKeys   string          `json:"evaluated_keys"`
	CheckClass      string          `json:"check_class"`
	Severity        string          `json:"severity"`
}
