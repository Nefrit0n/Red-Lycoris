package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// KICSParser parses KICS (Keeping Infrastructure as Code Secure) output.
// Supports JSON format.
type KICSParser struct{}

func (p *KICSParser) ScannerType() string { return "kics" }

func (p *KICSParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "kics") {
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

	// KICS format has "queries" and "severity_counters"
	if _, hasQueries := payload["queries"]; !hasQueries {
		return false
	}

	return true
}

func (p *KICSParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "kics")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategoryIAC
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "kics"
			findings[i].Evidence["findingType"] = "iac"
		}
		return findings, nil
	}

	var report kicsReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse kics report: %w", err)
	}

	var findings []Finding
	for _, query := range report.Queries {
		for _, file := range query.Files {
			findings = append(findings, p.buildFinding(query, file))
		}
	}

	return findings, nil
}

func (p *KICSParser) buildFinding(query kicsQuery, file kicsFile) Finding {
	// Title: query_name or query_id
	title := query.QueryName
	if title == "" {
		title = query.QueryID
	}

	// Location: file_name:line
	location := file.FileName
	if file.Line > 0 {
		location = fmt.Sprintf("%s:%d", file.FileName, file.Line)
	}

	// Description
	desc := query.Description
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildKICSRawData(query, file)
	evidence := buildKICSEvidence(query, file)

	return Finding{
		Category:    models.CategoryIAC,
		Title:       title,
		Description: descPtr,
		Severity:    mapKICSSeverity(query.Severity),
		Location:    location,
		RuleID:      query.QueryID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildKICSRawData(query kicsQuery, file kicsFile) map[string]any {
	rawData := map[string]any{
		"type":              "iac",
		"scanner":           "kics",
		"query_id":          query.QueryID,
		"query_name":        query.QueryName,
		"query_url":         query.QueryURL,
		"original_severity": query.Severity,
		"category":          query.Category,
		"platform":          query.Platform,
		"file_name":         file.FileName,
	}

	if file.Line > 0 {
		rawData["line"] = file.Line
	}
	if file.IssueType != "" {
		rawData["issue_type"] = file.IssueType
	}
	if file.SearchKey != "" {
		rawData["search_key"] = file.SearchKey
	}
	if file.SearchLine > 0 {
		rawData["search_line"] = file.SearchLine
	}
	if file.SearchValue != "" {
		rawData["search_value"] = file.SearchValue
	}
	if file.ExpectedValue != "" {
		rawData["expected_value"] = file.ExpectedValue
	}
	if file.ActualValue != "" {
		rawData["actual_value"] = file.ActualValue
	}
	if file.ResourceType != "" {
		rawData["resource_type"] = file.ResourceType
	}
	if file.ResourceName != "" {
		rawData["resource_name"] = file.ResourceName
	}
	if query.CISDescriptionID != "" {
		rawData["cis_description_id"] = query.CISDescriptionID
	}
	if query.CISDescriptionText != "" {
		rawData["cis_description_text"] = query.CISDescriptionText
	}

	return rawData
}

func buildKICSEvidence(query kicsQuery, file kicsFile) map[string]any {
	evidence := map[string]any{
		"scannerType": "kics",
		"findingType": "iac",
		"category":    models.CategoryIAC,
		"ruleId":      query.QueryID,
		"filePath":    file.FileName,
	}

	if file.Line > 0 {
		evidence["startLine"] = file.Line
	}

	if query.QueryName != "" {
		evidence["message"] = query.QueryName
	}

	if query.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(query.Severity)
	}

	if query.Category != "" {
		evidence["queryCategory"] = query.Category
	}
	if query.Platform != "" {
		evidence["platform"] = query.Platform
	}

	if file.ResourceType != "" {
		evidence["resourceType"] = file.ResourceType
	}
	if file.ResourceName != "" {
		evidence["resourceName"] = file.ResourceName
	}

	if file.ExpectedValue != "" {
		evidence["expectedValue"] = file.ExpectedValue
	}
	if file.ActualValue != "" {
		evidence["actualValue"] = file.ActualValue
	}

	if query.QueryURL != "" {
		evidence["primaryUrl"] = query.QueryURL
		evidence["references"] = []string{query.QueryURL}
	}

	return evidence
}

var kicsSeverityMap = map[string]string{
	"INFO":     models.SeverityLow,
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapKICSSeverity(raw string) string {
	if v, ok := kicsSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// KICS report structures

type kicsReport struct {
	KICSVersion      string          `json:"kics_version"`
	ScanID           string          `json:"scan_id"`
	SeverityCounters json.RawMessage `json:"severity_counters"`
	FilesScanned     int             `json:"files_scanned"`
	LinesScanned     int             `json:"lines_scanned"`
	FilesFailedScan  int             `json:"files_failed_to_scan"`
	Queries          []kicsQuery     `json:"queries"`
	Start            string          `json:"start"`
	End              string          `json:"end"`
}

type kicsQuery struct {
	QueryID            string     `json:"query_id"`
	QueryName          string     `json:"query_name"`
	QueryURL           string     `json:"query_url"`
	Severity           string     `json:"severity"`
	Category           string     `json:"category"`
	Platform           string     `json:"platform"`
	Description        string     `json:"description"`
	CISDescriptionID   string     `json:"cis_description_id"`
	CISDescriptionText string     `json:"cis_description_text"`
	Files              []kicsFile `json:"files"`
}

type kicsFile struct {
	FileName      string `json:"file_name"`
	SimilarityID  string `json:"similarity_id"`
	Line          int    `json:"line"`
	IssueType     string `json:"issue_type"`
	SearchKey     string `json:"search_key"`
	SearchLine    int    `json:"search_line"`
	SearchValue   string `json:"search_value"`
	ExpectedValue string `json:"expected_value"`
	ActualValue   string `json:"actual_value"`
	ResourceType  string `json:"resource_type"`
	ResourceName  string `json:"resource_name"`
}
