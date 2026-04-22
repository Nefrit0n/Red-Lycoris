package parser

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"redlycoris/internal/domain"
)

type trivyReport struct {
	SchemaVersion int           `json:"SchemaVersion"`
	ArtifactName  string        `json:"ArtifactName"`
	ArtifactType  string        `json:"ArtifactType"`
	Results       []trivyResult `json:"Results"`
}

type trivyResult struct {
	Target            string                  `json:"Target"`
	Class             string                  `json:"Class"`
	Type              string                  `json:"Type"`
	Vulnerabilities   []trivyVulnerability    `json:"Vulnerabilities"`
	Misconfigurations []trivyMisconfiguration `json:"Misconfigurations"`
	Secrets           []trivySecret           `json:"Secrets"`
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

type trivyMisconfiguration struct {
	ID          string `json:"ID"`
	Title       string `json:"Title"`
	Description string `json:"Description"`
	Severity    string `json:"Severity"`
	Resource    string `json:"Resource"`
	Message     string `json:"Message"`
	Resolution  string `json:"Resolution"`
}

type trivySecret struct {
	RuleID    string `json:"RuleID"`
	Title     string `json:"Title"`
	Severity  string `json:"Severity"`
	StartLine int    `json:"StartLine"`
	EndLine   int    `json:"EndLine"`
}

type TrivyParser struct{}

func (p *TrivyParser) CanParse(data []byte) bool {
	var probe struct {
		SchemaVersion *int `json:"SchemaVersion"`
		Results       []struct {
			Target            string `json:"Target"`
			Vulnerabilities   []any  `json:"Vulnerabilities"`
			Misconfigurations []any  `json:"Misconfigurations"`
			Secrets           []any  `json:"Secrets"`
		} `json:"Results"`
	}

	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}

	if probe.SchemaVersion == nil || len(probe.Results) == 0 {
		return false
	}

	for _, r := range probe.Results {
		if r.Vulnerabilities != nil || r.Misconfigurations != nil || r.Secrets != nil {
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
		resultClass := strings.ToLower(strings.TrimSpace(result.Class))

		switch resultClass {
		case "os-pkgs", "lang-pkgs":
			for _, vuln := range result.Vulnerabilities {
				fixedVersion := emptyToNil(vuln.FixedVersion)
				purl := emptyToNil(vuln.PkgIdentifier.PURL)

				f := domain.Finding{
					Kind:             domain.KindSCA,
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
					FixedVersion:     fixedVersion,
					PackageEcosystem: trivyPackageEcosystem(vuln.PkgIdentifier.PURL, result.Type),
					Purl:             purl,
					SourceType:       "trivy",
				}

				f.Fingerprint = calculateTrivyFingerprint(report, result, vuln, f)
				findings = append(findings, f)
			}
		case "config":
			for _, mis := range result.Misconfigurations {
				ruleID := emptyToNil(mis.ID)
				ruleName := emptyToNil(mis.Title)
				iacResource := emptyToNil(mis.Resource)
				iacProvider := emptyToNil(trivyIacProvider(mis.ID))

				f := domain.Finding{
					Kind:        domain.KindIaC,
					Title:       firstNonEmpty(strings.TrimSpace(mis.Title), strings.TrimSpace(mis.ID), "Trivy misconfiguration"),
					Description: buildTrivyMisconfigDescription(result, mis),
					Severity:    mapTrivySeverity(mis.Severity),
					Confidence:  2,
					Status:      domain.StatusOpen,
					FilePath:    strings.TrimSpace(result.Target),
					SourceType:  "trivy",
					RuleID:      ruleID,
					RuleName:    ruleName,
					IacResource: iacResource,
					IacProvider: iacProvider,
				}
				f.Fingerprint = domain.CalculateFingerprint(&f)
				findings = append(findings, f)
			}
		case "secret":
			for _, secret := range result.Secrets {
				secretKind := emptyToNil(secret.RuleID)
				f := domain.Finding{
					Kind:       domain.KindSecrets,
					Title:      firstNonEmpty(strings.TrimSpace(secret.Title), strings.TrimSpace(secret.RuleID), "Trivy secret"),
					Severity:   mapTrivySeverity(secret.Severity),
					Confidence: 2,
					Status:     domain.StatusOpen,
					FilePath:   strings.TrimSpace(result.Target),
					LineStart:  secret.StartLine,
					LineEnd:    secret.EndLine,
					SourceType: "trivy",
					SecretKind: secretKind,
					CVEIDs:     []string{},
					CWEIDs:     []int{},
				}
				f.Fingerprint = domain.CalculateFingerprint(&f)
				findings = append(findings, f)
			}
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

func trivyPackageEcosystem(purl, resultType string) *string {
	purl = strings.TrimSpace(strings.ToLower(purl))
	if strings.HasPrefix(purl, "pkg:") {
		withoutPrefix := strings.TrimPrefix(purl, "pkg:")
		if idx := strings.IndexByte(withoutPrefix, '/'); idx > 0 {
			eco := withoutPrefix[:idx]
			return &eco
		}
	}

	switch strings.ToLower(strings.TrimSpace(resultType)) {
	case "composer":
		return strPtr("composer")
	case "gomod":
		return strPtr("go")
	case "gem":
		return strPtr("rubygems")
	case "nuget":
		return strPtr("nuget")
	case "cargo":
		return strPtr("cargo")
	default:
		return nil
	}
}

func trivyIacProvider(ruleID string) string {
	upper := strings.ToUpper(strings.TrimSpace(ruleID))
	switch {
	case strings.HasPrefix(upper, "AVD-AWS-"):
		return "aws"
	case strings.HasPrefix(upper, "AVD-GCP-"):
		return "gcp"
	case strings.HasPrefix(upper, "AVD-AZURE-"):
		return "azure"
	case strings.HasPrefix(upper, "AVD-K8S-"):
		return "kubernetes"
	default:
		return ""
	}
}

func buildTrivyMisconfigDescription(result trivyResult, m trivyMisconfiguration) string {
	parts := make([]string, 0, 8)
	if v := strings.TrimSpace(m.Description); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(m.Message); v != "" {
		parts = append(parts, "Message: "+v)
	}
	if v := strings.TrimSpace(m.Resolution); v != "" {
		parts = append(parts, "Resolution: "+v)
	}
	if v := strings.TrimSpace(m.Resource); v != "" {
		parts = append(parts, "Resource: "+v)
	}
	if v := strings.TrimSpace(result.Target); v != "" {
		parts = append(parts, "Target: "+v)
	}
	return strings.Join(parts, "\n\n")
}

func emptyToNil(s string) *string {
	v := strings.TrimSpace(s)
	if v == "" {
		return nil
	}
	return &v
}

func strPtr(s string) *string {
	return &s
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
