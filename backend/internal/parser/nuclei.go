package parser

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"red-lycoris/backend/internal/models"
)

// NucleiParser parses Nuclei vulnerability scanner output.
// Supports JSON and JSONL (newline-delimited JSON) formats.
type NucleiParser struct{}

func (p *NucleiParser) ScannerType() string { return "nuclei" }

func (p *NucleiParser) CanParse(data []byte) bool {
	// Try JSON array first
	if json.Valid(data) {
		var results []nucleiResult
		if err := json.Unmarshal(data, &results); err == nil {
			if len(results) > 0 && (results[0].TemplateID != "" || results[0].Info.Name != "") {
				return true
			}
		}
	}

	// Try JSONL (each line is a JSON object)
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var result nucleiResult
		if err := json.Unmarshal([]byte(line), &result); err == nil {
			if result.TemplateID != "" || result.Info.Name != "" {
				return true
			}
		}
		break // Only check first non-empty line
	}

	return false
}

func (p *NucleiParser) Parse(data []byte) ([]Finding, error) {
	var results []nucleiResult

	// Try JSON array first
	if json.Valid(data) {
		if err := json.Unmarshal(data, &results); err == nil && len(results) > 0 {
			return p.buildFindings(results)
		}
	}

	// Try JSONL
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var result nucleiResult
		if err := json.Unmarshal([]byte(line), &result); err != nil {
			continue // Skip invalid lines
		}
		results = append(results, result)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to parse nuclei report: %w", err)
	}

	return p.buildFindings(results)
}

func (p *NucleiParser) buildFindings(results []nucleiResult) ([]Finding, error) {
	findings := make([]Finding, 0, len(results))
	for _, r := range results {
		findings = append(findings, p.buildFinding(r))
	}
	return findings, nil
}

