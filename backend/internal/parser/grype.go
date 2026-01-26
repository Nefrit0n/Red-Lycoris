package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

// GrypeParser parses Grype container vulnerability scanner output.
// Supports JSON format.
type GrypeParser struct{}

func (p *GrypeParser) ScannerType() string { return "grype" }

func (p *GrypeParser) CanParse(data []byte) bool {
	// Try SARIF first
	if canParseSarif(data) {
		var sarif sarifReport
		if err := json.Unmarshal(data, &sarif); err == nil {
			for _, run := range sarif.Runs {
				toolName := strings.ToLower(run.Tool.Driver.Name)
				if strings.Contains(toolName, "grype") {
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

	// Grype format has "matches" and "source"
	if _, hasMatches := payload["matches"]; !hasMatches {
		return false
	}
	if _, hasSource := payload["source"]; !hasSource {
		return false
	}

	return true
}

func (p *GrypeParser) Parse(data []byte) ([]Finding, error) {
	// Try SARIF first
	if canParseSarif(data) {
		findings, err := parseSarif(data, "grype")
		if err != nil {
			return nil, err
		}
		for i := range findings {
			findings[i].Category = models.CategoryContainer
			if findings[i].Evidence == nil {
				findings[i].Evidence = map[string]any{}
			}
			findings[i].Evidence["scannerType"] = "grype"
			findings[i].Evidence["findingType"] = "vulnerability"
		}
		return findings, nil
	}

	var report grypeReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse grype report: %w", err)
	}

	findings := make([]Finding, 0, len(report.Matches))
	for _, match := range report.Matches {
		findings = append(findings, p.buildFinding(match, report))
	}
	return findings, nil
}

func (p *GrypeParser) buildFinding(match grypeMatch, report grypeReport) Finding {
	// Title: CVE ID or vulnerability ID
	title := buildGrypeTitle(match)

	// Location: package@version in artifact
	location := buildGrypeLocation(match, report)

	// Description
	desc := strings.TrimSpace(match.Vulnerability.Description)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildGrypeRawData(match, report)
	evidence := buildGrypeEvidence(match)

	return Finding{
		Category:    models.CategoryContainer,
		Title:       title,
		Description: descPtr,
		Severity:    mapGrypeSeverity(match.Vulnerability.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(match.Vulnerability.ID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildGrypeTitle(match grypeMatch) string {
	if match.Vulnerability.ID != "" {
		return match.Vulnerability.ID
	}
	if match.Artifact.Name != "" {
		if match.Artifact.Version != "" {
			return fmt.Sprintf("%s@%s vulnerability", match.Artifact.Name, match.Artifact.Version)
		}
		return match.Artifact.Name + " vulnerability"
	}
	return "Grype finding"
}

func buildGrypeLocation(match grypeMatch, report grypeReport) string {
	parts := []string{}

	if match.Artifact.Name != "" {
		pkg := match.Artifact.Name
		if match.Artifact.Version != "" {
			pkg += "@" + match.Artifact.Version
		}
		parts = append(parts, pkg)
	}

	if len(match.Artifact.Locations) > 0 {
		loc := match.Artifact.Locations[0]
		if loc.Path != "" {
			parts = append(parts, loc.Path)
		}
	}

	if len(parts) == 0 && report.Source.Target != nil {
		if target, ok := report.Source.Target.(string); ok {
			return target
		}
	}

	return strings.Join(parts, " in ")
}

func buildGrypeRawData(match grypeMatch, report grypeReport) map[string]any {
	rawData := map[string]any{
		"type":              "vulnerability",
		"scanner":           "grype",
		"vuln_id":           match.Vulnerability.ID,
		"package":           match.Artifact.Name,
		"installed_version": match.Artifact.Version,
		"original_severity": match.Vulnerability.Severity,
	}

	if match.Artifact.Type != "" {
		rawData["package_type"] = match.Artifact.Type
	}
	if match.Artifact.PURL != "" {
		rawData["purl"] = match.Artifact.PURL
	}

	// Source info
	if report.Source.Type != "" {
		rawData["source_type"] = report.Source.Type
	}
	if report.Source.Target != nil {
		rawData["source_target"] = report.Source.Target
	}

	// Vulnerability details
	vuln := match.Vulnerability
	if vuln.DataSource != "" {
		rawData["data_source"] = vuln.DataSource
	}
	if len(vuln.URLs) > 0 {
		rawData["references"] = vuln.URLs
	}
	if vuln.Namespace != "" {
		rawData["namespace"] = vuln.Namespace
	}

	// Fix info
	if vuln.Fix.State != "" {
		rawData["fix_state"] = vuln.Fix.State
	}
	if len(vuln.Fix.Versions) > 0 {
		rawData["fixed_versions"] = vuln.Fix.Versions
	}

	// CVSS
	if len(vuln.CVSS) > 0 {
		cvssData := make([]map[string]any, 0, len(vuln.CVSS))
		for _, c := range vuln.CVSS {
			cvssData = append(cvssData, map[string]any{
				"source":  c.Source,
				"type":    c.Type,
				"version": c.Version,
				"vector":  c.Vector,
				"score":   c.Metrics.BaseScore,
			})
		}
		rawData["cvss"] = cvssData
	}

	// Related vulnerabilities
	if len(match.RelatedVulnerabilities) > 0 {
		related := make([]string, 0, len(match.RelatedVulnerabilities))
		for _, rv := range match.RelatedVulnerabilities {
			related = append(related, rv.ID)
		}
		rawData["related_vulnerabilities"] = related
	}

	// Match details
	if len(match.MatchDetails) > 0 {
		rawData["match_details"] = match.MatchDetails
	}

	return rawData
}

func buildGrypeEvidence(match grypeMatch) map[string]any {
	evidence := map[string]any{
		"scannerType": "grype",
		"findingType": "vulnerability",
		"category":    models.CategoryContainer,
		"ruleId":      match.Vulnerability.ID,
	}

	// Package info
	if match.Artifact.Name != "" {
		evidence["pkgName"] = match.Artifact.Name
	}
	if match.Artifact.Version != "" {
		evidence["installedVersion"] = match.Artifact.Version
	}
	if match.Artifact.Type != "" {
		evidence["ecosystem"] = match.Artifact.Type
	}
	if match.Artifact.PURL != "" {
		evidence["purl"] = match.Artifact.PURL
	}

	// Fix info
	if match.Vulnerability.Fix.State == "fixed" && len(match.Vulnerability.Fix.Versions) > 0 {
		evidence["fixedVersion"] = match.Vulnerability.Fix.Versions[0]
	}
	evidence["fixState"] = match.Vulnerability.Fix.State

	// Severity
	if match.Vulnerability.Severity != "" {
		evidence["severityRaw"] = match.Vulnerability.Severity
	}

	// CVSS
	if len(match.Vulnerability.CVSS) > 0 {
		for _, cvss := range match.Vulnerability.CVSS {
			if cvss.Metrics.BaseScore > 0 {
				evidence["cvssScore"] = cvss.Metrics.BaseScore
				if cvss.Vector != "" {
					evidence["cvssVector"] = cvss.Vector
				}
				break
			}
		}
	}

	// References
	if len(match.Vulnerability.URLs) > 0 {
		evidence["references"] = match.Vulnerability.URLs
		evidence["primaryUrl"] = match.Vulnerability.URLs[0]
	}

	// Message
	if match.Vulnerability.Description != "" {
		desc := match.Vulnerability.Description
		if len(desc) > 200 {
			desc = desc[:197] + "..."
		}
		evidence["message"] = desc
	}

	// Location
	if len(match.Artifact.Locations) > 0 {
		evidence["filePath"] = match.Artifact.Locations[0].Path
	}

	return evidence
}

var grypeSeverityMap = map[string]string{
	"NEGLIGIBLE": models.SeverityLow,
	"LOW":        models.SeverityLow,
	"MEDIUM":     models.SeverityMedium,
	"HIGH":       models.SeverityHigh,
	"CRITICAL":   models.SeverityCritical,
	"UNKNOWN":    models.SeverityMedium,
}

func mapGrypeSeverity(raw string) string {
	if v, ok := grypeSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityMedium
}

// Grype report structures

type grypeReport struct {
	Matches    []grypeMatch   `json:"matches"`
	Source     grypeSource    `json:"source"`
	Distro     grypeDistro    `json:"distro"`
	Descriptor grypeDescriptor `json:"descriptor"`
}

type grypeMatch struct {
	Vulnerability          grypeVulnerability   `json:"vulnerability"`
	RelatedVulnerabilities []grypeVulnerability `json:"relatedVulnerabilities"`
	MatchDetails           []grypeMatchDetail   `json:"matchDetails"`
	Artifact               grypeArtifact        `json:"artifact"`
}

type grypeVulnerability struct {
	ID          string    `json:"id"`
	DataSource  string    `json:"dataSource"`
	Namespace   string    `json:"namespace"`
	Severity    string    `json:"severity"`
	URLs        []string  `json:"urls"`
	Description string    `json:"description"`
	CVSS        []grypeCVSS `json:"cvss"`
	Fix         grypeFix    `json:"fix"`
	Advisories  []grypeAdvisory `json:"advisories"`
}

type grypeCVSS struct {
	Source  string `json:"source"`
	Type    string `json:"type"`
	Version string `json:"version"`
	Vector  string `json:"vector"`
	Metrics struct {
		BaseScore           float64 `json:"baseScore"`
		ExploitabilityScore float64 `json:"exploitabilityScore"`
		ImpactScore         float64 `json:"impactScore"`
	} `json:"metrics"`
}

type grypeFix struct {
	Versions []string `json:"versions"`
	State    string   `json:"state"`
}

type grypeAdvisory struct {
	ID   string `json:"id"`
	Link string `json:"link"`
}

type grypeMatchDetail struct {
	Type       string          `json:"type"`
	Matcher    string          `json:"matcher"`
	SearchedBy json.RawMessage `json:"searchedBy"`
	Found      json.RawMessage `json:"found"`
}

type grypeArtifact struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Version   string           `json:"version"`
	Type      string           `json:"type"`
	Locations []grypeLocation  `json:"locations"`
	Language  string           `json:"language"`
	Licenses  []string         `json:"licenses"`
	CPEs      []string         `json:"cpes"`
	PURL      string           `json:"purl"`
	Upstreams []grypeUpstream  `json:"upstreams"`
}

type grypeLocation struct {
	Path    string `json:"path"`
	LayerID string `json:"layerID"`
}

type grypeUpstream struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type grypeSource struct {
	Type   string `json:"type"`
	Target any    `json:"target"`
}

type grypeDistro struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	IDLike  []string `json:"idLike"`
}

type grypeDescriptor struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}
