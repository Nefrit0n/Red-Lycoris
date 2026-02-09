package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"red-lycoris/backend/internal/models"
)

// SnykParser parses Snyk vulnerability scanner output.
// Supports JSON format from `snyk test --json`.
type SnykParser struct{}

func (p *SnykParser) ScannerType() string { return "snyk" }

func (p *SnykParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "snyk") {
					return true
				}
			}
		}
		return false
	}

	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// Snyk format has "vulnerabilities" and "packageManager"
	if _, hasVulns := payload["vulnerabilities"]; !hasVulns {
		return false
	}

	return true
}

func (p *SnykParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "snyk")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategorySCA
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "snyk"
			findings[i].Evidence["findingType"] = "vulnerability"
		}
		return findings, nil
	}

	var report snykReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse snyk report: %w", err)
	}

	findings := make([]Finding, 0, len(report.Vulnerabilities))
	for _, vuln := range report.Vulnerabilities {
		findings = append(findings, p.buildFinding(vuln, report))
	}
	return findings, nil
}

func (p *SnykParser) buildFinding(vuln snykVulnerability, report snykReport) Finding {
	// Title: CVE or package name + version
	title := buildSnykTitle(vuln)

	// Location: package path
	location := buildSnykLocation(vuln)

	// Description
	desc := strings.TrimSpace(vuln.Description)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildSnykRawData(vuln, report)
	evidence := buildSnykEvidence(vuln, report)

	return Finding{
		Category:    models.CategorySCA,
		Title:       title,
		Description: descPtr,
		Severity:    mapSnykSeverity(vuln.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(vuln.ID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildSnykTitle(vuln snykVulnerability) string {
	// Prefer CVE as title
	for _, id := range vuln.Identifiers.CVE {
		if id != "" {
			return id
		}
	}

	// Fallback to package name
	if vuln.PackageName != "" {
		if vuln.Version != "" {
			return fmt.Sprintf("%s@%s", vuln.PackageName, vuln.Version)
		}
		return vuln.PackageName
	}

	if vuln.Title != "" {
		return vuln.Title
	}

	return vuln.ID
}

func buildSnykLocation(vuln snykVulnerability) string {
	parts := []string{}
	if vuln.PackageName != "" {
		parts = append(parts, vuln.PackageName)
	}
	if vuln.Version != "" {
		parts = append(parts, vuln.Version)
	}
	if len(vuln.From) > 0 {
		return strings.Join(vuln.From, " > ")
	}
	return strings.Join(parts, "@")
}

func buildSnykRawData(vuln snykVulnerability, report snykReport) map[string]any {
	rawData := map[string]any{
		"type":              "vulnerability",
		"scanner":           "snyk",
		"vuln_id":           vuln.ID,
		"package":           vuln.PackageName,
		"installed_version": vuln.Version,
		"original_severity": vuln.Severity,
	}

	if report.PackageManager != "" {
		rawData["package_manager"] = report.PackageManager
	}
	if report.TargetFile != "" {
		rawData["target_file"] = report.TargetFile
	}

	if len(vuln.Identifiers.CVE) > 0 {
		rawData["cve"] = vuln.Identifiers.CVE
	}
	if len(vuln.Identifiers.CWE) > 0 {
		rawData["cwe"] = vuln.Identifiers.CWE
	}

	if vuln.CVSSv3 != "" {
		rawData["cvss_v3"] = vuln.CVSSv3
	}
	if vuln.CvssScore > 0 {
		rawData["cvss_score"] = vuln.CvssScore
	}

	if len(vuln.UpgradePath) > 0 {
		rawData["upgrade_path"] = vuln.UpgradePath
	}

	if vuln.IsUpgradable {
		rawData["is_upgradable"] = true
	}
	if vuln.IsPatchable {
		rawData["is_patchable"] = true
	}

	if len(vuln.From) > 0 {
		rawData["from"] = vuln.From
	}

	if vuln.PublicationTime != "" {
		rawData["publication_time"] = vuln.PublicationTime
	}
	if vuln.DisclosureTime != "" {
		rawData["disclosure_time"] = vuln.DisclosureTime
	}

	if vuln.Exploit != "" {
		rawData["exploit"] = vuln.Exploit
	}

	if len(vuln.References) > 0 {
		rawData["references"] = vuln.References
	}

	return rawData
}

func buildSnykEvidence(vuln snykVulnerability, report snykReport) map[string]any {
	evidence := map[string]any{
		"scannerType": "snyk",
		"findingType": "vulnerability",
		"category":    models.CategorySCA,
		"ruleId":      vuln.ID,
	}

	if vuln.PackageName != "" {
		evidence["pkgName"] = vuln.PackageName
	}
	if vuln.Version != "" {
		evidence["installedVersion"] = vuln.Version
	}
	if len(vuln.UpgradePath) > 1 {
		evidence["fixedVersion"] = vuln.UpgradePath[len(vuln.UpgradePath)-1]
	}

	if report.PackageManager != "" {
		evidence["ecosystem"] = report.PackageManager
	}

	if len(vuln.Identifiers.CVE) > 0 {
		evidence["cve"] = vuln.Identifiers.CVE
	}
	if len(vuln.Identifiers.CWE) > 0 {
		evidence["cwe"] = vuln.Identifiers.CWE
	}

	if vuln.CvssScore > 0 {
		evidence["cvssScore"] = vuln.CvssScore
	}
	if vuln.CVSSv3 != "" {
		evidence["cvssVector"] = vuln.CVSSv3
	}

	if vuln.Severity != "" {
		evidence["severityRaw"] = vuln.Severity
	}

	if vuln.Title != "" {
		evidence["message"] = vuln.Title
	}

	if vuln.IsUpgradable {
		evidence["isUpgradable"] = true
	}
	if vuln.IsPatchable {
		evidence["isPatchable"] = true
	}

	if len(vuln.References) > 0 {
		evidence["references"] = vuln.References
	}

	if len(vuln.From) > 0 {
		evidence["dependencyPath"] = vuln.From
	}

	return evidence
}

var snykSeverityMap = map[string]string{
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapSnykSeverity(raw string) string {
	if v, ok := snykSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Snyk report structures

type snykReport struct {
	Vulnerabilities []snykVulnerability `json:"vulnerabilities"`
	PackageManager  string              `json:"packageManager"`
	TargetFile      string              `json:"targetFile"`
	ProjectName     string              `json:"projectName"`
	DisplayName     string              `json:"displayTargetFile"`
	Path            string              `json:"path"`
	Ok              bool                `json:"ok"`
	Summary         string              `json:"summary"`
}

type snykVulnerability struct {
	ID              string          `json:"id"`
	Title           string          `json:"title"`
	Description     string          `json:"description"`
	Severity        string          `json:"severity"`
	PackageName     string          `json:"packageName"`
	Version         string          `json:"version"`
	From            []string        `json:"from"`
	UpgradePath     []any           `json:"upgradePath"`
	IsUpgradable    bool            `json:"isUpgradable"`
	IsPatchable     bool            `json:"isPatchable"`
	Identifiers     snykIdentifiers `json:"identifiers"`
	CVSSv3          string          `json:"CVSSv3"`
	CvssScore       float64         `json:"cvssScore"`
	Exploit         string          `json:"exploit"`
	PublicationTime string          `json:"publicationTime"`
	DisclosureTime  string          `json:"disclosureTime"`
	References      []snykReference `json:"references"`
	Semver          json.RawMessage `json:"semver"`
	Credit          json.RawMessage `json:"credit"`
}

type snykIdentifiers struct {
	CVE []string `json:"CVE"`
	CWE []string `json:"CWE"`
}

type snykReference struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}