func (p *NucleiParser) buildFinding(r nucleiResult) Finding {
	// Title from template info
	title := buildNucleiTitle(r)

	// Location: matched URL/host
	location := buildNucleiLocation(r)

	// Description
	desc := strings.TrimSpace(r.Info.Description)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildNucleiRawData(r)
	evidence := buildNucleiEvidence(r)

	return Finding{
		Category:    models.CategoryDAST,
		Title:       title,
		Description: descPtr,
		Severity:    mapNucleiSeverity(r.Info.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(r.TemplateID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildNucleiTitle(r nucleiResult) string {
	if r.Info.Name != "" {
		return strings.TrimSpace(r.Info.Name)
	}
	if r.TemplateID != "" {
		return strings.TrimSpace(r.TemplateID)
	}
	return "Nuclei finding"
}

func buildNucleiLocation(r nucleiResult) string {
	if r.MatchedURL != "" {
		return r.MatchedURL
	}
	if r.Matched != "" {
		return r.Matched
	}
	if r.Host != "" {
		return r.Host
	}
	return ""
}

func buildNucleiRawData(r nucleiResult) map[string]any {
	rawData := map[string]any{
		"type":              "dast",
		"scanner":           "nuclei",
		"template_id":       r.TemplateID,
		"original_severity": r.Info.Severity,
	}

	if r.Info.Name != "" {
		rawData["template_name"] = r.Info.Name
	}
	if r.Host != "" {
		rawData["host"] = r.Host
	}
	if r.Matched != "" {
		rawData["matched"] = r.Matched
	}
	if r.MatchedURL != "" {
		rawData["matched_url"] = r.MatchedURL
	}
	if r.IP != "" {
		rawData["ip"] = r.IP
	}
	if r.Type != "" {
		rawData["protocol"] = r.Type
	}
	if r.Timestamp != "" {
		rawData["timestamp"] = r.Timestamp
	}

	if len(r.Info.Tags) > 0 {
		rawData["tags"] = r.Info.Tags
	}
	if len(r.Info.Reference) > 0 {
		rawData["references"] = r.Info.Reference
	}
	if r.Info.Classification.CVEID != "" {
		rawData["cve"] = r.Info.Classification.CVEID
	}
	if r.Info.Classification.CWEID != "" {
		rawData["cwe"] = r.Info.Classification.CWEID
	}
	if r.Info.Classification.CVSSMetrics != "" {
		rawData["cvss_metrics"] = r.Info.Classification.CVSSMetrics
	}
	if r.Info.Classification.CVSSScore > 0 {
		rawData["cvss_score"] = r.Info.Classification.CVSSScore
	}

	if len(r.ExtractedResults) > 0 {
		rawData["extracted_results"] = r.ExtractedResults
	}
	if r.CurlCommand != "" {
		rawData["curl_command"] = r.CurlCommand
	}

	if r.Request != "" {
		rawData["request"] = r.Request
	}
	if r.Response != "" {
		// Truncate long responses
		resp := r.Response
		if len(resp) > 5000 {
			resp = resp[:5000] + "...[truncated]"
		}
		rawData["response"] = resp
	}

	return rawData
}

func buildNucleiEvidence(r nucleiResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "nuclei",
		"findingType": "dast",
		"category":    models.CategoryDAST,
		"ruleId":      r.TemplateID,
	}

	if r.Host != "" {
		evidence["host"] = r.Host
	}
	if r.MatchedURL != "" {
		evidence["uri"] = r.MatchedURL
	} else if r.Matched != "" {
		evidence["uri"] = r.Matched
	}

	if r.IP != "" {
		evidence["ip"] = r.IP
	}

	if r.Type != "" {
		evidence["protocol"] = r.Type
	}

	if r.Info.Name != "" {
		evidence["message"] = r.Info.Name
	}

	if r.Info.Severity != "" {
		evidence["severityRaw"] = r.Info.Severity
	}

	if len(r.Info.Tags) > 0 {
		evidence["tags"] = r.Info.Tags
	}

	if len(r.Info.Reference) > 0 {
		evidence["references"] = r.Info.Reference
	}

	// Classification
	if r.Info.Classification.CVEID != "" {
		evidence["cve"] = []string{r.Info.Classification.CVEID}
	}
	if r.Info.Classification.CWEID != "" {
		evidence["cwe"] = []string{r.Info.Classification.CWEID}
	}
	if r.Info.Classification.CVSSScore > 0 {
		evidence["cvssScore"] = r.Info.Classification.CVSSScore
	}

	if len(r.ExtractedResults) > 0 {
		evidence["extractedResults"] = r.ExtractedResults
	}

	if r.MatcherName != "" {
		evidence["matcherName"] = r.MatcherName
	}

	return evidence
}

var nucleiSeverityMap = map[string]string{
	"INFO":     models.SeverityLow,
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
	"UNKNOWN":  models.SeverityLow,
}

func mapNucleiSeverity(raw string) string {
	if v, ok := nucleiSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Nuclei result structures

type nucleiResult struct {
	TemplateID       string     `json:"template-id"`
	Info             nucleiInfo `json:"info"`
	Type             string     `json:"type"`
	Host             string     `json:"host"`
	Matched          string     `json:"matched"`
	MatchedURL       string     `json:"matched-at"`
	IP               string     `json:"ip"`
	Timestamp        string     `json:"timestamp"`
	CurlCommand      string     `json:"curl-command"`
	MatcherName      string     `json:"matcher-name"`
	ExtractedResults []string   `json:"extracted-results"`
	Request          string     `json:"request"`
	Response         string     `json:"response"`
}

type nucleiInfo struct {
	Name           string               `json:"name"`
	Author         json.RawMessage      `json:"author"` // can be string or []string
	Tags           []string             `json:"tags"`
	Description    string               `json:"description"`
	Reference      []string             `json:"reference"`
	Severity       string               `json:"severity"`
	Classification nucleiClassification `json:"classification"`
	Metadata       json.RawMessage      `json:"metadata"`
}

type nucleiClassification struct {
	CVEID       string  `json:"cve-id"`
	CWEID       string  `json:"cwe-id"`
	CVSSMetrics string  `json:"cvss-metrics"`
	CVSSScore   float64 `json:"cvss-score"`
}
