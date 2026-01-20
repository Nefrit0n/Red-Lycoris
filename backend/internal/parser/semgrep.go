package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

type SemgrepParser struct{}

func (p *SemgrepParser) ScannerType() string {
	return "semgrep"
}

func (p *SemgrepParser) CanParse(data []byte) bool {
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

	if _, ok := payload["results"]; !ok {
		return false
	}
	if _, ok := payload["paths"]; !ok {
		return false
	}
	return true
}

func (p *SemgrepParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "semgrep")
	}

	var report semgrepReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := make([]Finding, 0, len(report.Results))
	for _, r := range report.Results {
		findings = append(findings, p.buildFinding(r))
	}

	return findings, nil
}

func (p *SemgrepParser) buildFinding(r semgrepResult) Finding {
	location := strings.TrimSpace(r.Path)
	if r.Start.Line > 0 {
		location = fmt.Sprintf("%s:%d", location, r.Start.Line)
	}

	desc := strings.TrimSpace(r.Extra.Message)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	evidence := buildSemgrepEvidence(r)

	return Finding{
		Title:       r.CheckID,
		Description: descPtr,
		Severity:    mapSemgrepSeverity(r.Extra.Severity),
		Location:    location,
		RuleID:      r.CheckID,
		RawData: map[string]any{
			"path":              r.Path,
			"original_severity": r.Extra.Severity,
		},
		Evidence: evidence,
	}
}

type semgrepReport struct {
	Results []semgrepResult `json:"results"`
	Paths   json.RawMessage `json:"paths"`
	Errors  json.RawMessage `json:"errors"`
}

type semgrepResult struct {
	CheckID string `json:"check_id"`
	Path    string `json:"path"`
	Start   struct {
		Line int `json:"line"`
		Col  int `json:"col"`
	} `json:"start"`
	End struct {
		Line int `json:"line"`
		Col  int `json:"col"`
	} `json:"end"`
	Extra semgrepExtra `json:"extra"`
}

type semgrepExtra struct {
	Message  string          `json:"message"`
	Severity string          `json:"severity"`
	Lines    json.RawMessage `json:"lines"`
	Metadata json.RawMessage `json:"metadata"`
}

var semgrepSeverityMap = map[string]string{
	"ERROR":    models.SeverityHigh,
	"WARNING":  models.SeverityMedium,
	"INFO":     models.SeverityLow,
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapSemgrepSeverity(raw string) string {
	if v, ok := semgrepSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityLow
}

func buildSemgrepEvidence(r semgrepResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "semgrep",
		"ruleId":      strings.TrimSpace(r.CheckID),
		"path":        strings.TrimSpace(r.Path),
		"severityRaw": strings.TrimSpace(r.Extra.Severity),
	}

	if message := strings.TrimSpace(r.Extra.Message); message != "" {
		evidence["message"] = message
	}

	if r.Start.Line > 0 || r.Start.Col > 0 {
		start := map[string]any{}
		if r.Start.Line > 0 {
			start["line"] = r.Start.Line
		}
		if r.Start.Col > 0 {
			start["col"] = r.Start.Col
		}
		evidence["start"] = start
	}
	if r.End.Line > 0 || r.End.Col > 0 {
		end := map[string]any{}
		if r.End.Line > 0 {
			end["line"] = r.End.Line
		}
		if r.End.Col > 0 {
			end["col"] = r.End.Col
		}
		evidence["end"] = end
	}

	if snippet := semgrepLinesToSnippet(r.Extra.Lines); snippet != "" {
		evidence["code"] = snippet
	}

	if len(r.Extra.Metadata) > 0 && string(r.Extra.Metadata) != "null" {
		evidence["metadata"] = json.RawMessage(r.Extra.Metadata)
	}

	for key, value := range evidence {
		if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
			delete(evidence, key)
		}
	}

	return evidence
}

func semgrepLinesToSnippet(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(strings.ToLower(trimmed), "requires login") {
		return ""
	}
	return trimmed
}
