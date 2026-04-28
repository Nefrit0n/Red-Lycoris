package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"redlycoris/internal/domain"
)

type sarifReport struct {
	Schema  string     `json:"$schema"`
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

type sarifRun struct {
	Tool       sarifTool       `json:"tool"`
	Results    []sarifResult   `json:"results"`
	Taxonomies []sarifTaxonomy `json:"taxonomies"`
}

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name                string                  `json:"name"`
	Version             string                  `json:"version"`
	SemanticVersion     string                  `json:"semanticVersion"`
	InformationURI      string                  `json:"informationUri"`
	Rules               []sarifRule             `json:"rules"`
	SupportedTaxonomies []sarifToolComponentRef `json:"supportedTaxonomies"`
}

type sarifRule struct {
	ID               string              `json:"id"`
	Name             string              `json:"name"`
	ShortDescription sarifMessage        `json:"shortDescription"`
	FullDescription  sarifMessage        `json:"fullDescription"`
	Help             sarifMessage        `json:"help"`
	DefaultConfig    sarifRuleConfig     `json:"defaultConfiguration"`
	Properties       sarifProperties     `json:"properties"`
	Relationships    []sarifRelationship `json:"relationships"`
	HelpURI          string              `json:"helpUri"`
}

type sarifRuleConfig struct {
	Level string `json:"level"`
}

type sarifProperties struct {
	Tags             []string            `json:"tags"`
	SecuritySeverity any                 `json:"security-severity"`
	References       []string            `json:"references"`
	Solution         sarifMessage        `json:"solution"`
	Confidence       string              `json:"confidence"`
	Precision        string              `json:"precision"`
	Problem          sarifProblemDetails `json:"problem"`
}

type sarifProblemDetails struct {
	Severity string `json:"severity"`
}

type sarifMessage struct {
	Text     string `json:"text"`
	Markdown string `json:"markdown"`
}

type sarifResult struct {
	RuleID              string                       `json:"ruleId"`
	RuleIndex           int                          `json:"ruleIndex"`
	Rule                *sarifReportingDescriptorRef `json:"rule"`
	Level               string                       `json:"level"`
	Message             sarifMessage                 `json:"message"`
	Locations           []sarifLocation              `json:"locations"`
	PartialFingerprints map[string]string            `json:"partialFingerprints"`
	WebRequest          *sarifWebRequest             `json:"webRequest"`
	WebResponse         *sarifWebResponse            `json:"webResponse"`
}

type sarifReportingDescriptorRef struct {
	ID    string `json:"id"`
	Index int    `json:"index"`
}

type sarifLocation struct {
	PhysicalLocation sarifPhysicalLocation `json:"physicalLocation"`
	Message          sarifMessage          `json:"message"`
	Properties       sarifLocationProps    `json:"properties"`
}

type sarifLocationProps struct {
	Attack    string `json:"attack"`
	Evidence  string `json:"evidence"`
	Parameter string `json:"parameter"`
}

type sarifPhysicalLocation struct {
	ArtifactLocation sarifArtifactLocation `json:"artifactLocation"`
	Region           sarifRegion           `json:"region"`
	ContextRegion    sarifContextRegion    `json:"contextRegion"`
}

type sarifArtifactLocation struct {
	URI       string `json:"uri"`
	URIBaseID string `json:"uriBaseId"`
}

type sarifRegion struct {
	StartLine   int          `json:"startLine"`
	EndLine     int          `json:"endLine"`
	StartColumn int          `json:"startColumn"`
	EndColumn   int          `json:"endColumn"`
	Snippet     sarifSnippet `json:"snippet"`
}

type sarifContextRegion struct {
	Snippet sarifSnippet `json:"snippet"`
}

type sarifSnippet struct {
	Text string `json:"text"`
}

type sarifRelationship struct {
	Kinds  []string            `json:"kinds"`
	Target sarifRelationTarget `json:"target"`
}

type sarifRelationTarget struct {
	ID            string                `json:"id"`
	GUID          string                `json:"guid"`
	ToolComponent sarifToolComponentRef `json:"toolComponent"`
}

