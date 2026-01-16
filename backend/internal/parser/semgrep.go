package parser

import (
	"encoding/json"
	"fmt"
	"strings"
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
	var report struct {
		Results []any `json:"results"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}
	return len(report.Results) > 0
}

func (p *SemgrepParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "semgrep")
	}
	var report struct {
		Results []struct {
			CheckID string `json:"check_id"`
			Path    string `json:"path"`
			Start   struct {
				Line int `json:"line"`
			} `json:"start"`
			Extra struct {
				Message  string `json:"message"`
				Severity string `json:"severity"`
			} `json:"extra"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := []Finding{}
	for _, result := range report.Results {
		location := strings.TrimSpace(result.Path)
		if result.Start.Line > 0 {
			location = fmt.Sprintf("%s:%d", location, result.Start.Line)
		}
		desc := strings.TrimSpace(result.Extra.Message)
		var descPtr *string
		if desc != "" {
			descPtr = &desc
		}
		findings = append(findings, Finding{
			Title:       result.CheckID,
			Description: descPtr,
			Severity:    result.Extra.Severity,
			Location:    location,
			RuleID:      result.CheckID,
			RawData: map[string]any{
				"path": result.Path,
			},
		})
	}
	return findings, nil
}
