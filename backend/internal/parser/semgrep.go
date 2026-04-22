package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"redlycoris/internal/domain"
)

type semgrepReport struct {
	Results []semgrepResult `json:"results"`
}

type semgrepResult struct {
	CheckID string `json:"check_id"`
	Path    string `json:"path"`
	Start   struct {
		Line int `json:"line"`
	} `json:"start"`
	End struct {
		Line int `json:"line"`
	} `json:"end"`
	Extra struct {
		Message  string `json:"message"`
		Severity string `json:"severity"`
		Lines    string `json:"lines"`
		Metadata struct {
			CWE        any    `json:"cwe"`
			Confidence string `json:"confidence"`
		} `json:"metadata"`
	} `json:"extra"`
}

type SemgrepParser struct{}

func (p *SemgrepParser) CanParse(data []byte) bool {
	var probe struct {
		Results []struct {
			CheckID string `json:"check_id"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	return len(probe.Results) > 0 && strings.TrimSpace(probe.Results[0].CheckID) != ""
}

func (p *SemgrepParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report semgrepReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.SemgrepParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report.Results))
	for _, result := range report.Results {
		message := strings.TrimSpace(result.Extra.Message)
		title := firstLine(message)
		ruleID := strings.TrimSpace(result.CheckID)
		if title == "" {
			title = ruleID
		}

		severity := mapSemgrepSeverity(result.Extra.Severity, result.Extra.Metadata.Confidence)
		codeSnippet := emptyToNil(result.Extra.Lines)
		ruleIDPtr := emptyToNil(ruleID)
		ruleNamePtr := emptyToNil(firstLine(message))

		f := domain.Finding{
			Kind:        domain.KindSAST,
			Title:       title,
			Description: message,
			Severity:    severity,
			Confidence:  mapSemgrepConfidence(result.Extra.Metadata.Confidence),
			Status:      domain.StatusOpen,
			FilePath:    strings.TrimSpace(result.Path),
			LineStart:   result.Start.Line,
			LineEnd:     result.End.Line,
			RuleID:      ruleIDPtr,
			RuleName:    ruleNamePtr,
			CodeSnippet: codeSnippet,
			CWEIDs:      extractSemgrepCWEIDs(result.Extra.Metadata.CWE),
			CVEIDs:      []string{},
			SourceType:  "semgrep",
		}
		f.Fingerprint = domain.CalculateFingerprint(&f)
		findings = append(findings, f)
	}

	return findings, nil
}

func mapSemgrepSeverity(severity, confidence string) int {
	s := strings.ToUpper(strings.TrimSpace(severity))
	c := strings.ToUpper(strings.TrimSpace(confidence))

	switch s {
	case "INFO":
		return domain.SeverityLow
	case "WARNING":
		return domain.SeverityMedium
	case "ERROR":
		if c == "HIGH" {
			return domain.SeverityCritical
		}
		return domain.SeverityHigh
	default:
		return domain.SeverityInfo
	}
}

func mapSemgrepConfidence(confidence string) int {
	switch strings.ToUpper(strings.TrimSpace(confidence)) {
	case "HIGH":
		return 3
	case "MEDIUM":
		return 2
	case "LOW":
		return 1
	default:
		return 0
	}
}

func extractSemgrepCWEIDs(raw any) []int {
	pattern := regexp.MustCompile(`CWE-(\d+)`)
	ids := []int{}

	for _, text := range semgrepRawToStrings(raw) {
		matches := pattern.FindAllStringSubmatch(strings.ToUpper(text), -1)
		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			if id, err := strconv.Atoi(match[1]); err == nil {
				ids = append(ids, id)
			}
		}
	}
	return ids
}

func semgrepRawToStrings(raw any) []string {
	switch v := raw.(type) {
	case string:
		return []string{v}
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if idx := strings.IndexByte(s, '\n'); idx >= 0 {
		return strings.TrimSpace(s[:idx])
	}
	return s
}
