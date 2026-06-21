package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"sort"
	"strconv"
	"strings"

	"github.com/microcosm-cc/bluemonday"

	"redlycoris/internal/domain"
)

const appScreenerSourceType = "appscreener"

type AppScreenerParser struct{}

type appScreenerClassifications struct {
	CWE []string `json:"cwe"`
}

type appScreenerSCAOrigin struct {
	ScaID                 string                 `json:"scaId"`
	Severity              *int                   `json:"severity"`
	Description           string                 `json:"description"`
	CWE                   []string               `json:"cwe"`
	Rating                []appScreenerSCARating `json:"rating"`
	Aliases               []string               `json:"aliases"`
	VersionEnd            string                 `json:"versionEnd"`
	VersionEndIsIncluding bool                   `json:"versionEndIsIncluding"`
}

type appScreenerSCARating struct {
	Method   string `json:"method"`
	Severity string `json:"severity"`
}

type appScreenerComponentOrigin struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Purl    string `json:"purl"`
	CPE     string `json:"cpe"`
	Type    string `json:"type"`
}

func (p *AppScreenerParser) CanParse(data []byte) bool {
	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}
	if !isSARIFReport(report) || len(report.Runs) == 0 {
		return false
	}
	return isAppScreenerDriver(report.Runs[0].Tool.Driver)
}

func (p *AppScreenerParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	_ = ctx

	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.AppScreenerParser.Parse: unmarshal: %w", err)
	}

	sanitizer := bluemonday.UGCPolicy()
	findings := make([]domain.Finding, 0, 128)

	for _, run := range report.Runs {
		ruleByID := make(map[string]sarifRule, len(run.Tool.Driver.Rules))
		for _, rule := range run.Tool.Driver.Rules {
			ruleByID[rule.ID] = rule
		}

		for _, result := range run.Results {
			var f domain.Finding
			if origin, ok := appScreenerResultOrigin(result); ok || strings.EqualFold(strings.TrimSpace(result.RuleID), "SCA") {
				f = buildAppScreenerSCAFinding(result, origin, sanitizer)
			} else {
				f = buildAppScreenerSASTFinding(result, ruleByID[strings.TrimSpace(result.RuleID)], sanitizer)
			}
			f.Fingerprint = domain.CalculateFingerprint(&f)
			findings = append(findings, f)
		}
	}

	return findings, nil
}

func isSARIFReport(report sarifReport) bool {
	schema := strings.ToLower(strings.TrimSpace(report.Schema))
	version := strings.TrimSpace(report.Version)
	return strings.Contains(schema, "sarif") || version == "2.1.0"
}

func isAppScreenerDriver(driver sarifDriver) bool {
	name := normalizeAppScreenerIdentity(driver.Name)
	product := normalizeAppScreenerIdentity(driver.Product)
	org := normalizeAppScreenerIdentity(driver.Organization)
	fullName := normalizeAppScreenerIdentity(driver.FullName)

	return name == appScreenerSourceType ||
		product == appScreenerSourceType ||
		strings.Contains(org, appScreenerSourceType) ||
		strings.Contains(fullName, appScreenerSourceType) ||
		strings.Contains(org, "solar "+appScreenerSourceType) ||
		strings.Contains(fullName, "solar "+appScreenerSourceType)
}

