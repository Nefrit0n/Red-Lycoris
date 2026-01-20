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
- Report.Results присутствует (может быть пустым)
*/
func (p *TrivyParser) CanParse(data []byte) bool {
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

	rawResults, ok := payload["Results"]
	if !ok {
		return false
	}

	var results []json.RawMessage
	if err := json.Unmarshal(rawResults, &results); err != nil {
		return false
	}
	if len(results) == 0 {
		return true
	}

	for _, raw := range results {
		var resultPayload map[string]json.RawMessage
		if err := json.Unmarshal(raw, &resultPayload); err != nil {
			continue
		}
		if _, ok := resultPayload["Vulnerabilities"]; ok {
			return true
		}
		if _, ok := resultPayload["Target"]; ok {
			return true
		}
		if _, ok := resultPayload["Class"]; ok {
			return true
		}
		if _, ok := resultPayload["Type"]; ok {
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
		for _, vuln := range result.Vulnerabilities {
			findings = append(findings, buildTrivyVulnFinding(result, vuln))
		}
	}

	return findings, nil
}

// ---------- Models ----------

type trivyReport struct {
	ArtifactName string        `json:"ArtifactName"`
	Results      []trivyResult `json:"Results"`
}

type trivyResult struct {
	Target string `json:"Target"`
	Class  string `json:"Class"`
	Type   string `json:"Type"`

	Vulnerabilities []trivyVulnerability `json:"Vulnerabilities"`
}

type trivyPkgIdentifier struct {
	PURL string `json:"PURL"`
}

type trivyVulnerability struct {
	VulnerabilityID  string              `json:"VulnerabilityID"`
	Title            string              `json:"Title"`
	Description      string              `json:"Description"`
	Severity         string              `json:"Severity"`
	PkgName          string              `json:"PkgName"`
	InstalledVersion string              `json:"InstalledVersion"`
	FixedVersion     string              `json:"FixedVersion"`
	PrimaryURL       string              `json:"PrimaryURL"`
	References       []string            `json:"References"`
	CweIDs           []string            `json:"CweIDs"`
	CVSS             map[string]any      `json:"CVSS"`
	PublishedDate    string              `json:"PublishedDate"`
	LastModifiedDate string              `json:"LastModifiedDate"`
	DataSource       map[string]any      `json:"DataSource"`
	PkgIdentifier    *trivyPkgIdentifier `json:"PkgIdentifier"`
	Fingerprint      string              `json:"Fingerprint"`
}

// ---------- Helpers ----------

func buildTrivyVulnFinding(result trivyResult, vuln trivyVulnerability) Finding {
	vulnID := strings.TrimSpace(vuln.VulnerabilityID)
	pkgName := strings.TrimSpace(vuln.PkgName)

	title := buildTrivyTitle(vulnID, pkgName, vuln.Title)
	location := strings.TrimSpace(result.Target)
	if location == "" {
		location = pkgName
	}

	desc := strings.TrimSpace(vuln.Description)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	evidence := buildTrivyEvidence(result, vuln)

	return Finding{
		Title:       title,
		Description: descPtr,
		Severity:    mapTrivySeverity(vuln.Severity),
		Location:    location,
		RuleID:      vulnID,
		RawData: map[string]any{
			"type":    "vulnerability",
			"package": pkgName,
			"target":  location,
		},
		Evidence: evidence,
	}
}

func buildTrivyEvidence(result trivyResult, vuln trivyVulnerability) map[string]any {
	references := normalizeStringSlice(vuln.References)
	if references == nil {
		references = []string{}
	}
	cweIDs := normalizeStringSlice(vuln.CweIDs)
	if cweIDs == nil {
		cweIDs = []string{}
	}

	var purl any
	if vuln.PkgIdentifier != nil {
		purl = optionalString(vuln.PkgIdentifier.PURL)
	}

	cvss := mapValueOrNil(vuln.CVSS)
	datasource := mapValueOrNil(vuln.DataSource)

	evidence := map[string]any{
		"tool":             "trivy",
		"type":             "sca",
		"target":           optionalString(result.Target),
		"class":            optionalString(result.Class),
		"targetType":       optionalString(result.Type),
		"vulnerabilityId":  optionalString(vuln.VulnerabilityID),
		"severityRaw":      optionalString(vuln.Severity),
		"pkgName":          optionalString(vuln.PkgName),
		"installedVersion": optionalString(vuln.InstalledVersion),
		"fixedVersion":     optionalString(vuln.FixedVersion),
		"purl":             purl,
		"primaryUrl":       optionalString(vuln.PrimaryURL),
		"title":            optionalString(vuln.Title),
		"description":      optionalString(vuln.Description),
		"references":       references,
		"cweIds":           cweIDs,
		"cvss":             cvss,
		"publishedDate":    optionalString(vuln.PublishedDate),
		"lastModifiedDate": optionalString(vuln.LastModifiedDate),
		"datasource":       datasource,
		"trivyFingerprint": optionalString(vuln.Fingerprint),
	}

	return evidence
}

func buildTrivyTitle(vulnID, pkgName, fallbackTitle string) string {
	if vulnID != "" && pkgName != "" {
		return fmt.Sprintf("%s — %s", vulnID, pkgName)
	}
	if vulnID != "" {
		return vulnID
	}
	trimmedFallback := strings.TrimSpace(fallbackTitle)
	if trimmedFallback != "" {
		return trimmedFallback
	}
	if pkgName != "" {
		return pkgName
	}
	return "Trivy vulnerability"
}

func normalizeStringSlice(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func optionalString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func mapValueOrNil(value map[string]any) map[string]any {
	if len(value) == 0 {
		return nil
	}
	return value
}

func mapTrivySeverity(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "LOW", "INFO", "INFORMATIONAL", "UNKNOWN", "NEGLIGIBLE":
		return models.SeverityLow
	case "MEDIUM", "MODERATE":
		return models.SeverityMedium
	case "HIGH":
		return models.SeverityHigh
	case "CRITICAL":
		return models.SeverityCritical
	default:
		return models.SeverityLow
	}
}
