package parser

import (
	"encoding/json"
	"strings"
)

type TrivyParser struct{}

func (p *TrivyParser) ScannerType() string {
	return "trivy"
}

func (p *TrivyParser) CanParse(data []byte) bool {
	if canParseSarif(data) {
		return true
	}
	if !json.Valid(data) {
		return false
	}
	var report struct {
		Results []any `json:"Results"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}
	return len(report.Results) > 0
}

func (p *TrivyParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "trivy")
	}
	var report struct {
		ArtifactName string `json:"ArtifactName"`
		Results      []struct {
			Target          string `json:"Target"`
			Vulnerabilities []struct {
				VulnerabilityID string `json:"VulnerabilityID"`
				Title           string `json:"Title"`
				Description     string `json:"Description"`
				Severity        string `json:"Severity"`
				PkgName         string `json:"PkgName"`
				PrimaryURL      string `json:"PrimaryURL"`
			} `json:"Vulnerabilities"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := []Finding{}
	for _, result := range report.Results {
		for _, vuln := range result.Vulnerabilities {
			title := vuln.Title
			if strings.TrimSpace(title) == "" {
				title = vuln.VulnerabilityID
			}
			location := strings.TrimSpace(result.Target)
			if location == "" {
				location = strings.TrimSpace(vuln.PkgName)
			}
			description := strings.TrimSpace(vuln.Description)
			if description == "" && vuln.PrimaryURL != "" {
				description = vuln.PrimaryURL
			}

			var descriptionPtr *string
			if description != "" {
				descriptionPtr = &description
			}

			findings = append(findings, Finding{
				Title:       title,
				Description: descriptionPtr,
				Severity:    vuln.Severity,
				Location:    location,
				RuleID:      vuln.VulnerabilityID,
				RawData: map[string]any{
					"artifact": report.ArtifactName,
					"target":   result.Target,
					"package":  vuln.PkgName,
				},
			})
		}
	}

	return findings, nil
}