func normalizeAppScreenerIdentity(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func buildAppScreenerSASTFinding(result sarifResult, rule sarifRule, sanitizer *bluemonday.Policy) domain.Finding {
	loc := firstSARIFLocation(result)
	filePath, lineStart, lineEnd := extractPrimaryLocation(loc, result)
	title := firstNonEmpty(strings.TrimSpace(rule.Name), strings.TrimSpace(result.Message.Text), strings.TrimSpace(result.RuleID), "appScreener SAST finding")
	level := firstNonEmpty(strings.TrimSpace(result.Level), strings.TrimSpace(rule.DefaultConfig.Level))
	ruleID := emptyToNil(firstNonEmpty(strings.TrimSpace(result.RuleID), strings.TrimSpace(rule.ID)))
	ruleName := emptyToNil(strings.TrimSpace(rule.Name))

	f := domain.Finding{
		Kind:        domain.KindSAST,
		Title:       title,
		Description: sanitizeAppScreenerDescription(sanitizer, rule.FullDescription.Text),
		Severity:    appScreenerSASTSeverity(result, loc, level),
		Confidence:  mapSARIFConfidence("", level),
		Status:      domain.StatusOpen,
		FilePath:    filePath,
		LineStart:   lineStart,
		LineEnd:     lineEnd,
		CVEIDs:      []string{},
		CWEIDs:      appScreenerRuleCWEIDs(rule),
		SourceType:  appScreenerSourceType,
		RuleID:      ruleID,
		RuleName:    ruleName,
	}

	if snippet := extractBestSnippet(loc); snippet != "" {
		f.CodeSnippet = &snippet
	}

	return f
}

func buildAppScreenerSCAFinding(result sarifResult, origin appScreenerSCAOrigin, sanitizer *bluemonday.Policy) domain.Finding {
	component := appScreenerComponent(result)
	purl := emptyToNil(component.Purl)
	ecosystem := appScreenerPackageEcosystem(component)
	fixedVersion := appScreenerFixedVersion(origin)
	level := strings.TrimSpace(result.Level)
	ruleID := emptyToNil(strings.TrimSpace(result.RuleID))

	f := domain.Finding{
		Kind:             domain.KindSCA,
		Title:            buildAppScreenerSCATitle(origin, component),
		Description:      sanitizeAppScreenerDescription(sanitizer, origin.Description),
		Severity:         appScreenerSCASeverity(origin, level),
		Confidence:       mapSARIFConfidence("", level),
		Status:           domain.StatusOpen,
		Component:        strings.TrimSpace(component.Name),
		ComponentVersion: strings.TrimSpace(component.Version),
		CVEIDs:           appScreenerCVEs(origin),
		CWEIDs:           parseAppScreenerCWEIDs(origin.CWE),
		CPEURI:           strings.TrimSpace(component.CPE),
		FixedVersion:     fixedVersion,
		PackageEcosystem: ecosystem,
		Purl:             purl,
		SourceType:       appScreenerSourceType,
		RuleID:           ruleID,
	}

	applyPURLMetadata(&f)
	return f
}

func appScreenerResultOrigin(result sarifResult) (appScreenerSCAOrigin, bool) {
	var origin appScreenerSCAOrigin
	raw, ok := result.Properties.Raw["x-origin"]
	if !ok || len(raw) == 0 || strings.TrimSpace(string(raw)) == "null" {
		return origin, false
	}
	if err := json.Unmarshal(raw, &origin); err != nil {
		return appScreenerSCAOrigin{}, false
	}
	return origin, true
}

func appScreenerComponent(result sarifResult) appScreenerComponentOrigin {
	loc := firstSARIFLocation(result)
	if loc == nil || len(loc.LogicalLocations) == 0 {
		return appScreenerComponentOrigin{}
	}

	logical := loc.LogicalLocations[0]
	var component appScreenerComponentOrigin
	raw, ok := logical.Properties.Raw["x-origin"]
	if ok && len(raw) > 0 && strings.TrimSpace(string(raw)) != "null" {
		_ = json.Unmarshal(raw, &component)
	}
	if strings.TrimSpace(component.Name) == "" {
		component.Name = logical.Name
	}
	return component
}

func appScreenerRuleCWEIDs(rule sarifRule) []int {
	raw, ok := rule.Properties.Raw["x-classifications"]
	if !ok || len(raw) == 0 {
		return []int{}
	}
	var classifications appScreenerClassifications
	if err := json.Unmarshal(raw, &classifications); err != nil {
		return []int{}
	}
	return parseAppScreenerCWEIDs(classifications.CWE)
}

func parseAppScreenerCWEIDs(values []string) []int {
	seen := make(map[int]struct{})
	for _, value := range values {
		normalized := strings.TrimPrefix(strings.ToUpper(strings.TrimSpace(value)), "CWE-")
		id, err := strconv.Atoi(normalized)
		if err != nil || id <= 0 {
			continue
		}
		seen[id] = struct{}{}
	}
	if len(seen) == 0 {
		return []int{}
	}

	ids := make([]int, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids
}

func appScreenerSASTSeverity(result sarifResult, loc *sarifLocation, level string) int {
	if loc != nil {
		if severity, ok := appScreenerSeverityFromRaw(loc.Properties.Raw["x-severity"]); ok {
			return severity
		}
	}
	if severity, ok := appScreenerSeverityFromRaw(result.Properties.Raw["x-severity"]); ok {
		return severity
	}
	return appScreenerLevelSeverity(level)
}

func appScreenerSCASeverity(origin appScreenerSCAOrigin, level string) int {
	if severity, ok := appScreenerRatingSeverity(origin.Rating); ok {
		return severity
	}
	if origin.Severity != nil {
		return clampInt(*origin.Severity, domain.SeverityInfo, domain.SeverityCritical)
	}
	return appScreenerLevelSeverity(level)
}

func appScreenerRatingSeverity(ratings []appScreenerSCARating) (int, bool) {
	methods := []string{"cvssv4", "cvssv3.1", "cvssv3", "cvssv2"}
	for _, method := range methods {
		for _, rating := range ratings {
			if strings.Contains(strings.ToLower(strings.TrimSpace(rating.Method)), method) {
				if severity, ok := appScreenerSeverityText(rating.Severity); ok {
					return severity, true
				}
			}
		}
	}
	for _, rating := range ratings {
		if severity, ok := appScreenerSeverityText(rating.Severity); ok {
			return severity, true
		}
	}
	return domain.SeverityInfo, false
}

func appScreenerSeverityText(value string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "critical":
		return domain.SeverityCritical, true
	case "high":
		return domain.SeverityHigh, true
	case "medium", "moderate":
		return domain.SeverityMedium, true
	case "low":
		return domain.SeverityLow, true
	case "info", "informational", "none":
		return domain.SeverityInfo, true
	default:
		return domain.SeverityInfo, false
	}
}

func appScreenerSeverityFromRaw(raw json.RawMessage) (int, bool) {
	if len(raw) == 0 {
		return domain.SeverityInfo, false
	}
	var n int
	if err := json.Unmarshal(raw, &n); err == nil {
		return clampInt(n, domain.SeverityInfo, domain.SeverityCritical), true
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		n, err := strconv.Atoi(strings.TrimSpace(s))
		if err == nil {
			return clampInt(n, domain.SeverityInfo, domain.SeverityCritical), true
		}
	}
	return domain.SeverityInfo, false
}

func appScreenerLevelSeverity(level string) int {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "error":
		return domain.SeverityHigh
	case "warning":
		return domain.SeverityMedium
	case "note":
		return domain.SeverityLow
	default:
		return domain.SeverityInfo
	}
}

