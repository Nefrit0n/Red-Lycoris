package parser

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"vulnscope/internal/domain"
)

type trivyReport struct {
	SchemaVersion int           `json:"SchemaVersion"`
	ArtifactName  string        `json:"ArtifactName"`
	ArtifactType  string        `json:"ArtifactType"`
	Results       []trivyResult `json:"Results"`
}

type trivyResult struct {
	Target          string               `json:"Target"`
	Class           string               `json:"Class"`
	Type            string               `json:"Type"`
	Vulnerabilities []trivyVulnerability `json:"Vulnerabilities"`
}

type trivyVulnerability struct {
	VulnerabilityID  string                   `json:"VulnerabilityID"`
	PkgName          string                   `json:"PkgName"`
	InstalledVersion string                   `json:"InstalledVersion"`
	FixedVersion     string                   `json:"FixedVersion"`
	Title            string                   `json:"Title"`
	Description      string                   `json:"Description"`
	Severity         string                   `json:"Severity"`
	CweIDs           []string                 `json:"CweIDs"`
	PrimaryURL       string                   `json:"PrimaryURL"`
	Status           string                   `json:"Status"`
	PkgPath          string                   `json:"PkgPath"`
	PkgIdentifier    trivyPkgIdentifier       `json:"PkgIdentifier"`
	DataSource       trivyVulnerabilitySource `json:"DataSource"`
}

type trivyPkgIdentifier struct {
	PURL   string `json:"PURL"`
	UID    string `json:"UID"`
	BOMRef string `json:"BOMRef"`
}

type trivyVulnerabilitySource struct {
	ID   string `json:"ID"`
	Name string `json:"Name"`
	URL  string `json:"URL"`
}

type TrivyParser struct{}

func (p *TrivyParser) CanParse(data []byte) bool {
	var probe struct {
		SchemaVersion *int `json:"SchemaVersion"`
		Results       []struct {
			Target          string `json:"Target"`
			Vulnerabilities []any  `json:"Vulnerabilities"`
		} `json:"Results"`
	}

	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}

	if probe.SchemaVersion == nil || len(probe.Results) == 0 {
		return false
	}

	for _, r := range probe.Results {
		if r.Vulnerabilities != nil {
			return true
		}
	}

	return false
}

func (p *TrivyParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report trivyReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("trivy parse: unmarshal report: %w", err)
	}

	findings := make([]domain.Finding, 0, 128)

	for _, result := range report.Results {
		if len(result.Vulnerabilities) == 0 {
			continue
		}

		for _, vuln := range result.Vulnerabilities {
			f := domain.Finding{
				Title:            buildTrivyTitle(vuln),
				Description:      buildTrivyDescription(report, result, vuln),
				Severity:         mapTrivySeverity(vuln.Severity),
				Confidence:       mapTrivyConfidence(vuln),
				Status:           domain.StatusOpen,
				FilePath:         buildTrivyFilePath(report, result, vuln),
				Component:        strings.TrimSpace(vuln.PkgName),
				ComponentVersion: strings.TrimSpace(vuln.InstalledVersion),
				CVEIDs:           buildTrivyVulnIDs(vuln),
				CWEIDs:           parseTrivyCWEs(vuln.CweIDs),
				CPEURI:           "",
				SourceType:       "trivy",
			}

			f.Fingerprint = calculateTrivyFingerprint(report, result, vuln, f)
			findings = append(findings, f)
		}
	}

	if len(findings) == 0 {
		return nil, fmt.Errorf("trivy parse: no vulnerabilities found")
	}

	return findings, nil
}

func buildTrivyTitle(v trivyVulnerability) string {
	title := strings.TrimSpace(v.Title)
	vulnID := strings.TrimSpace(v.VulnerabilityID)
	pkg := strings.TrimSpace(v.PkgName)

	switch {
	case title != "" && vulnID != "" && pkg != "":
		return fmt.Sprintf("%s [%s in %s]", title, vulnID, pkg)
	case title != "" && vulnID != "":
		return fmt.Sprintf("%s [%s]", title, vulnID)
	case vulnID != "" && pkg != "":
		return fmt.Sprintf("%s in %s", vulnID, pkg)
	case title != "":
		return title
	case vulnID != "":
		return vulnID
	case pkg != "":
		return fmt.Sprintf("Vulnerability in %s", pkg)
	default:
		return "Trivy vulnerability"
	}
}

