package parser

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"lotus-warden/backend/internal/models"
)

// CodeQLParser parses CodeQL SARIF and CSV output.
type CodeQLParser struct{}

func (p *CodeQLParser) ScannerType() string { return "codeql" }

func (p *CodeQLParser) CanParse(data []byte) bool {
	// Check for CSV format first
	if p.isCSV(data) {
		return true
	}

	if !canParseSarif(data) {
		return false
	}

	// Check if it's specifically CodeQL SARIF
	var sarif sarifReport
	if err := json.Unmarshal(data, &sarif); err != nil {
		return false
	}

	for _, run := range sarif.Runs {
		toolName := strings.ToLower(run.Tool.Driver.Name)
		if strings.Contains(toolName, "codeql") {
			return true
		}
	}

	return false
}

func (p *CodeQLParser) isCSV(data []byte) bool {
	// Check if data looks like CSV (starts with header line containing codeql-like columns)
	if len(data) == 0 {
		return false
	}

	// Quick check: CSV usually doesn't start with { or [
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[') {
		return false
	}

	reader := csv.NewReader(bytes.NewReader(data))
	headers, err := reader.Read()
	if err != nil || len(headers) < 3 {
		return false
	}

	// Check for CodeQL CSV headers (case-insensitive)
	headerMap := make(map[string]bool)
	for _, h := range headers {
		headerMap[strings.ToLower(strings.TrimSpace(h))] = true
	}

	// CodeQL CSV typically has these columns
	hasName := headerMap["name"] || headerMap["query name"]
	hasPath := headerMap["path"] || headerMap["file"]
	hasSeverity := headerMap["severity"]
	hasMessage := headerMap["message"]

	return hasPath && (hasMessage || hasName || hasSeverity)
}

func (p *CodeQLParser) Parse(data []byte) ([]Finding, error) {
	// Try CSV first
	if p.isCSV(data) {
		return p.parseCSV(data)
	}

	findings, err := parseSarif(data, "codeql")
	if err != nil {
		return nil, err
	}

	// Post-process findings to set correct category and enhance evidence
	for i := range findings {
		findings[i].Category = models.CategorySAST
		if findings[i].Evidence == nil {
			findings[i].Evidence = map[string]any{}
		}
		findings[i].Evidence["scannerType"] = "codeql"
		findings[i].Evidence["findingType"] = "sast"
		findings[i].Evidence["category"] = models.CategorySAST
	}

	return findings, nil
}

func (p *CodeQLParser) parseCSV(data []byte) ([]Finding, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse codeql CSV: %w", err)
	}

	if len(records) < 2 {
		return []Finding{}, nil // Empty or header-only
	}

	// Build header index
	headers := records[0]
	headerIdx := make(map[string]int)
	for i, h := range headers {
		headerIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	var findings []Finding
	for _, row := range records[1:] {
		finding := p.parseCSVRow(row, headerIdx)
		if finding.Title != "" {
			findings = append(findings, finding)
		}
	}

	return findings, nil
}

func (p *CodeQLParser) parseCSVRow(row []string, headerIdx map[string]int) Finding {
	get := func(key string) string {
		if idx, ok := headerIdx[key]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	getInt := func(key string) int {
		if s := get(key); s != "" {
			if v, err := strconv.Atoi(s); err == nil {
				return v
			}
		}
		return 0
	}

	// Try different column name variants
	name := get("name")
	if name == "" {
		name = get("query name")
	}
	if name == "" {
		name = get("rule")
	}

	message := get("message")
	description := get("description")
	severity := get("severity")
	path := get("path")
	if path == "" {
		path = get("file")
	}

	startLine := getInt("start_line")
	if startLine == 0 {
		startLine = getInt("startline")
	}
	if startLine == 0 {
		startLine = getInt("line")
	}

	// Build title
	title := name
	if title == "" && message != "" {
		if len(message) > 80 {
			title = message[:77] + "..."
		} else {
			title = message
		}
	}
	if title == "" {
		title = "CodeQL finding"
	}

	// Build location
	location := path
	if startLine > 0 && path != "" {
		location = fmt.Sprintf("%s:%d", path, startLine)
	}

	// Description
	var descPtr *string
	if description != "" {
		descPtr = &description
	} else if message != "" && message != title {
		descPtr = &message
	}

	rawData := map[string]any{
		"type":    "sast",
		"scanner": "codeql",
	}
	if name != "" {
		rawData["name"] = name
	}
	if message != "" {
		rawData["message"] = message
	}
	if path != "" {
		rawData["path"] = path
	}
	if startLine > 0 {
		rawData["start_line"] = startLine
	}

	evidence := map[string]any{
		"scannerType": "codeql",
		"findingType": "sast",
		"category":    models.CategorySAST,
	}
	if path != "" {
		evidence["filePath"] = path
	}
	if startLine > 0 {
		evidence["startLine"] = startLine
	}
	if message != "" {
		evidence["message"] = message
	}

	return Finding{
		Category:    models.CategorySAST,
		Title:       title,
		Description: descPtr,
		Severity:    mapCodeQLSeverity(severity),
		Location:    location,
		RuleID:      name,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

var codeqlSeverityMap = map[string]string{
	"ERROR":       models.SeverityHigh,
	"WARNING":     models.SeverityMedium,
	"NOTE":        models.SeverityLow,
	"INFORMATION": models.SeverityLow,
	"RECOMMENDATION": models.SeverityLow,
	"HIGH":        models.SeverityHigh,
	"MEDIUM":      models.SeverityMedium,
	"LOW":         models.SeverityLow,
	"CRITICAL":    models.SeverityCritical,
}

func mapCodeQLSeverity(raw string) string {
	if v, ok := codeqlSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}
