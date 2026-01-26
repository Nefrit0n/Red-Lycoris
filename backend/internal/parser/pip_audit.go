package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// PipAuditParser parses pip-audit JSON output.
type PipAuditParser struct{}

func (p *PipAuditParser) ScannerType() string { return "pip-audit" }

func (p *PipAuditParser) CanParse(data []byte) bool {
	if !json.Valid(data) {
		return false
	}

	// pip-audit outputs an array of findings
	var results []pipAuditResult
	if err := json.Unmarshal(data, &results); err != nil {
		return false
	}

	// Check if it looks like pip-audit output
	if len(results) == 0 {
		return true // Empty array is valid
	}

	// Check for pip-audit specific fields
	first := results[0]
	return first.Name != "" && first.Version != ""
}

func (p *PipAuditParser) Parse(data []byte) ([]Finding, error) {
	var results []pipAuditResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, fmt.Errorf("failed to parse pip-audit report: %w", err)
	}

	var findings []Finding
	for _, result := range results {
		for _, vuln := range result.Vulns {
			findings = append(findings, p.buildFinding(result, vuln))
		}
	}

	return findings, nil
}

func (p *PipAuditParser) buildFinding(result pipAuditResult, vuln pipAuditVuln) Finding {
	// Title: CVE or PYSEC ID
	title := vuln.ID
	if title == "" {
		title = fmt.Sprintf("%s@%s vulnerability", result.Name, result.Version)
	}

	// Description from aliases or fix info
	desc := buildPipAuditDescription(result, vuln)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	location := fmt.Sprintf("%s@%s", result.Name, result.Version)

	rawData := buildPipAuditRawData(result, vuln)
	evidence := buildPipAuditEvidence(result, vuln)

	return Finding{
		Category:    models.CategorySCA,
		Title:       title,
		Description: descPtr,
		Severity:    models.SeverityHigh, // pip-audit doesn't provide severity, default to high
		Location:    location,
		RuleID:      vuln.ID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildPipAuditDescription(result pipAuditResult, vuln pipAuditVuln) string {
	parts := []string{}

	if vuln.Description != "" {
		parts = append(parts, vuln.Description)
	}

	if vuln.FixVersions != nil && len(vuln.FixVersions) > 0 {
		parts = append(parts, fmt.Sprintf("Fix available in: %s", strings.Join(vuln.FixVersions, ", ")))
	}

	return strings.Join(parts, ". ")
}

func buildPipAuditRawData(result pipAuditResult, vuln pipAuditVuln) map[string]any {
	rawData := map[string]any{
		"type":              "vulnerability",
		"scanner":           "pip-audit",
		"package":           result.Name,
		"installed_version": result.Version,
		"vuln_id":           vuln.ID,
	}

	if len(vuln.FixVersions) > 0 {
		rawData["fix_versions"] = vuln.FixVersions
	}
	if len(vuln.Aliases) > 0 {
		rawData["aliases"] = vuln.Aliases
		// Extract CVEs from aliases
		cves := []string{}
		for _, alias := range vuln.Aliases {
			if strings.HasPrefix(strings.ToUpper(alias), "CVE-") {
				cves = append(cves, alias)
			}
		}
		if len(cves) > 0 {
			rawData["cve"] = cves
		}
	}
	if vuln.Description != "" {
		rawData["description"] = vuln.Description
	}

	return rawData
}

func buildPipAuditEvidence(result pipAuditResult, vuln pipAuditVuln) map[string]any {
	evidence := map[string]any{
		"scannerType":      "pip-audit",
		"findingType":      "vulnerability",
		"category":         models.CategorySCA,
		"ruleId":           vuln.ID,
		"pkgName":          result.Name,
		"installedVersion": result.Version,
		"ecosystem":        "pypi",
	}

	if len(vuln.FixVersions) > 0 {
		evidence["fixedVersion"] = vuln.FixVersions[0]
		evidence["fixVersions"] = vuln.FixVersions
	}

	// Extract CVEs
	cves := []string{}
	for _, alias := range vuln.Aliases {
		if strings.HasPrefix(strings.ToUpper(alias), "CVE-") {
			cves = append(cves, alias)
		}
	}
	if len(cves) > 0 {
		evidence["cve"] = cves
	}

	if vuln.Description != "" {
		evidence["message"] = vuln.Description
	}

	// Build reference URL (PyPI advisory)
	if vuln.ID != "" {
		if strings.HasPrefix(vuln.ID, "PYSEC-") {
			evidence["primaryUrl"] = fmt.Sprintf("https://osv.dev/vulnerability/%s", vuln.ID)
		} else if strings.HasPrefix(strings.ToUpper(vuln.ID), "CVE-") {
			evidence["primaryUrl"] = fmt.Sprintf("https://nvd.nist.gov/vuln/detail/%s", vuln.ID)
		}
	}

	return evidence
}

// pip-audit report structures

type pipAuditResult struct {
	Name    string         `json:"name"`
	Version string         `json:"version"`
	Vulns   []pipAuditVuln `json:"vulns"`
}

type pipAuditVuln struct {
	ID          string   `json:"id"`
	FixVersions []string `json:"fix_versions"`
	Aliases     []string `json:"aliases"`
	Description string   `json:"description"`
}