func buildTrivyDescription(report trivyReport, result trivyResult, v trivyVulnerability) string {
	parts := make([]string, 0, 12)

	if desc := strings.TrimSpace(v.Description); desc != "" {
		parts = append(parts, desc)
	}
	if fixed := strings.TrimSpace(v.FixedVersion); fixed != "" {
		parts = append(parts, "Fixed version: "+fixed)
	}
	if status := strings.TrimSpace(v.Status); status != "" {
		parts = append(parts, "Status: "+status)
	}
	if result.Target != "" {
		parts = append(parts, "Target: "+strings.TrimSpace(result.Target))
	}
	if result.Class != "" {
		parts = append(parts, "Class: "+strings.TrimSpace(result.Class))
	}
	if result.Type != "" {
		parts = append(parts, "Type: "+strings.TrimSpace(result.Type))
	}
	if report.ArtifactName != "" {
		parts = append(parts, "Artifact: "+strings.TrimSpace(report.ArtifactName))
	}
	if report.ArtifactType != "" {
		parts = append(parts, "Artifact type: "+strings.TrimSpace(report.ArtifactType))
	}
	if purl := strings.TrimSpace(v.PkgIdentifier.PURL); purl != "" {
		parts = append(parts, "PURL: "+purl)
	}
	if ref := strings.TrimSpace(v.PrimaryURL); ref != "" {
		parts = append(parts, "Reference: "+ref)
	}
	if ds := strings.TrimSpace(v.DataSource.Name); ds != "" {
		parts = append(parts, "Data source: "+ds)
	}
	if dsURL := strings.TrimSpace(v.DataSource.URL); dsURL != "" {
		parts = append(parts, "Data source URL: "+dsURL)
	}

	return strings.Join(parts, "\n\n")
}

func buildTrivyFilePath(report trivyReport, result trivyResult, v trivyVulnerability) string {
	if pkgPath := strings.TrimSpace(v.PkgPath); pkgPath != "" {
		return pkgPath
	}
	if target := strings.TrimSpace(result.Target); target != "" {
		return target
	}
	return strings.TrimSpace(report.ArtifactName)
}

func buildTrivyVulnIDs(v trivyVulnerability) []string {
	id := strings.TrimSpace(v.VulnerabilityID)
	if id == "" {
		return nil
	}
	return []string{id}
}

func parseTrivyCWEs(cweIDs []string) []int {
	out := make([]int, 0, len(cweIDs))
	for _, raw := range cweIDs {
		s := strings.TrimSpace(strings.ToUpper(raw))
		s = strings.TrimPrefix(s, "CWE-")
		if s == "" {
			continue
		}

		var id int
		if _, err := fmt.Sscanf(s, "%d", &id); err == nil && id > 0 {
			out = append(out, id)
		}
	}
	return out
}

func mapTrivySeverity(severity string) int {
	switch strings.ToUpper(strings.TrimSpace(severity)) {
	case "CRITICAL":
		return domain.SeverityCritical
	case "HIGH":
		return domain.SeverityHigh
	case "MEDIUM":
		return domain.SeverityMedium
	case "LOW":
		return domain.SeverityLow
	default:
		return domain.SeverityInfo
	}
}

func mapTrivyConfidence(v trivyVulnerability) int {
	score := 0
	if strings.TrimSpace(v.VulnerabilityID) != "" {
		score++
	}
	if strings.TrimSpace(v.PkgName) != "" {
		score++
	}
	if strings.TrimSpace(v.InstalledVersion) != "" {
		score++
	}

	switch {
	case score >= 3:
		return 3
	case score == 2:
		return 2
	case score == 1:
		return 1
	default:
		return 0
	}
}

func calculateTrivyFingerprint(report trivyReport, result trivyResult, v trivyVulnerability, f domain.Finding) string {
	parts := []string{
		"trivy",
		strings.TrimSpace(v.VulnerabilityID),
		strings.TrimSpace(v.PkgIdentifier.PURL),
		strings.TrimSpace(v.PkgName),
		strings.TrimSpace(v.InstalledVersion),
		strings.TrimSpace(result.Target),
		strings.TrimSpace(v.PkgPath),
		strings.TrimSpace(report.ArtifactName),
	}

	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}
