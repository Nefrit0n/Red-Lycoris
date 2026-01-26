package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// TerrascanParser parses Terrascan IaC security scanner output.
// Supports JSON format.
type TerrascanParser struct{}

func (p *TerrascanParser) ScannerType() string { return "terrascan" }

func (p *TerrascanParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "terrascan") {
					return true
				}
			}
		}
		return false
	}

	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// Terrascan format has "results" object with "violations"
	if _, hasResults := payload["results"]; !hasResults {
		return false
	}

	return true
}

func (p *TerrascanParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "terrascan")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategoryIAC
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "terrascan"
			findings[i].Evidence["findingType"] = "iac"
		}
		return findings, nil
	}

	var report terrascanReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse terrascan report: %w", err)
	}

	var findings []Finding
	for _, result := range report.Results.Violations {
		findings = append(findings, p.buildFinding(result))
	}

	return findings, nil
}

func (p *TerrascanParser) buildFinding(violation terrascanViolation) Finding {
	// Title: rule_name or rule_id
	title := violation.RuleName
	if title == "" {
		title = violation.RuleID
	}

	// Location: file:line
	location := violation.File
	if violation.Line > 0 {
		location = fmt.Sprintf("%s:%d", violation.File, violation.Line)
	}

	// Description
	desc := violation.Description
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildTerrascanRawData(violation)
	evidence := buildTerrascanEvidence(violation)

	return Finding{
		Category:    models.CategoryIAC,
		Title:       title,
		Description: descPtr,
		Severity:    mapTerrascanSeverity(violation.Severity),
		Location:    location,
		RuleID:      violation.RuleID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildTerrascanRawData(violation terrascanViolation) map[string]any {
	rawData := map[string]any{
		"type":              "iac",
		"scanner":           "terrascan",
		"rule_id":           violation.RuleID,
		"rule_name":         violation.RuleName,
		"original_severity": violation.Severity,
		"category":          violation.Category,
	}

	if violation.File != "" {
		rawData["file"] = violation.File
	}
	if violation.Line > 0 {
		rawData["line"] = violation.Line
	}
	if violation.PlanRoot != "" {
		rawData["plan_root"] = violation.PlanRoot
	}
	if violation.ResourceName != "" {
		rawData["resource_name"] = violation.ResourceName
	}
	if violation.ResourceType != "" {
		rawData["resource_type"] = violation.ResourceType
	}
	if violation.ModuleName != "" {
		rawData["module_name"] = violation.ModuleName
	}
	if violation.Remediation != "" {
		rawData["remediation"] = violation.Remediation
	}
	if len(violation.References) > 0 {
		rawData["references"] = violation.References
	}

	return rawData
}

func buildTerrascanEvidence(violation terrascanViolation) map[string]any {
	evidence := map[string]any{
		"scannerType": "terrascan",
		"findingType": "iac",
		"category":    models.CategoryIAC,
		"ruleId":      violation.RuleID,
	}

	if violation.File != "" {
		evidence["filePath"] = violation.File
	}
	if violation.Line > 0 {
		evidence["startLine"] = violation.Line
	}

	if violation.RuleName != "" {
		evidence["message"] = violation.RuleName
	}
	if violation.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(violation.Severity)
	}
	if violation.Category != "" {
		evidence["policyCategory"] = violation.Category
	}

	if violation.ResourceName != "" {
		evidence["resourceName"] = violation.ResourceName
	}
	if violation.ResourceType != "" {
		evidence["resourceType"] = violation.ResourceType
	}
	if violation.ModuleName != "" {
		evidence["moduleName"] = violation.ModuleName
	}

	if violation.Remediation != "" {
		evidence["remediation"] = violation.Remediation
	}

	if len(violation.References) > 0 {
		evidence["references"] = violation.References
		evidence["primaryUrl"] = violation.References[0]
	}

	return evidence
}

var terrascanSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapTerrascanSeverity(raw string) string {
	if v, ok := terrascanSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Terrascan report structures

type terrascanReport struct {
	Results     terrascanResults `json:"results"`
	ScanSummary json.RawMessage  `json:"scan_summary"`
}

type terrascanResults struct {
	Violations   []terrascanViolation `json:"violations"`
	PassedRules  []json.RawMessage    `json:"passed_rules"`
	SkippedRules []json.RawMessage    `json:"skipped_rules"`
	ScanErrors   []json.RawMessage    `json:"scan_errors"`
}

type terrascanViolation struct {
	RuleID       string   `json:"rule_id"`
	RuleName     string   `json:"rule_name"`
	Description  string   `json:"description"`
	Severity     string   `json:"severity"`
	Category     string   `json:"category"`
	File         string   `json:"file"`
	Line         int      `json:"line"`
	PlanRoot     string   `json:"planRoot"`
	ResourceName string   `json:"resource_name"`
	ResourceType string   `json:"resource_type"`
	ModuleName   string   `json:"module_name"`
	Remediation  string   `json:"remediation"`
	References   []string `json:"references"`
}
