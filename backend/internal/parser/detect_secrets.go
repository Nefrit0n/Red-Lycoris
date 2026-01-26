package parser

import (
	"encoding/json"
	"fmt"

	"lotus-warden/backend/internal/models"
)

// DetectSecretsParser parses detect-secrets scanner output.
// Supports JSON format from `detect-secrets scan`.
type DetectSecretsParser struct{}

func (p *DetectSecretsParser) ScannerType() string { return "detect-secrets" }

func (p *DetectSecretsParser) CanParse(data []byte) bool {
	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// detect-secrets format has "results" and "version"
	if _, hasResults := payload["results"]; !hasResults {
		return false
	}
	if _, hasVersion := payload["version"]; !hasVersion {
		return false
	}

	return true
}

func (p *DetectSecretsParser) Parse(data []byte) ([]Finding, error) {
	var report detectSecretsReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse detect-secrets report: %w", err)
	}

	var findings []Finding
	for filename, secrets := range report.Results {
		for _, secret := range secrets {
			findings = append(findings, p.buildFinding(filename, secret))
		}
	}

	return findings, nil
}

func (p *DetectSecretsParser) buildFinding(filename string, secret detectSecretsSecret) Finding {
	// Title: secret type
	title := secret.Type
	if title == "" {
		title = "Secret detected"
	}

	// Location: filename:line
	location := filename
	if secret.LineNumber > 0 {
		location = fmt.Sprintf("%s:%d", filename, secret.LineNumber)
	}

	// Description
	desc := fmt.Sprintf("Potential %s found in %s", secret.Type, filename)
	descPtr := &desc

	rawData := buildDetectSecretsRawData(filename, secret)
	evidence := buildDetectSecretsEvidence(filename, secret)

	return Finding{
		Category:    models.CategorySecrets,
		Title:       title,
		Description: descPtr,
		Severity:    models.SeverityHigh, // Secrets are generally high severity
		Location:    location,
		RuleID:      secret.Type,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildDetectSecretsRawData(filename string, secret detectSecretsSecret) map[string]any {
	rawData := map[string]any{
		"type":        "secret",
		"scanner":     "detect-secrets",
		"secret_type": secret.Type,
		"filename":    filename,
	}

	if secret.LineNumber > 0 {
		rawData["line_number"] = secret.LineNumber
	}
	if secret.HashedSecret != "" {
		rawData["hashed_secret"] = secret.HashedSecret
	}
	if secret.IsVerified {
		rawData["is_verified"] = true
	}

	return rawData
}

func buildDetectSecretsEvidence(filename string, secret detectSecretsSecret) map[string]any {
	evidence := map[string]any{
		"scannerType": "detect-secrets",
		"findingType": "secret",
		"category":    models.CategorySecrets,
		"ruleId":      secret.Type,
		"filePath":    filename,
	}

	if secret.LineNumber > 0 {
		evidence["startLine"] = secret.LineNumber
	}

	evidence["message"] = fmt.Sprintf("Potential %s detected", secret.Type)

	if secret.IsVerified {
		evidence["isVerified"] = true
	}

	return evidence
}

// detect-secrets report structures

type detectSecretsReport struct {
	Version     string                           `json:"version"`
	PluginsUsed []detectSecretsPlugin            `json:"plugins_used"`
	Results     map[string][]detectSecretsSecret `json:"results"`
	GeneratedAt string                           `json:"generated_at"`
}

type detectSecretsPlugin struct {
	Name string `json:"name"`
}

type detectSecretsSecret struct {
	Type         string `json:"type"`
	Filename     string `json:"filename"`
	HashedSecret string `json:"hashed_secret"`
	IsVerified   bool   `json:"is_verified"`
	LineNumber   int    `json:"line_number"`
}
