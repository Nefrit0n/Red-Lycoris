package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// BanditParser parses Bandit security scanner output for Python code.
// Supports native JSON format.
type BanditParser struct{}

func (p *BanditParser) ScannerType() string { return "bandit" }

func (p *BanditParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		return true
	}

	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// Bandit native format has "results" and "metrics" fields
	if _, hasResults := payload["results"]; !hasResults {
		return false
	}
	if _, hasMetrics := payload["metrics"]; !hasMetrics {
		return false
	}

	return true
}

func (p *BanditParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "bandit")
		if err != nil {
			return nil, err
		}
		// Post-process for bandit SAST
		for i := range findings {
			findings[i].Category = models.CategorySAST
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "bandit"
			findings[i].Evidence["findingType"] = "sast"
			findings[i].Evidence["category"] = models.CategorySAST
		}
		return findings, nil
	}

	var report banditReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse bandit report: %w", err)
	}

	findings := make([]Finding, 0, len(report.Results))
	for _, r := range report.Results {
		findings = append(findings, p.buildFinding(r))
	}
	return findings, nil
}

func (p *BanditParser) buildFinding(r banditResult) Finding {
	// Title: test_id + test_name (e.g., "B301: blacklist_calls")
	title := buildBanditTitle(r.TestID, r.TestName)

	// Location: filename:line_number
	location := buildBanditLocation(r.Filename, r.LineNumber)

	// Description from issue_text
	desc := strings.TrimSpace(r.IssueText)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildBanditRawData(r)
	evidence := buildBanditEvidence(r)

	return Finding{
		Category:    models.CategorySAST,
		Title:       title,
		Description: descPtr,
		Severity:    mapBanditSeverity(r.IssueSeverity),
		Location:    location,
		RuleID:      strings.TrimSpace(r.TestID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildBanditTitle(testID, testName string) string {
	testID = strings.TrimSpace(testID)
	testName = strings.TrimSpace(testName)

	if testID == "" && testName == "" {
		return "bandit finding"
	}
	if testID == "" {
		return testName
	}
	if testName == "" {
		return testID
	}
	return fmt.Sprintf("%s: %s", testID, testName)
}

func buildBanditLocation(filename string, lineNumber int) string {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return ""
	}
	if lineNumber <= 0 {
		return filename
	}
	return fmt.Sprintf("%s:%d", filename, lineNumber)
}

func buildBanditRawData(r banditResult) map[string]any {
	rawData := map[string]any{
		"type":              "sast",
		"scanner":           "bandit",
		"test_id":           strings.TrimSpace(r.TestID),
		"test_name":         strings.TrimSpace(r.TestName),
		"original_severity": strings.TrimSpace(r.IssueSeverity),
		"confidence":        strings.TrimSpace(r.IssueConfidence),
		"filename":          strings.TrimSpace(r.Filename),
	}

	if r.LineNumber > 0 {
		rawData["line_number"] = r.LineNumber
	}
	if len(r.LineRange) > 0 {
		rawData["line_range"] = r.LineRange
	}
	if r.Code != "" {
		rawData["code"] = r.Code
	}
	if r.MoreInfo != "" {
		rawData["more_info"] = r.MoreInfo
	}
	if r.IssueCWE != nil {
		rawData["cwe_id"] = r.IssueCWE.ID
		rawData["cwe_link"] = r.IssueCWE.Link
		rawData["cwe"] = []string{fmt.Sprintf("CWE-%d", r.IssueCWE.ID)}
	}

	return rawData
}

func buildBanditEvidence(r banditResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "bandit",
		"findingType": "sast",
		"category":    models.CategorySAST,
		"ruleId":      strings.TrimSpace(r.TestID),
		"filePath":    strings.TrimSpace(r.Filename),
	}

	if r.LineNumber > 0 {
		evidence["startLine"] = r.LineNumber
	}
	if len(r.LineRange) > 0 {
		evidence["lineRange"] = r.LineRange
		if len(r.LineRange) >= 2 {
			evidence["endLine"] = r.LineRange[len(r.LineRange)-1]
		}
	}

	if r.Code != "" {
		evidence["snippet"] = strings.TrimSpace(r.Code)
	}

	if msg := strings.TrimSpace(r.IssueText); msg != "" {
		evidence["message"] = msg
	}

	if r.IssueConfidence != "" {
		evidence["confidence"] = strings.ToUpper(strings.TrimSpace(r.IssueConfidence))
	}

	if r.IssueSeverity != "" {
		evidence["severityRaw"] = strings.ToUpper(strings.TrimSpace(r.IssueSeverity))
	}

	if r.MoreInfo != "" {
		evidence["primaryUrl"] = r.MoreInfo
		evidence["references"] = []string{r.MoreInfo}
	}

	if r.IssueCWE != nil {
		cweStr := fmt.Sprintf("CWE-%d", r.IssueCWE.ID)
		evidence["cwe"] = []string{cweStr}
		if r.IssueCWE.Link != "" {
			refs, _ := evidence["references"].([]string)
			if refs == nil {
				refs = []string{}
			}
			evidence["references"] = append(refs, r.IssueCWE.Link)
		}
	}

	if r.TestName != "" {
		evidence["testName"] = strings.TrimSpace(r.TestName)
	}

	return evidence
}

var banditSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapBanditSeverity(raw string) string {
	if v, ok := banditSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityLow
}

// Bandit report structures

type banditReport struct {
	Errors      []json.RawMessage `json:"errors"`
	GeneratedAt string            `json:"generated_at"`
	Metrics     json.RawMessage   `json:"metrics"`
	Results     []banditResult    `json:"results"`
}

type banditResult struct {
	Code            string     `json:"code"`
	Filename        string     `json:"filename"`
	IssueConfidence string     `json:"issue_confidence"`
	IssueSeverity   string     `json:"issue_severity"`
	IssueCWE        *banditCWE `json:"issue_cwe"`
	IssueText       string     `json:"issue_text"`
	LineNumber      int        `json:"line_number"`
	LineRange       []int      `json:"line_range"`
	MoreInfo        string     `json:"more_info"`
	TestName        string     `json:"test_name"`
	TestID          string     `json:"test_id"`
}

type banditCWE struct {
	ID   int    `json:"id"`
	Link string `json:"link"`
}
