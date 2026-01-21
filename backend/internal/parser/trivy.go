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
		if len(r.Vulnerabilities) > 0 || len(r.Secrets) > 0 ||
			len(r.Misconfigurations) > 0 || len(r.Licenses) > 0 {
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
			findings = append(findings, p.buildVulnerabilityFinding(result, vuln))
		}

		// ---------- Secrets ----------
		for _, secret := range result.Secrets {
			findings = append(findings, p.buildSecretFinding(result, secret))
		}

		// ---------- Misconfigurations ----------
		for _, misconf := range result.Misconfigurations {
			findings = append(findings, p.buildMisconfigurationFinding(result, misconf))
		}

		// ---------- Licenses ----------
		for _, license := range result.Licenses {
			findings = append(findings, p.buildLicenseFinding(result, license))
		}
	}

	return findings, nil
}

func (p *TrivyParser) buildVulnerabilityFinding(result trivyResult, vuln trivyVulnerability) Finding {
	title := strings.TrimSpace(vuln.Title)
	if title == "" {
		title = vuln.VulnerabilityID
	}

	// Location includes package name and version for better identification
	location := strings.TrimSpace(result.Target)
	if location == "" {
		location = vuln.PkgName
	}
	if vuln.PkgPath != "" {
		location = vuln.PkgPath
	}

	desc := strings.TrimSpace(vuln.Description)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	// Build comprehensive RawData
	rawData := map[string]any{
		"type":    "vulnerability",
		"package": vuln.PkgName,
	}
	if vuln.PrimaryURL != "" {
		rawData["url"] = vuln.PrimaryURL
	}
	if vuln.InstalledVersion != "" {
		rawData["installed_version"] = vuln.InstalledVersion
	}
	if vuln.FixedVersion != "" {
		rawData["fixed_version"] = vuln.FixedVersion
	}
	if vuln.Status != "" {
		rawData["status"] = vuln.Status
	}
	if vuln.PkgPath != "" {
		rawData["pkg_path"] = vuln.PkgPath
	}
	if vuln.PkgID != "" {
		rawData["pkg_id"] = vuln.PkgID
	}
	if len(vuln.References) > 0 {
		rawData["references"] = vuln.References
	}
	if len(vuln.CweIDs) > 0 {
		rawData["cwe_ids"] = vuln.CweIDs
	}
	if len(vuln.VendorIDs) > 0 {
		rawData["vendor_ids"] = vuln.VendorIDs
	}
	if vuln.SeveritySource != "" {
		rawData["severity_source"] = vuln.SeveritySource
	}
	if len(vuln.VendorSeverity) > 0 {
		rawData["vendor_severity"] = vuln.VendorSeverity
	}
	if vuln.PublishedDate != "" {
		rawData["published_date"] = vuln.PublishedDate
	}
	if vuln.LastModifiedDate != "" {
		rawData["last_modified_date"] = vuln.LastModifiedDate
	}
	if result.Type != "" {
		rawData["target_type"] = result.Type
	}
	if result.Class != "" {
		rawData["class"] = result.Class
	}
	if vuln.Layer != nil {
		rawData["layer"] = map[string]string{
			"digest":  vuln.Layer.Digest,
			"diff_id": vuln.Layer.DiffID,
		}
	}
	if vuln.DataSource != nil {
		rawData["data_source"] = map[string]string{
			"id":   vuln.DataSource.ID,
			"name": vuln.DataSource.Name,
			"url":  vuln.DataSource.URL,
		}
	}

	// Build Evidence with actionable information
	evidence := buildVulnerabilityEvidence(vuln)

	return Finding{
		Title:       title,
		Description: descPtr,
		Severity:    mapTrivySeverity(vuln.Severity),
		Location:    location,
		RuleID:      vuln.VulnerabilityID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildVulnerabilityEvidence(vuln trivyVulnerability) map[string]any {
	evidence := map[string]any{
		"scannerType": "trivy",
		"findingType": "vulnerability",
	}

	if vuln.PkgName != "" {
		evidence["package"] = vuln.PkgName
	}
	if vuln.InstalledVersion != "" {
		evidence["installed_version"] = vuln.InstalledVersion
	}
	if vuln.FixedVersion != "" {
		evidence["fixed_version"] = vuln.FixedVersion
	}
	if vuln.Status != "" {
		evidence["status"] = vuln.Status
	}

	// Include CVSS data if available
	if len(vuln.CVSS) > 0 {
		cvssData := make(map[string]any)
		for source, cvss := range vuln.CVSS {
			sourceData := make(map[string]any)
			if cvss.V3Score > 0 {
				sourceData["v3_score"] = cvss.V3Score
			}
			if cvss.V3Vector != "" {
				sourceData["v3_vector"] = cvss.V3Vector
			}
			if cvss.V2Score > 0 {
				sourceData["v2_score"] = cvss.V2Score
			}
			if cvss.V2Vector != "" {
				sourceData["v2_vector"] = cvss.V2Vector
			}
			if len(sourceData) > 0 {
				cvssData[source] = sourceData
			}
		}
		if len(cvssData) > 0 {
			evidence["cvss"] = cvssData
		}
	}

	if len(vuln.CweIDs) > 0 {
		evidence["cwe_ids"] = vuln.CweIDs
	}

	return evidence
}

func (p *TrivyParser) buildSecretFinding(result trivyResult, secret trivySecret) Finding {
	location := result.Target
	if secret.StartLine > 0 {
		location = fmt.Sprintf("%s:%d", location, secret.StartLine)
	}

	rawData := map[string]any{
		"type":     "secret",
		"category": secret.Category,
	}
	if secret.StartLine > 0 || secret.EndLine > 0 {
		rawData["lines"] = fmt.Sprintf("%d-%d", secret.StartLine, secret.EndLine)
	}
	if result.Type != "" {
		rawData["target_type"] = result.Type
	}

	evidence := map[string]any{
		"scannerType": "trivy",
		"findingType": "secret",
		"category":    secret.Category,
	}
	if secret.StartLine > 0 {
		evidence["start_line"] = secret.StartLine
	}
	if secret.EndLine > 0 {
		evidence["end_line"] = secret.EndLine
	}
	if secret.Match != "" {
		// Redact potential secrets but show pattern
		evidence["match_pattern"] = redactSecret(secret.Match)
	}
	if secret.Code != nil && len(secret.Code.Lines) > 0 {
		codeLines := make([]map[string]any, 0, len(secret.Code.Lines))
		for _, line := range secret.Code.Lines {
			codeLine := map[string]any{
				"number":   line.Number,
				"is_cause": line.IsCause,
			}
			if line.IsCause {
				codeLine["content"] = redactSecret(line.Content)
			} else {
				codeLine["content"] = line.Content
			}
			codeLines = append(codeLines, codeLine)
		}
		evidence["code"] = codeLines
	}

	return Finding{
		Title:    secret.Title,
		Severity: mapTrivySeverity(secret.Severity),
		Location: location,
		RuleID:   secret.RuleID,
		RawData:  rawData,
		Evidence: evidence,
	}
}

func (p *TrivyParser) buildMisconfigurationFinding(result trivyResult, misconf trivyMisconfiguration) Finding {
	title := strings.TrimSpace(misconf.Title)
	if title == "" {
		title = misconf.ID
	}

	location := result.Target
	if misconf.CauseMetadata != nil && misconf.CauseMetadata.StartLine > 0 {
		location = fmt.Sprintf("%s:%d", location, misconf.CauseMetadata.StartLine)
	}

	desc := strings.TrimSpace(misconf.Description)
	if desc == "" {
		desc = misconf.Message
	}
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	ruleID := misconf.ID
	if ruleID == "" {
		ruleID = misconf.AVDID
	}

	rawData := map[string]any{
		"type": "misconfiguration",
	}
	if misconf.Type != "" {
		rawData["misconf_type"] = misconf.Type
	}
	if misconf.Namespace != "" {
		rawData["namespace"] = misconf.Namespace
	}
	if misconf.Query != "" {
		rawData["query"] = misconf.Query
	}
	if misconf.PrimaryURL != "" {
		rawData["url"] = misconf.PrimaryURL
	}
	if len(misconf.References) > 0 {
		rawData["references"] = misconf.References
	}
	if misconf.Status != "" {
		rawData["status"] = misconf.Status
	}
	if result.Type != "" {
		rawData["target_type"] = result.Type
	}
	if result.Class != "" {
		rawData["class"] = result.Class
	}
	if misconf.Layer != nil {
		rawData["layer"] = map[string]string{
			"digest":  misconf.Layer.Digest,
			"diff_id": misconf.Layer.DiffID,
		}
	}
	if misconf.CauseMetadata != nil {
		cause := map[string]any{}
		if misconf.CauseMetadata.Resource != "" {
			cause["resource"] = misconf.CauseMetadata.Resource
		}
		if misconf.CauseMetadata.Provider != "" {
			cause["provider"] = misconf.CauseMetadata.Provider
		}
		if misconf.CauseMetadata.Service != "" {
			cause["service"] = misconf.CauseMetadata.Service
		}
		if len(cause) > 0 {
			rawData["cause"] = cause
		}
	}

	evidence := map[string]any{
		"scannerType": "trivy",
		"findingType": "misconfiguration",
	}
	if misconf.Type != "" {
		evidence["misconf_type"] = misconf.Type
	}
	if misconf.Resolution != "" {
		evidence["resolution"] = misconf.Resolution
	}
	if misconf.Message != "" {
		evidence["message"] = misconf.Message
	}
	if misconf.CauseMetadata != nil {
		if misconf.CauseMetadata.StartLine > 0 {
			evidence["start_line"] = misconf.CauseMetadata.StartLine
		}
		if misconf.CauseMetadata.EndLine > 0 {
			evidence["end_line"] = misconf.CauseMetadata.EndLine
		}
		if misconf.CauseMetadata.Code != nil && len(misconf.CauseMetadata.Code.Lines) > 0 {
			codeLines := make([]map[string]any, 0, len(misconf.CauseMetadata.Code.Lines))
			for _, line := range misconf.CauseMetadata.Code.Lines {
				codeLines = append(codeLines, map[string]any{
					"number":   line.Number,
					"content":  line.Content,
					"is_cause": line.IsCause,
				})
			}
			evidence["code"] = codeLines
		}
	}

	return Finding{
		Title:       title,
		Description: descPtr,
		Severity:    mapTrivySeverity(misconf.Severity),
		Location:    location,
		RuleID:      ruleID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func (p *TrivyParser) buildLicenseFinding(result trivyResult, license trivyLicense) Finding {
	title := fmt.Sprintf("License: %s", license.Name)
	if license.PkgName != "" {
		title = fmt.Sprintf("%s in %s", license.Name, license.PkgName)
	}

	location := result.Target
	if license.FilePath != "" {
		location = license.FilePath
	}

	rawData := map[string]any{
		"type":         "license",
		"license_name": license.Name,
	}
	if license.Category != "" {
		rawData["category"] = license.Category
	}
	if license.PkgName != "" {
		rawData["package"] = license.PkgName
	}
	if license.Link != "" {
		rawData["url"] = license.Link
	}
	if license.Confidence > 0 {
		rawData["confidence"] = license.Confidence
	}
	if result.Type != "" {
		rawData["target_type"] = result.Type
	}

	evidence := map[string]any{
		"scannerType":  "trivy",
		"findingType":  "license",
		"license_name": license.Name,
	}
	if license.Category != "" {
		evidence["category"] = license.Category
	}
	if license.PkgName != "" {
		evidence["package"] = license.PkgName
	}
	if license.Confidence > 0 {
		evidence["confidence"] = license.Confidence
	}

	return Finding{
		Title:    title,
		Severity: mapTrivySeverity(license.Severity),
		Location: location,
		RuleID:   fmt.Sprintf("license-%s", strings.ToLower(strings.ReplaceAll(license.Name, " ", "-"))),
		RawData:  rawData,
		Evidence: evidence,
	}
}

// redactSecret masks potential secret values while preserving pattern for identification
func redactSecret(s string) string {
	if len(s) <= 8 {
		return "***REDACTED***"
	}
	// Show first 4 and last 4 characters
	return s[:4] + "***REDACTED***" + s[len(s)-4:]
}

// ---------- Models ----------

type trivyReport struct {
	ArtifactName string        `json:"ArtifactName"`
	Results      []trivyResult `json:"Results"`
}

type trivyResult struct {
	Target            string                     `json:"Target"`
	Class             string                     `json:"Class"`
	Type              string                     `json:"Type"`
	Vulnerabilities   []trivyVulnerability       `json:"Vulnerabilities"`
	Secrets           []trivySecret              `json:"Secrets"`
	Misconfigurations []trivyMisconfiguration    `json:"Misconfigurations"`
	Licenses          []trivyLicense             `json:"Licenses"`
}

type trivyVulnerability struct {
	VulnerabilityID  string              `json:"VulnerabilityID"`
	VendorIDs        []string            `json:"VendorIDs"`
	PkgID            string              `json:"PkgID"`
	PkgName          string              `json:"PkgName"`
	PkgPath          string              `json:"PkgPath"`
	InstalledVersion string              `json:"InstalledVersion"`
	FixedVersion     string              `json:"FixedVersion"`
	Status           string              `json:"Status"`
	Title            string              `json:"Title"`
	Description      string              `json:"Description"`
	Severity         string              `json:"Severity"`
	SeveritySource   string              `json:"SeveritySource"`
	PrimaryURL       string              `json:"PrimaryURL"`
	References       []string            `json:"References"`
	CweIDs           []string            `json:"CweIDs"`
	CVSS             map[string]trivyCVSS `json:"CVSS"`
	VendorSeverity   map[string]int      `json:"VendorSeverity"`
	PublishedDate    string              `json:"PublishedDate"`
	LastModifiedDate string              `json:"LastModifiedDate"`
	Layer            *trivyLayer         `json:"Layer"`
	DataSource       *trivyDataSource    `json:"DataSource"`
}

type trivyCVSS struct {
	V2Vector string  `json:"V2Vector"`
	V3Vector string  `json:"V3Vector"`
	V2Score  float64 `json:"V2Score"`
	V3Score  float64 `json:"V3Score"`
}

type trivyLayer struct {
	Digest string `json:"Digest"`
	DiffID string `json:"DiffID"`
}

type trivyDataSource struct {
	ID   string `json:"ID"`
	Name string `json:"Name"`
	URL  string `json:"URL"`
}

type trivySecret struct {
	RuleID    string `json:"RuleID"`
	Category  string `json:"Category"`
	Severity  string `json:"Severity"`
	Title     string `json:"Title"`
	StartLine int    `json:"StartLine"`
	EndLine   int    `json:"EndLine"`
	Match     string `json:"Match"`
	Code      *trivyCode `json:"Code"`
}

type trivyCode struct {
	Lines []trivyCodeLine `json:"Lines"`
}

type trivyCodeLine struct {
	Number      int    `json:"Number"`
	Content     string `json:"Content"`
	IsCause     bool   `json:"IsCause"`
	Highlighted string `json:"Highlighted"`
}

type trivyMisconfiguration struct {
	Type        string       `json:"Type"`
	ID          string       `json:"ID"`
	AVDID       string       `json:"AVDID"`
	Title       string       `json:"Title"`
	Description string       `json:"Description"`
	Message     string       `json:"Message"`
	Namespace   string       `json:"Namespace"`
	Query       string       `json:"Query"`
	Resolution  string       `json:"Resolution"`
	Severity    string       `json:"Severity"`
	PrimaryURL  string       `json:"PrimaryURL"`
	References  []string     `json:"References"`
	Status      string       `json:"Status"`
	Layer       *trivyLayer  `json:"Layer"`
	CauseMetadata *trivyCauseMetadata `json:"CauseMetadata"`
}

type trivyCauseMetadata struct {
	Resource  string `json:"Resource"`
	Provider  string `json:"Provider"`
	Service   string `json:"Service"`
	StartLine int    `json:"StartLine"`
	EndLine   int    `json:"EndLine"`
	Code      *trivyCode `json:"Code"`
}

type trivyLicense struct {
	Severity   string `json:"Severity"`
	Category   string `json:"Category"`
	PkgName    string `json:"PkgName"`
	FilePath   string `json:"FilePath"`
	Name       string `json:"Name"`
	Confidence float64 `json:"Confidence"`
	Link       string `json:"Link"`
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
	case "UNKNOWN":
		return models.SeverityLow // Map UNKNOWN to low as safest default
	default:
		return models.SeverityLow
	}
}
