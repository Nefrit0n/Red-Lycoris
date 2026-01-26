package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// NpmAuditParser parses npm audit JSON output.
type NpmAuditParser struct{}

func (p *NpmAuditParser) ScannerType() string { return "npm-audit" }

func (p *NpmAuditParser) CanParse(data []byte) bool {
	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// npm audit v2 format has "vulnerabilities" object
	if _, hasVulns := payload["vulnerabilities"]; hasVulns {
		return true
	}

	// npm audit v1 format has "advisories" object
	if _, hasAdvisories := payload["advisories"]; hasAdvisories {
		return true
	}

	return false
}

func (p *NpmAuditParser) Parse(data []byte) ([]Finding, error) {
	// Try v2 format first
	var reportV2 npmAuditReportV2
	if err := json.Unmarshal(data, &reportV2); err == nil && len(reportV2.Vulnerabilities) > 0 {
		return p.parseV2(reportV2)
	}

	// Try v1 format
	var reportV1 npmAuditReportV1
	if err := json.Unmarshal(data, &reportV1); err == nil && len(reportV1.Advisories) > 0 {
		return p.parseV1(reportV1)
	}

	return nil, fmt.Errorf("failed to parse npm audit report: unknown format")
}

func (p *NpmAuditParser) parseV2(report npmAuditReportV2) ([]Finding, error) {
	findings := make([]Finding, 0)

	for pkgName, vuln := range report.Vulnerabilities {
		for _, via := range vuln.Via {
			// "via" can be a string (package name) or an object
			viaObj, ok := via.(map[string]any)
			if !ok {
				continue // Skip string references
			}

			finding := p.buildFindingV2(pkgName, vuln, viaObj)
			findings = append(findings, finding)
		}
	}

	return findings, nil
}

