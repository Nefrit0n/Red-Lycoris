package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// GosecParser parses Gosec security scanner output for Go code.
// Supports native JSON format and SARIF.
type GosecParser struct{}

func (p *GosecParser) ScannerType() string { return "gosec" }

func (p *GosecParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "gosec") {
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

	// Gosec native format has "Issues" and "Stats" fields
	if _, hasIssues := payload["Issues"]; !hasIssues {
		return false
	}
	if _, hasStats := payload["Stats"]; !hasStats {
		return false
	}

	return true
}

func (p *GosecParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "gosec")
		if err != nil {
			return nil, err
		}
		// Post-process for gosec
		for i := range findings {
			findings[i].Category = models.CategorySAST
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "gosec"
			findings[i].Evidence["findingType"] = "sast"
		}
		return findings, nil
	}

	var report gosecReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse gosec report: %w", err)
	}

	findings := make([]Finding, 0, len(report.Issues))
	for _, issue := range report.Issues {
		findings = append(findings, p.buildFinding(issue))
	}
	return findings, nil
}

func (p *GosecParser) buildFinding(issue gosecIssue) Finding {
	// Title: rule_id + details (e.g., "G401: Use of weak cryptographic primitive")
	title := buildGosecTitle(issue.RuleID, issue.Details)

	// Location: file:line:column
	location := buildGosecLocation(issue.File, issue.Line, issue.Column)

	// Description
	desc := strings.TrimSpace(issue.Details)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildGosecRawData(issue)
	evidence := buildGosecEvidence(issue)

	return Finding{
		Category:    models.CategorySAST,
		Title:       title,
		Description: descPtr,
		Severity:    mapGosecSeverity(issue.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(issue.RuleID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildGosecTitle(ruleID, details string) string {
	ruleID = strings.TrimSpace(ruleID)
	details = strings.TrimSpace(details)

	if ruleID == "" && details == "" {
		return "gosec finding"
	}
	if ruleID == "" {
		// Truncate long details
		if len(details) > 80 {
			return details[:77] + "..."
		}
		return details
	}
	if details == "" {
		return ruleID
	}

	// Truncate details if too long
	shortDetails := details
	if len(details) > 60 {
		shortDetails = details[:57] + "..."
	}
	return fmt.Sprintf("%s: %s", ruleID, shortDetails)
}

func buildGosecLocation(file string, line, column string) string {
	file = strings.TrimSpace(file)
	if file == "" {
		return ""
	}
	line = strings.TrimSpace(line)
	if line == "" || line == "0" {
		return file
	}
	column = strings.TrimSpace(column)
	if column == "" || column == "0" {
		return fmt.Sprintf("%s:%s", file, line)
	}
	return fmt.Sprintf("%s:%s:%s", file, line, column)
}

func buildGosecRawData(issue gosecIssue) map[string]any {
	rawData := map[string]any{
		"type":              "sast",
		"scanner":           "gosec",
		"rule_id":           strings.TrimSpace(issue.RuleID),
		"original_severity": strings.TrimSpace(issue.Severity),
		"confidence":        strings.TrimSpace(issue.Confidence),
		"file":              strings.TrimSpace(issue.File),
	}

	if issue.Line != "" {
		rawData["line"] = issue.Line
	}
	if issue.Column != "" {
		rawData["column"] = issue.Column
	}
	if issue.Code != "" {
		rawData["code"] = issue.Code
	}
	if issue.Details != "" {
		rawData["details"] = issue.Details
	}
	if issue.Nosec != "" {
		rawData["nosec"] = issue.Nosec
	}
	if issue.Suppressions != nil {
		rawData["suppressions"] = issue.Suppressions
	}
	if len(issue.CWE) > 0 {
		rawData["cwe"] = issue.CWE
		// Extract CWE IDs
		cweIDs := make([]string, 0, len(issue.CWE))
		for _, cwe := range issue.CWE {
			if cwe.ID != "" {
				cweIDs = append(cweIDs, "CWE-"+cwe.ID)
			}
		}
		if len(cweIDs) > 0 {
			rawData["cwe_ids"] = cweIDs
		}
	}

	return rawData
}

func buildGosecEvidence(issue gosecIssue) map[string]any {
	evidence := map[string]any{
		"scannerType": "gosec",
		"findingType": "sast",
		"category":    models.CategorySAST,
		"ruleId":      strings.TrimSpace(issue.RuleID),
		"filePath":    strings.TrimSpace(issue.File),
	}

	if issue.Line != "" {
		evidence["startLine"] = issue.Line
	}
	if issue.Column != "" {
		evidence["startCol"] = issue.Column
	}

	if issue.Code != "" {
		evidence["snippet"] = strings.TrimSpace(issue.Code)
	}

	if issue.Details != "" {
		evidence["message"] = strings.TrimSpace(issue.Details)
	}

	if issue.Confidence != "" {
		evidence["confidence"] = strings.ToUpper(strings.TrimSpace(issue.Confidence))
	}

	if issue.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(strings.TrimSpace(issue.Severity))
	}

	if len(issue.CWE) > 0 {
		cweStrings := make([]string, 0, len(issue.CWE))
		for _, cwe := range issue.CWE {
			if cwe.ID != "" {
				cweStrings = append(cweStrings, fmt.Sprintf("CWE-%s: %s", cwe.ID, cwe.URL))
			}
		}
		if len(cweStrings) > 0 {
			evidence["cwe"] = cweStrings
		}
	}

	return evidence
}

var gosecSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapGosecSeverity(raw string) string {
	if v, ok := gosecSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Gosec report structures

type gosecReport struct {
	Issues []gosecIssue          `json:"Issues"`
	Stats  json.RawMessage       `json:"Stats"`
	Errors map[string][]gosecErr `json:"Golang errors"`
}

type gosecIssue struct {
	Severity     string          `json:"severity"`
	Confidence   string          `json:"confidence"`
	CWE          gosecCWEList    `json:"cwe"`
	RuleID       string          `json:"rule_id"`
	Details      string          `json:"details"`
	File         string          `json:"file"`
	Code         string          `json:"code"`
	Line         string          `json:"line"`
	Column       string          `json:"column"`
	Nosec        string          `json:"nosec"`
	Suppressions json.RawMessage `json:"suppressions"`
}

type gosecCWE struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

// gosecCWEList handles both array and single object CWE formats
type gosecCWEList []gosecCWE

func (c *gosecCWEList) UnmarshalJSON(data []byte) error {
	data = []byte(strings.TrimSpace(string(data)))
	if len(data) == 0 || string(data) == "null" {
		*c = nil
		return nil
	}

	// Try array format first
	var arr []gosecCWE
	if err := json.Unmarshal(data, &arr); err == nil {
		*c = arr
		return nil
	}

	// Try single object format
	var single gosecCWE
	if err := json.Unmarshal(data, &single); err == nil {
		if single.ID != "" || single.URL != "" {
			*c = []gosecCWE{single}
		}
		return nil
	}

	// Unknown format, return empty
	*c = nil
	return nil
}

type gosecErr struct {
	Err  string `json:"error"`
	Line int    `json:"line"`
	Col  int    `json:"column"`
}
