package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

type TrivyParser struct{}

func (p *TrivyParser) ScannerType() string {
	return "trivy"
}

/*
CanParse:
- SARIF → да
- JSON → да
- Есть хотя бы один finding (vuln или secret)
*/
func (p *TrivyParser) CanParse(data []byte) bool {
	if canParseSarif(data) {
		return true
	}
	if !json.Valid(data) {
		return false
	}

	var report trivyReport
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}

	for _, r := range report.Results {
		if len(r.Vulnerabilities) > 0 || len(r.Secrets) > 0 {
			return true
		}
	}
	return false
}

func (p *TrivyParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "trivy")
	}

	var report trivyReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := make([]Finding, 0)

	for _, result := range report.Results {

		// ---------- Vulnerabilities ----------
		for _, vuln := range result.Vulnerabilities {
			title := strings.TrimSpace(vuln.Title)
			if title == "" {
				title = vuln.VulnerabilityID
			}

			location := strings.TrimSpace(result.Target)
			if location == "" {
				location = vuln.PkgName
			}

			desc := strings.TrimSpace(vuln.Description)
			var descPtr *string
			if desc != "" {
				descPtr = &desc
			}

			findings = append(findings, Finding{
				Title:       title,
				Description: descPtr,
				Severity:    mapTrivySeverity(vuln.Severity),
				Location:    location,
				RuleID:      vuln.VulnerabilityID,
				RawData: map[string]any{
					"type":    "vulnerability",
					"package": vuln.PkgName,
					"url":     vuln.PrimaryURL,
				},
			})
		}

		// ---------- Secrets ----------
		for _, secret := range result.Secrets {
			location := result.Target
			if secret.StartLine > 0 {
				location = fmt.Sprintf("%s:%d", location, secret.StartLine)
			}

			findings = append(findings, Finding{
				Title:    secret.Title,
				Severity: mapTrivySeverity(secret.Severity),
				Location: location,
				RuleID:   secret.RuleID,
				RawData: map[string]any{
					"type":     "secret",
					"category": secret.Category,
					"lines":    fmt.Sprintf("%d-%d", secret.StartLine, secret.EndLine),
				},
			})
		}
	}

	return findings, nil
}

// ---------- Models ----------

type trivyReport struct {
	ArtifactName string `json:"ArtifactName"`
	Results      []struct {
		Target string `json:"Target"`
		Class  string `json:"Class"`

		Vulnerabilities []struct {
			VulnerabilityID string `json:"VulnerabilityID"`
			Title           string `json:"Title"`
			Description     string `json:"Description"`
			Severity        string `json:"Severity"`
			PkgName         string `json:"PkgName"`
			PrimaryURL      string `json:"PrimaryURL"`
		} `json:"Vulnerabilities"`

		Secrets []struct {
			RuleID    string `json:"RuleID"`
			Category  string `json:"Category"`
			Severity  string `json:"Severity"`
			Title     string `json:"Title"`
			StartLine int    `json:"StartLine"`
			EndLine   int    `json:"EndLine"`
		} `json:"Secrets"`
	} `json:"Results"`
}

// ---------- Helpers ----------

func mapTrivySeverity(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "LOW":
		return models.SeverityLow
	case "MEDIUM":
		return models.SeverityMedium
	case "HIGH":
		return models.SeverityHigh
	case "CRITICAL":
		return models.SeverityCritical
	default:
		return models.SeverityLow
	}
}