type sarifToolComponentRef struct {
	GUID string `json:"guid"`
	Name string `json:"name"`
}

type sarifTaxonomy struct {
	GUID string       `json:"guid"`
	Name string       `json:"name"`
	Taxa []sarifTaxon `json:"taxa"`
}

type sarifTaxon struct {
	GUID    string `json:"guid"`
	ID      string `json:"id"`
	HelpURI string `json:"helpUri"`
}

type sarifWebRequest struct {
	Method  string            `json:"method"`
	Target  string            `json:"target"`
	Headers map[string]string `json:"headers"`
}

type sarifWebResponse struct {
	StatusCode         int               `json:"statusCode"`
	Headers            map[string]string `json:"headers"`
	NoResponseReceived bool              `json:"noResponseReceived"`
}

type SARIFParser struct{}

// cveRegex матчит CVE-идентификаторы в любой части SARIF.
// Формат CVE: CVE-YYYY-NNNN+ (минимум 4 цифры, но может быть больше).
var cveRegex = regexp.MustCompile(`(?i)CVE-\d{4}-\d{4,}`)

func (p *SARIFParser) CanParse(data []byte) bool {
	var probe struct {
		Schema  string `json:"$schema"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}

	schema := strings.ToLower(strings.TrimSpace(probe.Schema))
	version := strings.TrimSpace(probe.Version)
	return strings.Contains(schema, "sarif") || version == "2.1.0"
}

func (p *SARIFParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	_ = ctx

	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.SARIFParser.Parse: unmarshal: %w", err)
	}

	findings := make([]domain.Finding, 0, 128)

	for _, run := range report.Runs {
		ruleByID := make(map[string]sarifRule, len(run.Tool.Driver.Rules))
		ruleByIndex := make(map[int]sarifRule, len(run.Tool.Driver.Rules))
		for i, rule := range run.Tool.Driver.Rules {
			ruleByID[rule.ID] = rule
			ruleByIndex[i] = rule
		}

		cweTaxonomyGUIDs := buildCWETaxonomyGUIDSet(run)
		sourceName := strings.TrimSpace(run.Tool.Driver.Name)
		kind := kindFromSARIFTool(sourceName)

		for _, result := range run.Results {
			rule := resolveSARIFRule(result, ruleByID, ruleByIndex)
			loc := firstSARIFLocation(result)

			title := firstNonEmpty(
				strings.TrimSpace(rule.Name),
				strings.TrimSpace(rule.ShortDescription.Text),
				strings.TrimSpace(result.Message.Text),
				strings.TrimSpace(result.RuleID),
			)

			level := firstNonEmpty(
				strings.TrimSpace(result.Level),
				strings.TrimSpace(rule.DefaultConfig.Level),
				strings.TrimSpace(rule.Properties.Problem.Severity),
			)

			securitySeverity := parseSARIFSecuritySeverity(rule.Properties.SecuritySeverity)
			severity := mapSARIFSeverity(level, securitySeverity)
			confidence := mapSARIFConfidence(
				firstNonEmpty(
					strings.TrimSpace(rule.Properties.Confidence),
					strings.TrimSpace(rule.Properties.Precision),
				),
				level,
			)

			filePath, lineStart, lineEnd := extractPrimaryLocation(loc, result)
			cweIDs := extractAllCWEIDs(rule, cweTaxonomyGUIDs)
			description := buildSARIFDescription(rule, result, loc, title)

			f := domain.Finding{
				Kind:        kind,
				Title:       title,
				Description: description,
				Severity:    severity,
				Confidence:  confidence,
				Status:      domain.StatusOpen,
				FilePath:    filePath,
				LineStart:   lineStart,
				LineEnd:     lineEnd,
				CVEIDs:      extractCVEs(result, rule),
				CWEIDs:      cweIDs,
				SourceType:  sourceName,
			}

			if ruleID := strings.TrimSpace(firstNonEmpty(result.RuleID, rule.ID)); ruleID != "" {
				f.RuleID = &ruleID
			}
			if ruleName := strings.TrimSpace(firstNonEmpty(rule.Name, rule.ShortDescription.Text)); ruleName != "" {
				f.RuleName = &ruleName
			}
			if snippet := extractBestSnippet(loc); snippet != "" {
				f.CodeSnippet = &snippet
			}

			// For secrets-kind findings: derive a stable fingerprint from the
			// partialFingerprints map if available, otherwise fall back to
			// sha256(rule_id + commit_sha + file_path).
			if kind == domain.KindSecrets {
				ruleIDStr := ""
				if f.RuleID != nil {
					ruleIDStr = *f.RuleID
				}
				var fpVal string
				for k, v := range result.PartialFingerprints {
					if strings.Contains(strings.ToLower(k), "secret") || strings.Contains(strings.ToLower(k), "value") {
						fpVal = v
						break
					}
				}
				commitStr := ""
				if f.CommitSHA != nil {
					commitStr = *f.CommitSHA
				}
				if fpVal == "" {
					// Fallback: hash of rule_id + commit + file_path (deterministic)
					fpVal = ruleIDStr + ":" + commitStr + ":" + f.FilePath
				}
				fp := domain.ComputeSecretFingerprint(ruleIDStr, fpVal)
				f.SecretFingerprint = &fp
				f.SecretKind = f.RuleID
			}

			f.Fingerprint = domain.CalculateFingerprint(&f)
			findings = append(findings, f)
		}
	}

	return findings, nil
}

// extractCVEs собирает CVE-идентификаторы из всех вероятных мест
// SARIF-результата. Возвращает нормализованный (UPPER CASE)
// дедуплицированный список.
func extractCVEs(result sarifResult, rule sarifRule) []string {
	seen := make(map[string]struct{})

	add := func(s string) {
		for _, m := range cveRegex.FindAllString(s, -1) {
			seen[strings.ToUpper(m)] = struct{}{}
		}
	}

	add(result.RuleID)
	if result.Message.Text != "" {
		add(result.Message.Text)
	}
	add(rule.ID)
	add(rule.Name)
	add(rule.ShortDescription.Text)
	add(rule.FullDescription.Text)
	add(rule.Help.Text)
	for _, tag := range rule.Properties.Tags {
		add(tag)
	}
	for key, val := range result.PartialFingerprints {
		if strings.Contains(strings.ToLower(strings.TrimSpace(key)), "cve") {
			add(val)
		}
	}

	out := make([]string, 0, len(seen))
	for cve := range seen {
		out = append(out, cve)
	}
	sort.Strings(out)
	return out
}

func resolveSARIFRule(result sarifResult, byID map[string]sarifRule, byIndex map[int]sarifRule) sarifRule {
	if id := strings.TrimSpace(result.RuleID); id != "" {
		if rule, ok := byID[id]; ok {
			return rule
		}
	}
	if result.Rule != nil {
		if id := strings.TrimSpace(result.Rule.ID); id != "" {
			if rule, ok := byID[id]; ok {
				return rule
			}
		}
		if rule, ok := byIndex[result.Rule.Index]; ok {
			return rule
		}
	}
	if rule, ok := byIndex[result.RuleIndex]; ok {
		return rule
	}
	return sarifRule{}
}

func firstSARIFLocation(result sarifResult) *sarifLocation {
	if len(result.Locations) == 0 {
		return nil
	}
	return &result.Locations[0]
}

func extractPrimaryLocation(loc *sarifLocation, result sarifResult) (string, int, int) {
	if loc == nil {
		if result.WebRequest != nil {
			return strings.TrimSpace(result.WebRequest.Target), 0, 0
		}
		return "", 0, 0
	}

	filePath := strings.TrimSpace(loc.PhysicalLocation.ArtifactLocation.URI)
	if filePath == "" && result.WebRequest != nil {
		filePath = strings.TrimSpace(result.WebRequest.Target)
	}

	lineStart := loc.PhysicalLocation.Region.StartLine
	lineEnd := loc.PhysicalLocation.Region.EndLine
	if lineEnd == 0 {
		lineEnd = lineStart
	}

	return filePath, lineStart, lineEnd
}

func extractBestSnippet(loc *sarifLocation) string {
	if loc == nil {
		return ""
	}
	return strings.TrimSpace(firstNonEmpty(
		loc.PhysicalLocation.Region.Snippet.Text,
		loc.PhysicalLocation.ContextRegion.Snippet.Text,
		loc.Properties.Attack,
		loc.Message.Text,
	))
}

func buildSARIFDescription(rule sarifRule, result sarifResult, loc *sarifLocation, title string) string {
	parts := make([]string, 0, 8)

	appendUniqueText(&parts, strings.TrimSpace(rule.FullDescription.Text))
	appendUniqueText(&parts, strings.TrimSpace(rule.Help.Markdown))
	appendUniqueText(&parts, strings.TrimSpace(rule.Help.Text))

	if msg := strings.TrimSpace(result.Message.Text); msg != "" && !sameText(msg, title) {
		appendUniqueText(&parts, "Instance details: "+msg)
	}

	if loc != nil {
		if attack := strings.TrimSpace(loc.Properties.Attack); attack != "" {
			appendUniqueText(&parts, "Attack: "+attack)
		}
		if evidence := strings.TrimSpace(loc.Properties.Evidence); evidence != "" {
			appendUniqueText(&parts, "Evidence: "+evidence)
		}
		if param := strings.TrimSpace(loc.Properties.Parameter); param != "" {
			appendUniqueText(&parts, "Parameter: "+param)
		}
	}

	if result.WebRequest != nil {
		req := strings.TrimSpace(strings.Join([]string{result.WebRequest.Method, result.WebRequest.Target}, " "))
		if req != "" {
			appendUniqueText(&parts, "Request: "+req)
		}
	}

	if result.WebResponse != nil {
		if result.WebResponse.NoResponseReceived {
			appendUniqueText(&parts, "Response: no response received")
		} else if result.WebResponse.StatusCode > 0 {
			appendUniqueText(&parts, fmt.Sprintf("Response status: %d", result.WebResponse.StatusCode))
		}
	}

	if solution := strings.TrimSpace(firstNonEmpty(rule.Properties.Solution.Markdown, rule.Properties.Solution.Text)); solution != "" {
		appendUniqueText(&parts, "Remediation: "+solution)
	}

	if len(rule.Properties.References) > 0 {
		appendUniqueText(&parts, "References:\n- "+strings.Join(rule.Properties.References, "\n- "))
	}

	if helpURI := strings.TrimSpace(rule.HelpURI); helpURI != "" {
		appendUniqueText(&parts, "Help URI: "+helpURI)
	}

	return strings.Join(parts, "\n\n")
}

func appendUniqueText(dst *[]string, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	for _, existing := range *dst {
		if sameText(existing, value) {
			return
		}
	}
	*dst = append(*dst, value)
}

func sameText(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

func kindFromSARIFTool(toolName string) domain.FindingKind {
	name := strings.ToLower(strings.TrimSpace(toolName))
	switch {
	case strings.Contains(name, "semgrep"):
		return domain.KindSAST
	case strings.Contains(name, "zap"), strings.Contains(name, "burp"):
		return domain.KindDAST
	case strings.Contains(name, "tfsec"), strings.Contains(name, "checkov"), strings.Contains(name, "trivy-config"), strings.Contains(name, "kics"):
		return domain.KindIaC
	case strings.Contains(name, "gitleaks"), strings.Contains(name, "trufflehog"):
		return domain.KindSecrets
	default:
		return domain.KindOther
	}
}

func mapSARIFSeverity(level string, securitySeverity *float64) int {
	if securitySeverity != nil {
		score := *securitySeverity
		switch {
		case score >= 7.0:
			return domain.SeverityHigh
		case score >= 4.0:
			return domain.SeverityMedium
		case score > 0:
			return domain.SeverityLow
		}
	}

	switch strings.ToLower(strings.TrimSpace(level)) {
	case "error":
		return domain.SeverityHigh
	case "warning":
		return domain.SeverityMedium
	case "note":
		return domain.SeverityLow
	case "recommendation", "none", "":
		return domain.SeverityInfo
	default:
		return domain.SeverityInfo
	}
}

func mapSARIFConfidence(explicit, level string) int {
	switch strings.ToLower(strings.TrimSpace(explicit)) {
	case "very-high", "high", "confirmed":
		return 2
	case "medium":
		return 1
	case "low", "false positive":
		return 0
	}

	switch strings.ToLower(strings.TrimSpace(level)) {
	case "error":
		return 2
	case "warning":
		return 1
	default:
		return 0
	}
}

func parseSARIFSecuritySeverity(v any) *float64 {
	switch x := v.(type) {
	case float64:
		return &x
	case string:
		x = strings.TrimSpace(x)
		if x == "" {
			return nil
		}
		n, err := strconv.ParseFloat(x, 64)
		if err != nil {
			return nil
		}
		return &n
	case json.Number:
		n, err := x.Float64()
		if err != nil {
			return nil
		}
		return &n
	default:
		return nil
	}
}

func buildCWETaxonomyGUIDSet(run sarifRun) map[string]struct{} {
	out := make(map[string]struct{})
	for _, tax := range run.Taxonomies {
		if strings.EqualFold(strings.TrimSpace(tax.Name), "CWE") && strings.TrimSpace(tax.GUID) != "" {
			out[strings.TrimSpace(tax.GUID)] = struct{}{}
		}
	}
	for _, ref := range run.Tool.Driver.SupportedTaxonomies {
		if strings.EqualFold(strings.TrimSpace(ref.Name), "CWE") && strings.TrimSpace(ref.GUID) != "" {
			out[strings.TrimSpace(ref.GUID)] = struct{}{}
		}
	}
	return out
}

func extractAllCWEIDs(rule sarifRule, cweTaxonomyGUIDs map[string]struct{}) []int {
	set := make(map[int]struct{})

	for _, id := range extractCWEIDs(rule.Properties.Tags) {
		set[id] = struct{}{}
	}
	for _, id := range extractCWEIDsFromReferences(rule.Properties.References) {
		set[id] = struct{}{}
	}
	for _, rel := range rule.Relationships {
		targetID := strings.TrimSpace(rel.Target.ID)
		if targetID == "" {
			continue
		}
		_, guidMatch := cweTaxonomyGUIDs[strings.TrimSpace(rel.Target.ToolComponent.GUID)]
		nameMatch := strings.EqualFold(strings.TrimSpace(rel.Target.ToolComponent.Name), "CWE")
		if !guidMatch && !nameMatch {
			continue
		}
		if n, err := strconv.Atoi(targetID); err == nil {
			set[n] = struct{}{}
		}
	}

	if len(set) == 0 {
		return []int{}
	}

	ids := make([]int, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids
}

func extractCWEIDs(tags []string) []int {
	ids := make([]int, 0, len(tags))
	for _, tag := range tags {
		lower := strings.ToLower(strings.TrimSpace(tag))
		if strings.HasPrefix(lower, "cwe-") {
			if n, err := strconv.Atoi(strings.TrimSpace(tag[4:])); err == nil {
				ids = append(ids, n)
			}
		}
	}
	return ids
}

var cweRefRegexp = regexp.MustCompile(`(?i)(?:cwe[-_/ ]?|/definitions/)(\d+)`)

func extractCWEIDsFromReferences(refs []string) []int {
	ids := make([]int, 0, len(refs))
	for _, ref := range refs {
		match := cweRefRegexp.FindStringSubmatch(ref)
		if len(match) != 2 {
			continue
		}
		if n, err := strconv.Atoi(match[1]); err == nil {
			ids = append(ids, n)
		}
	}
	return ids
}
