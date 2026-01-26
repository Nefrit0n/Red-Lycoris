package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// GitleaksParser parses Gitleaks secret scanner output.
// Supports native JSON format and SARIF.
type GitleaksParser struct{}

func (p *GitleaksParser) ScannerType() string { return "gitleaks" }

func (p *GitleaksParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		return true
	}

	if !json.Valid(data) {
		return false
	}

	// Gitleaks outputs an array of findings
	var results []gitleaksResult
	if err := json.Unmarshal(data, &results); err != nil {
		return false
	}

	// Check if it looks like gitleaks output
	if len(results) == 0 {
		// Empty array is valid gitleaks output
		return true
	}

	// Check for gitleaks-specific fields
	first := results[0]
	return first.RuleID != "" || first.File != "" || first.Secret != ""
}

func (p *GitleaksParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		return parseSarif(data, "gitleaks")
	}

	var results []gitleaksResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, fmt.Errorf("failed to parse gitleaks report: %w", err)
	}

	findings := make([]Finding, 0, len(results))
	for _, r := range results {
		findings = append(findings, p.buildFinding(r))
	}
	return findings, nil
}

func (p *GitleaksParser) buildFinding(r gitleaksResult) Finding {
	// Title from RuleID (e.g., "aws-access-key", "generic-api-key")
	title := buildGitleaksTitle(r.RuleID, r.Description)

	// Location: file:line
	location := buildGitleaksLocation(r.File, r.StartLine)

	// Description - context about the finding
	desc := buildGitleaksDescription(r)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildGitleaksRawData(r)
	evidence := buildGitleaksEvidence(r)

	return Finding{
		Category:    models.CategorySecrets,
		Title:       title,
		Description: descPtr,
		Severity:    models.SeverityHigh, // Secrets are generally high severity
		Location:    location,
		RuleID:      strings.TrimSpace(r.RuleID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildGitleaksTitle(ruleID, description string) string {
	ruleID = strings.TrimSpace(ruleID)
	description = strings.TrimSpace(description)

	if ruleID == "" && description == "" {
		return "Secret detected"
	}
	if ruleID == "" {
		return description
	}

	// Format rule ID nicely (e.g., "aws-access-key" -> "AWS Access Key")
	formatted := formatRuleID(ruleID)
	if formatted != "" {
		return formatted
	}
	return ruleID
}

func formatRuleID(ruleID string) string {
	if ruleID == "" {
		return ""
	}
	// Replace dashes/underscores with spaces and title case
	words := strings.FieldsFunc(ruleID, func(r rune) bool {
		return r == '-' || r == '_'
	})
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(string(w[0])) + strings.ToLower(w[1:])
		}
	}
	return strings.Join(words, " ")
}

func buildGitleaksLocation(file string, startLine int) string {
	file = strings.TrimSpace(file)
	if file == "" {
		return ""
	}
	if startLine <= 0 {
		return file
	}
	return fmt.Sprintf("%s:%d", file, startLine)
}

func buildGitleaksDescription(r gitleaksResult) string {
	parts := []string{}

	if r.Description != "" {
		parts = append(parts, r.Description)
	}

	if r.Commit != "" && r.Commit != "0000000000000000" {
		parts = append(parts, fmt.Sprintf("Commit: %s", r.Commit[:min(8, len(r.Commit))]))
	}

	if r.Author != "" {
		parts = append(parts, fmt.Sprintf("Author: %s", r.Author))
	}

	return strings.Join(parts, ". ")
}

func buildGitleaksRawData(r gitleaksResult) map[string]any {
	rawData := map[string]any{
		"type":    "secret",
		"scanner": "gitleaks",
		"rule_id": strings.TrimSpace(r.RuleID),
		"file":    strings.TrimSpace(r.File),
	}

	if r.StartLine > 0 {
		rawData["start_line"] = r.StartLine
	}
	if r.EndLine > 0 {
		rawData["end_line"] = r.EndLine
	}
	if r.StartColumn > 0 {
		rawData["start_column"] = r.StartColumn
	}
	if r.EndColumn > 0 {
		rawData["end_column"] = r.EndColumn
	}
	if r.Match != "" {
		rawData["match"] = r.Match
	}
	if r.Commit != "" {
		rawData["commit"] = r.Commit
	}
	if r.Author != "" {
		rawData["author"] = r.Author
	}
	if r.Email != "" {
		rawData["email"] = r.Email
	}
	if r.Date != "" {
		rawData["date"] = r.Date
	}
	if r.Message != "" {
		rawData["commit_message"] = r.Message
	}
	if r.Fingerprint != "" {
		rawData["fingerprint"] = r.Fingerprint
	}
	if r.Entropy > 0 {
		rawData["entropy"] = r.Entropy
	}
	if len(r.Tags) > 0 {
		rawData["tags"] = r.Tags
	}
	if r.Description != "" {
		rawData["description"] = r.Description
	}

	return rawData
}

func buildGitleaksEvidence(r gitleaksResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "gitleaks",
		"findingType": "secret",
		"category":    models.CategorySecrets,
		"ruleId":      strings.TrimSpace(r.RuleID),
		"filePath":    strings.TrimSpace(r.File),
	}

	if r.StartLine > 0 {
		evidence["startLine"] = r.StartLine
	}
	if r.EndLine > 0 {
		evidence["endLine"] = r.EndLine
	}
	if r.StartColumn > 0 {
		evidence["startCol"] = r.StartColumn
	}
	if r.EndColumn > 0 {
		evidence["endCol"] = r.EndColumn
	}

	// Redact the actual secret but show match context
	if r.Match != "" {
		evidence["matchContext"] = redactSecret(r.Match, r.Secret)
	}

	// Git metadata
	if r.Commit != "" && r.Commit != "0000000000000000" {
		evidence["commit"] = r.Commit
	}
	if r.Author != "" {
		evidence["author"] = r.Author
	}
	if r.Email != "" {
		evidence["email"] = r.Email
	}
	if r.Date != "" {
		evidence["date"] = r.Date
	}
	if r.Message != "" {
		evidence["commitMessage"] = r.Message
	}

	if r.Entropy > 0 {
		evidence["entropy"] = r.Entropy
	}

	if len(r.Tags) > 0 {
		evidence["tags"] = r.Tags
	}

	if r.Description != "" {
		evidence["message"] = r.Description
	}

	return evidence
}

// redactSecret replaces the secret in the match string with asterisks
func redactSecret(match, secret string) string {
	if secret == "" || match == "" {
		return match
	}
	// Replace the secret with redacted version
	redacted := strings.Repeat("*", min(len(secret), 8)) + "..."
	return strings.Replace(match, secret, redacted, 1)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Gitleaks report structures

type gitleaksResult struct {
	RuleID      string   `json:"RuleID"`
	Description string   `json:"Description"`
	StartLine   int      `json:"StartLine"`
	EndLine     int      `json:"EndLine"`
	StartColumn int      `json:"StartColumn"`
	EndColumn   int      `json:"EndColumn"`
	Match       string   `json:"Match"`
	Secret      string   `json:"Secret"`
	File        string   `json:"File"`
	SymlinkFile string   `json:"SymlinkFile"`
	Commit      string   `json:"Commit"`
	Entropy     float64  `json:"Entropy"`
	Author      string   `json:"Author"`
	Email       string   `json:"Email"`
	Date        string   `json:"Date"`
	Message     string   `json:"Message"`
	Tags        []string `json:"Tags"`
	Fingerprint string   `json:"Fingerprint"`
}
