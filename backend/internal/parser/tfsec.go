package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// TfsecParser parses tfsec Terraform security scanner output.
// Supports JSON format.
type TfsecParser struct{}

func (p *TfsecParser) ScannerType() string { return "tfsec" }

func (p *TfsecParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "tfsec") {
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

	// tfsec format has "results" array
	resultsRaw, hasResults := payload["results"]
	if !hasResults {
		return false
	}

	// Check if results array contains tfsec-specific fields
	var results []json.RawMessage
	if err := json.Unmarshal(resultsRaw, &results); err != nil {
		return false
	}
	// Allow empty results (valid tfsec output with no findings)
	if len(results) == 0 {
		return true
	}
	// Check first result for tfsec-specific fields
	var firstResult map[string]json.RawMessage
	if err := json.Unmarshal(results[0], &firstResult); err != nil {
		return false
	}
	// tfsec results have "rule_id" and "location" fields
	_, hasRuleID := firstResult["rule_id"]
	_, hasLocation := firstResult["location"]
	_, hasRuleProvider := firstResult["rule_provider"]
	// Must have at least rule_id and (location or rule_provider)
	return hasRuleID && (hasLocation || hasRuleProvider)
}

func (p *TfsecParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "tfsec")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategoryIAC
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "tfsec"
			findings[i].Evidence["findingType"] = "iac"
		}
		return findings, nil
	}

	var report tfsecReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse tfsec report: %w", err)
	}

	findings := make([]Finding, 0, len(report.Results))
	for _, result := range report.Results {
		findings = append(findings, p.buildFinding(result))
	}

	return findings, nil
}

func (p *TfsecParser) buildFinding(result tfsecResult) Finding {
	// Title: rule_id + rule_description
	title := buildTfsecTitle(result)

	// Location: location.filename:location.start_line
	location := buildTfsecLocation(result)

	// Description
	desc := result.Description
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildTfsecRawData(result)
	evidence := buildTfsecEvidence(result)

	return Finding{
		Category:    models.CategoryIAC,
		Title:       title,
		Description: descPtr,
		Severity:    mapTfsecSeverity(result.Severity),
		Location:    location,
		RuleID:      result.RuleID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildTfsecTitle(result tfsecResult) string {
	ruleID := strings.TrimSpace(result.RuleID)
	ruleDesc := strings.TrimSpace(result.RuleDescription)

	if ruleID == "" && ruleDesc == "" {
		return "tfsec finding"
	}
	if ruleID == "" {
		return ruleDesc
	}
	if ruleDesc == "" {
		return ruleID
	}

	// Truncate long descriptions
	if len(ruleDesc) > 60 {
		ruleDesc = ruleDesc[:57] + "..."
	}
	return fmt.Sprintf("%s: %s", ruleID, ruleDesc)
}

func buildTfsecLocation(result tfsecResult) string {
	filename := strings.TrimSpace(result.Location.Filename)
	if filename == "" {
		return ""
	}
	if result.Location.StartLine > 0 {
		return fmt.Sprintf("%s:%d", filename, result.Location.StartLine)
	}
	return filename
}

func buildTfsecRawData(result tfsecResult) map[string]any {
	rawData := map[string]any{
		"type":              "iac",
		"scanner":           "tfsec",
		"rule_id":           result.RuleID,
		"rule_description":  result.RuleDescription,
		"rule_provider":     result.RuleProvider,
		"original_severity": result.Severity,
		"status":            result.Status,
	}

	if result.Location.Filename != "" {
		rawData["filename"] = result.Location.Filename
	}
	if result.Location.StartLine > 0 {
		rawData["start_line"] = result.Location.StartLine
	}
	if result.Location.EndLine > 0 {
		rawData["end_line"] = result.Location.EndLine
	}
	if result.Resource != "" {
		rawData["resource"] = result.Resource
	}
	if result.Impact != "" {
		rawData["impact"] = result.Impact
	}
	if result.Resolution != "" {
		rawData["resolution"] = result.Resolution
	}
	if len(result.Links) > 0 {
		rawData["links"] = result.Links
	}
	if result.LongID != "" {
		rawData["long_id"] = result.LongID
	}

	return rawData
}

func buildTfsecEvidence(result tfsecResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "tfsec",
		"findingType": "iac",
		"category":    models.CategoryIAC,
		"ruleId":      result.RuleID,
	}

	if result.Location.Filename != "" {
		evidence["filePath"] = result.Location.Filename
	}
	if result.Location.StartLine > 0 {
		evidence["startLine"] = result.Location.StartLine
	}
	if result.Location.EndLine > 0 {
		evidence["endLine"] = result.Location.EndLine
	}

	if result.RuleDescription != "" {
		evidence["message"] = result.RuleDescription
	}
	if result.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(result.Severity)
	}
	if result.RuleProvider != "" {
		evidence["provider"] = result.RuleProvider
	}
	if result.Resource != "" {
		evidence["resource"] = result.Resource
	}
	if result.Impact != "" {
		evidence["impact"] = result.Impact
	}
	if result.Resolution != "" {
		evidence["resolution"] = result.Resolution
	}
	if len(result.Links) > 0 {
		evidence["references"] = result.Links
		evidence["primaryUrl"] = result.Links[0]
	}

	return evidence
}

var tfsecSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapTfsecSeverity(raw string) string {
	if v, ok := tfsecSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// tfsec report structures

type tfsecReport struct {
	Results []tfsecResult `json:"results"`
}

type tfsecResult struct {
	RuleID          string        `json:"rule_id"`
	LongID          string        `json:"long_id"`
	RuleDescription string        `json:"rule_description"`
	RuleProvider    string        `json:"rule_provider"`
	Link            string        `json:"link"`
	Links           []string      `json:"links"`
	Location        tfsecLocation `json:"location"`
	Description     string        `json:"description"`
	Impact          string        `json:"impact"`
	Resolution      string        `json:"resolution"`
	Resource        string        `json:"resource"`
	Severity        string        `json:"severity"`
	Status          int           `json:"status"`
}

type tfsecLocation struct {
	Filename  string `json:"filename"`
	StartLine int    `json:"start_line"`
	EndLine   int    `json:"end_line"`
}