func (p *NpmAuditParser) buildFindingV2(pkgName string, vuln npmAuditVulnV2, via map[string]any) Finding {
	title := getString(via, "title")
	if title == "" {
		title = fmt.Sprintf("%s vulnerability", pkgName)
	}

	desc := getString(via, "name")
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	severity := getString(via, "severity")
	if severity == "" {
		severity = vuln.Severity
	}

	location := pkgName
	if vuln.Range != "" {
		location = fmt.Sprintf("%s@%s", pkgName, vuln.Range)
	}

	ruleID := ""
	if source, ok := via["source"].(float64); ok {
		ruleID = fmt.Sprintf("GHSA-%d", int(source))
	}

	rawData := map[string]any{
		"type":              "vulnerability",
		"scanner":           "npm-audit",
		"package":           pkgName,
		"original_severity": severity,
		"range":             vuln.Range,
		"nodes":             vuln.Nodes,
		"fix_available":     vuln.FixAvailable,
	}

	if url := getString(via, "url"); url != "" {
		rawData["url"] = url
	}

	evidence := map[string]any{
		"scannerType":      "npm-audit",
		"findingType":      "vulnerability",
		"category":         models.CategorySCA,
		"pkgName":          pkgName,
		"ecosystem":        "npm",
		"installedVersion": vuln.Range,
	}

	if severity != "" {
		evidence["severityRaw"] = severity
	}
	if url := getString(via, "url"); url != "" {
		evidence["primaryUrl"] = url
		evidence["references"] = []string{url}
	}

	return Finding{
		Category:    models.CategorySCA,
		Title:       title,
		Description: descPtr,
		Severity:    mapNpmSeverity(severity),
		Location:    location,
		RuleID:      ruleID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func (p *NpmAuditParser) parseV1(report npmAuditReportV1) ([]Finding, error) {
	findings := make([]Finding, 0, len(report.Advisories))

	for _, advisory := range report.Advisories {
		findings = append(findings, p.buildFindingV1(advisory))
	}

	return findings, nil
}

func (p *NpmAuditParser) buildFindingV1(advisory npmAuditAdvisoryV1) Finding {
	title := advisory.Title
	if title == "" {
		title = fmt.Sprintf("%s vulnerability", advisory.ModuleName)
	}

	var descPtr *string
	if advisory.Overview != "" {
		descPtr = &advisory.Overview
	}

	location := advisory.ModuleName
	if advisory.VulnerableVersions != "" {
		location = fmt.Sprintf("%s@%s", advisory.ModuleName, advisory.VulnerableVersions)
	}

	rawData := map[string]any{
		"type":                "vulnerability",
		"scanner":             "npm-audit",
		"package":             advisory.ModuleName,
		"original_severity":   advisory.Severity,
		"vulnerable_versions": advisory.VulnerableVersions,
		"patched_versions":    advisory.PatchedVersions,
		"advisory_id":         advisory.ID,
	}

	if advisory.URL != "" {
		rawData["url"] = advisory.URL
	}
	if len(advisory.CWEs) > 0 {
		rawData["cwe"] = advisory.CWEs
	}
	if len(advisory.CVEs) > 0 {
		rawData["cve"] = advisory.CVEs
	}

	evidence := map[string]any{
		"scannerType":      "npm-audit",
		"findingType":      "vulnerability",
		"category":         models.CategorySCA,
		"pkgName":          advisory.ModuleName,
		"ecosystem":        "npm",
		"installedVersion": advisory.VulnerableVersions,
	}

	if advisory.PatchedVersions != "" {
		evidence["fixedVersion"] = advisory.PatchedVersions
	}
	if advisory.Severity != "" {
		evidence["severityRaw"] = advisory.Severity
	}
	if advisory.URL != "" {
		evidence["primaryUrl"] = advisory.URL
	}
	if len(advisory.CWEs) > 0 {
		evidence["cwe"] = advisory.CWEs
	}
	if len(advisory.CVEs) > 0 {
		evidence["cve"] = advisory.CVEs
	}

	return Finding{
		Category:    models.CategorySCA,
		Title:       title,
		Description: descPtr,
		Severity:    mapNpmSeverity(advisory.Severity),
		Location:    location,
		RuleID:      fmt.Sprintf("npm-%d", advisory.ID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func getString(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

var npmSeverityMap = map[string]string{
	"INFO":     models.SeverityLow,
	"LOW":      models.SeverityLow,
	"MODERATE": models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapNpmSeverity(raw string) string {
	if v, ok := npmSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// npm audit v2 structures

type npmAuditReportV2 struct {
	AuditReportVersion int                         `json:"auditReportVersion"`
	Vulnerabilities    map[string]npmAuditVulnV2   `json:"vulnerabilities"`
	Metadata           json.RawMessage             `json:"metadata"`
}

type npmAuditVulnV2 struct {
	Name         string   `json:"name"`
	Severity     string   `json:"severity"`
	IsDirect     bool     `json:"isDirect"`
	Via          []any    `json:"via"` // can be string or object
	Effects      []string `json:"effects"`
	Range        string   `json:"range"`
	Nodes        []string `json:"nodes"`
	FixAvailable any      `json:"fixAvailable"` // bool or object
}

// npm audit v1 structures

type npmAuditReportV1 struct {
	Advisories map[string]npmAuditAdvisoryV1 `json:"advisories"`
	Metadata   json.RawMessage               `json:"metadata"`
}

type npmAuditAdvisoryV1 struct {
	ID                 int      `json:"id"`
	Title              string   `json:"title"`
	ModuleName         string   `json:"module_name"`
	Severity           string   `json:"severity"`
	URL                string   `json:"url"`
	Overview           string   `json:"overview"`
	Recommendation     string   `json:"recommendation"`
	VulnerableVersions string   `json:"vulnerable_versions"`
	PatchedVersions    string   `json:"patched_versions"`
	CWEs               []string `json:"cwe"`
	CVEs               []string `json:"cves"`
}
