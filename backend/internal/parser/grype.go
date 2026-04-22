package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"redlycoris/internal/domain"
)

type grypeReport struct {
	Matches    []grypeMatch `json:"matches"`
	Source     grypeSource  `json:"source"`
	Descriptor struct {
		Name string `json:"name"`
	} `json:"descriptor"`
}

type grypeSource struct {
	Type   string `json:"type"`
	Target string `json:"target"`
}

type grypeMatch struct {
	Vulnerability grypeVulnerability `json:"vulnerability"`
	Artifact      grypeArtifact      `json:"artifact"`
}

type grypeVulnerability struct {
	ID          string   `json:"id"`
	Severity    string   `json:"severity"`
	Description string   `json:"description"`
	DataSource  string   `json:"dataSource"`
	Namespace   string   `json:"namespace"`
	CWEIDs      []string `json:"cweIDs"`
	Fix         struct {
		Versions []string `json:"versions"`
		State    string   `json:"state"`
	} `json:"fix"`
}

type grypeArtifact struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Type      string `json:"type"`
	Language  string `json:"language"`
	PURL      string `json:"purl"`
	Locations []struct {
		Path string `json:"path"`
	} `json:"locations"`
}

type GrypeParser struct{}

func (p *GrypeParser) CanParse(data []byte) bool {
	var probe struct {
		Matches    json.RawMessage `json:"matches"`
		Descriptor struct {
			Name string `json:"name"`
		} `json:"descriptor"`
	}

	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}

	if len(probe.Matches) == 0 {
		return false
	}

	if strings.EqualFold(strings.TrimSpace(probe.Descriptor.Name), "grype") {
		return true
	}

	var matches []struct {
		Vulnerability struct {
			ID string `json:"id"`
		} `json:"vulnerability"`
		Artifact struct {
			Name string `json:"name"`
		} `json:"artifact"`
	}
	if err := json.Unmarshal(probe.Matches, &matches); err != nil {
		return false
	}
	if len(matches) == 0 {
		return true
	}

	first := matches[0]
	return strings.TrimSpace(first.Vulnerability.ID) != "" || strings.TrimSpace(first.Artifact.Name) != ""
}

func (p *GrypeParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report grypeReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("grype parse: unmarshal report: %w", err)
	}

	findings := make([]domain.Finding, 0, len(report.Matches))

	for _, match := range report.Matches {
		v := match.Vulnerability
		a := match.Artifact

		id := strings.TrimSpace(v.ID)
		component := strings.TrimSpace(a.Name)
		fixedVersion := firstFixedVersion(v.Fix.Versions)
		purl := emptyToNil(a.PURL)

		finding := domain.Finding{
			Kind:             domain.KindSCA,
			Title:            buildGrypeTitle(id, component),
			Description:      buildGrypeDescription(report, match),
			Severity:         mapTrivySeverity(v.Severity),
			Confidence:       mapGrypeConfidence(v, a),
			Status:           domain.StatusOpen,
			FilePath:         firstArtifactPath(a.Locations, report.Source.Target),
			Component:        component,
			ComponentVersion: strings.TrimSpace(a.Version),
			CVEIDs:           buildGrypeCVEIDs(id),
			CWEIDs:           parseTrivyCWEs(v.CWEIDs),
			FixedVersion:     fixedVersion,
			PackageEcosystem: grypePackageEcosystem(a),
			Purl:             purl,
			SourceType:       "grype",
		}
		finding.Fingerprint = domain.CalculateFingerprint(&finding)
		findings = append(findings, finding)
	}

	return findings, nil
}

func buildGrypeTitle(vulnID, component string) string {
	switch {
	case vulnID != "" && component != "":
		return vulnID + " in " + component
	case vulnID != "":
		return vulnID
	case component != "":
		return "Vulnerability in " + component
	default:
		return "Grype vulnerability"
	}
}

func buildGrypeDescription(report grypeReport, m grypeMatch) string {
	parts := make([]string, 0, 8)

	if v := strings.TrimSpace(m.Vulnerability.Description); v != "" {
		parts = append(parts, v)
	}
	if v := strings.TrimSpace(m.Vulnerability.Namespace); v != "" {
		parts = append(parts, "Namespace: "+v)
	}
	if v := strings.TrimSpace(m.Vulnerability.DataSource); v != "" {
		parts = append(parts, "Data source: "+v)
	}
	if v := strings.TrimSpace(m.Artifact.Type); v != "" {
		parts = append(parts, "Package type: "+v)
	}
	if v := strings.TrimSpace(m.Artifact.Language); v != "" {
		parts = append(parts, "Language: "+v)
	}
	if v := strings.TrimSpace(report.Source.Type); v != "" {
		parts = append(parts, "Scan source: "+v)
	}
	if v := strings.TrimSpace(report.Source.Target); v != "" {
		parts = append(parts, "Scan target: "+v)
	}

	return strings.Join(parts, "\n\n")
}

func buildGrypeCVEIDs(vulnID string) []string {
	if strings.HasPrefix(strings.ToUpper(vulnID), "CVE-") {
		return []string{vulnID}
	}
	return []string{}
}

func mapGrypeConfidence(v grypeVulnerability, a grypeArtifact) int {
	score := 0
	if strings.TrimSpace(v.ID) != "" {
		score++
	}
	if strings.TrimSpace(a.Name) != "" {
		score++
	}
	if strings.TrimSpace(a.Version) != "" {
		score++
	}
	if strings.TrimSpace(a.PURL) != "" {
		score++
	}

	switch {
	case score >= 4:
		return 3
	case score >= 2:
		return 2
	case score == 1:
		return 1
	default:
		return 0
	}
}

func firstFixedVersion(versions []string) *string {
	for _, version := range versions {
		if value := strings.TrimSpace(version); value != "" {
			return &value
		}
	}
	return nil
}

func firstArtifactPath(locations []struct {
	Path string `json:"path"`
}, fallback string) string {
	for _, location := range locations {
		if path := strings.TrimSpace(location.Path); path != "" {
			return path
		}
	}
	return strings.TrimSpace(fallback)
}

func grypePackageEcosystem(a grypeArtifact) *string {
	if eco := trivyPackageEcosystem(a.PURL, ""); eco != nil {
		return eco
	}

	switch strings.ToLower(strings.TrimSpace(a.Type)) {
	case "deb":
		return strPtr("debian")
	case "rpm":
		return strPtr("rpm")
	case "apk":
		return strPtr("alpine")
	default:
		return nil
	}
}
