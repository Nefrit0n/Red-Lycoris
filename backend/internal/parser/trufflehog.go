package parser

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"red-lycoris/backend/internal/models"
)

// TruffleHogParser parses TruffleHog secret scanner output (v3 format).
// Supports JSON format.
type TruffleHogParser struct{}

func (p *TruffleHogParser) ScannerType() string { return "trufflehog" }

func (p *TruffleHogParser) CanParse(data []byte) bool {
	if !json.Valid(data) {
		return false
	}

	// TruffleHog v3 outputs an array of findings
	var results []truffleHogResult
	if err := json.Unmarshal(data, &results); err != nil {
		return false
	}

	// Check if it looks like trufflehog output
	if len(results) == 0 {
		// Empty array could be valid
		return true
	}

	// Check for trufflehog-specific fields (rule object)
	first := results[0]
	return first.Rule.ID != "" || first.Path != "" || first.Secret != ""
}

func (p *TruffleHogParser) Parse(data []byte) ([]Finding, error) {
	var results []truffleHogResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, fmt.Errorf("failed to parse trufflehog report: %w", err)
	}

	findings := make([]Finding, 0, len(results))
	for _, r := range results {
		findings = append(findings, p.buildFinding(r))
	}
	return findings, nil
}

func (p *TruffleHogParser) buildFinding(r truffleHogResult) Finding {
	// Title from rule message or id
	title := buildTruffleHogTitle(r.Rule)

	// Location: path:line
	location := buildTruffleHogLocation(r.Path, r.Line)

	// Description
	desc := buildTruffleHogDescription(r)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildTruffleHogRawData(r)
	evidence := buildTruffleHogEvidence(r)

	return Finding{
		Category:    models.CategorySecrets,
		Title:       title,
		Description: descPtr,
		Severity:    mapTruffleHogSeverity(r.Rule.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(r.Rule.ID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildTruffleHogTitle(rule truffleHogRule) string {
	if rule.Message != "" {
		return strings.TrimSpace(rule.Message)
	}
	if rule.ID != "" {
		return formatRuleID(rule.ID)
	}
	return "Secret detected"
}

func buildTruffleHogLocation(path, line string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	line = strings.TrimSpace(line)
	if line == "" || line == "0" {
		return path
	}
	return fmt.Sprintf("%s:%s", path, line)
}

func buildTruffleHogDescription(r truffleHogResult) string {
	parts := []string{}

	if r.Rule.Message != "" && r.Rule.ID != "" {
		parts = append(parts, fmt.Sprintf("Rule: %s", r.Rule.ID))
	}

	if r.Commit != "" {
		commitLen := len(r.Commit)
		if commitLen > 8 {
			commitLen = 8
		}
		parts = append(parts, fmt.Sprintf("Commit: %s", r.Commit[:commitLen]))
	}

	if r.Author != "" {
		parts = append(parts, fmt.Sprintf("Author: %s", r.Author))
	}

	if r.Branch != "" {
		parts = append(parts, fmt.Sprintf("Branch: %s", r.Branch))
	}

	return strings.Join(parts, ". ")
}

func buildTruffleHogRawData(r truffleHogResult) map[string]any {
	rawData := map[string]any{
		"type":              "secret",
		"scanner":           "trufflehog",
		"rule_id":           strings.TrimSpace(r.Rule.ID),
		"rule_message":      strings.TrimSpace(r.Rule.Message),
		"path":              strings.TrimSpace(r.Path),
		"original_severity": strings.TrimSpace(r.Rule.Severity),
	}

	if r.Line != "" {
		if lineNum, err := strconv.Atoi(r.Line); err == nil && lineNum > 0 {
			rawData["line"] = lineNum
		} else {
			rawData["line_raw"] = r.Line
		}
	}

	if r.Rule.Pattern != "" {
		rawData["pattern"] = r.Rule.Pattern
	}

	if r.ID != "" {
		rawData["finding_id"] = r.ID
	}

	if r.Commit != "" {
		rawData["commit"] = r.Commit
	}

	if r.Branch != "" {
		rawData["branch"] = r.Branch
	}

	if r.Author != "" {
		rawData["author"] = r.Author
	}

	if r.Message != "" {
		rawData["commit_message"] = r.Message
	}

	if r.Date != "" {
		rawData["date"] = r.Date
	}

	if len(r.Context) > 0 {
		rawData["context"] = r.Context
	}

	return rawData
}

func buildTruffleHogEvidence(r truffleHogResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "trufflehog",
		"findingType": "secret",
		"category":    models.CategorySecrets,
		"ruleId":      strings.TrimSpace(r.Rule.ID),
		"filePath":    strings.TrimSpace(r.Path),
	}

	if r.Line != "" {
		if lineNum, err := strconv.Atoi(r.Line); err == nil && lineNum > 0 {
			evidence["startLine"] = lineNum
		}
	}

	if r.Rule.Message != "" {
		evidence["message"] = r.Rule.Message
	}

	if r.Rule.Severity != "" {
		evidence["severityRaw"] = strings.ToUpper(r.Rule.Severity)
	}

	// Redact the secret but show context
	if len(r.Context) > 0 {
		redactedContext := make(map[string]string)
		for lineNum, content := range r.Context {
			if r.Secret != "" && strings.Contains(content, r.Secret) {
				secretLen := len(r.Secret)
				if secretLen > 8 {
					secretLen = 8
				}
				redacted := strings.Repeat("*", secretLen) + "..."
				redactedContext[lineNum] = strings.Replace(content, r.Secret, redacted, 1)
			} else {
				redactedContext[lineNum] = content
			}
		}
		evidence["context"] = redactedContext
	}

	// Git metadata
	if r.Commit != "" {
		evidence["commit"] = r.Commit
	}
	if r.Branch != "" {
		evidence["branch"] = r.Branch
	}
	if r.Author != "" {
		evidence["author"] = r.Author
	}
	if r.Message != "" {
		evidence["commitMessage"] = r.Message
	}
	if r.Date != "" {
		evidence["date"] = r.Date
	}

	if r.ID != "" {
		evidence["findingId"] = r.ID
	}

	return evidence
}

var truffleHogSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapTruffleHogSeverity(raw string) string {
	if v, ok := truffleHogSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	// Default to high for secrets
	return models.SeverityHigh
}

// TruffleHog v3 report structures

type truffleHogResult struct {
	Rule    truffleHogRule    `json:"rule"`
	Path    string            `json:"path"`
	Line    string            `json:"line"`
	Secret  string            `json:"secret"`
	Context map[string]string `json:"context"`
	ID      string            `json:"id"`
	Branch  string            `json:"branch"`
	Message string            `json:"message"`
	Author  string            `json:"author"`
	Commit  string            `json:"commit"`
	Date    string            `json:"date"`
}

type truffleHogRule struct {
	ID       string `json:"id"`
	Message  string `json:"message"`
	Pattern  string `json:"pattern"`
	Severity string `json:"severity"`
}
