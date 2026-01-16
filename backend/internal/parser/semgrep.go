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

	var report semgrepReport
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}

	return len(report.Results) > 0
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
	}
}

type semgrepReport struct {
	Results []semgrepResult `json:"results"`
}

type semgrepResult struct {
	CheckID string `json:"check_id"`
	Path    string `json:"path"`
	Start   struct {
		Line int `json:"line"`
	} `json:"start"`
	Extra semgrepExtra `json:"extra"`
}

type semgrepExtra struct {
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

var semgrepSeverityMap = map[string]string{
	"ERROR":   models.SeverityHigh,
	"WARNING": models.SeverityMedium,
	"INFO":    models.SeverityLow,
}

func mapSemgrepSeverity(raw string) string {
	if v, ok := semgrepSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityLow
}