func appScreenerCVEs(origin appScreenerSCAOrigin) []string {
	seen := make(map[string]struct{})
	add := func(value string) {
		for _, match := range cveRegex.FindAllString(value, -1) {
			seen[strings.ToUpper(match)] = struct{}{}
		}
	}

	add(origin.ScaID)
	for _, alias := range origin.Aliases {
		add(alias)
	}

	if len(seen) == 0 {
		return []string{}
	}
	out := make([]string, 0, len(seen))
	for cve := range seen {
		out = append(out, cve)
	}
	sort.Strings(out)
	return out
}

func appScreenerPackageEcosystem(component appScreenerComponentOrigin) *string {
	if purl := strings.TrimSpace(component.Purl); purl != "" {
		ecosystem, _, _ := parsePURLMetadata(purl)
		if ecosystem != "" {
			return &ecosystem
		}
	}
	if componentType := strings.TrimSpace(component.Type); componentType != "" {
		return &componentType
	}
	return nil
}

func appScreenerFixedVersion(origin appScreenerSCAOrigin) *string {
	version := strings.TrimSpace(origin.VersionEnd)
	if version == "" || origin.VersionEndIsIncluding {
		return nil
	}
	return &version
}

func buildAppScreenerSCATitle(origin appScreenerSCAOrigin, component appScreenerComponentOrigin) string {
	scaID := strings.TrimSpace(origin.ScaID)
	componentText := strings.TrimSpace(strings.Join([]string{
		strings.TrimSpace(component.Name),
		strings.TrimSpace(component.Version),
	}, " "))

	switch {
	case scaID != "" && componentText != "":
		return fmt.Sprintf("%s: %s", scaID, componentText)
	case scaID != "":
		return scaID
	case componentText != "":
		return fmt.Sprintf("Vulnerability in %s", componentText)
	default:
		return "appScreener SCA finding"
	}
}

func sanitizeAppScreenerDescription(policy *bluemonday.Policy, raw string) string {
	sanitized := strings.TrimSpace(policy.Sanitize(raw))
	if sanitized == "" {
		return ""
	}
	plain := strings.TrimSpace(bluemonday.StrictPolicy().Sanitize(sanitized))
	return html.UnescapeString(plain)
}
