package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

type SemgrepParser struct{}

func (p *SemgrepParser) ScannerType() string { return "semgrep" }

func (p *SemgrepParser) CanParse(data []byte) bool {
	if canParseSarif(data) {
		return true
	}
	if !json.Valid(data) {
		return false
	}

	var payload map[string]json.RawMessage
	if err := json.Unmarshal(data, &payload); err != nil {
		return false
	}

	// semgrep json report has results + paths
	if _, ok := payload["results"]; !ok {
		return false
	}
	if _, ok := payload["paths"]; !ok {
		return false
	}
	return true
}

func (p *SemgrepParser) Parse(data []byte) ([]Finding, error) {
	if canParseSarif(data) {
		return parseSarif(data, "semgrep")
	}

	var report semgrepReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := make([]Finding, 0, len(report.Results))
	for _, r := range report.Results {
		findings = append(findings, p.buildFinding(r))
	}
	return findings, nil
}

func (p *SemgrepParser) buildFinding(r semgrepResult) Finding {
	// Title как "Trivy-эталон": читаемое короткое имя правила (а не path)
	title := buildSemgrepTitle(r.CheckID)

	// Location = path:line[:col]
	location := buildSemgrepLocation(r.Path, r.Start.Line, r.Start.Col)
	if strings.TrimSpace(location) == "" {
		location = title
	}

	desc := strings.TrimSpace(r.Extra.Message)
	var descPtr *string
	if desc != "" {
		descPtr = &desc
	}

	rawData := buildSemgrepRawData(r)
	evidence := buildSemgrepEvidence(r)

	return Finding{
		Category:    models.CategorySAST,
		Title:       title,
		Description: descPtr,
		Severity:    mapSemgrepSeverity(r.Extra.Severity),
		Location:    location,
		RuleID:      strings.TrimSpace(r.CheckID),
		RawData:     rawData,
		Evidence:    evidence,
	}
}

// buildSemgrepTitle makes a short readable rule title from check_id.
// Example:
//   yaml.github-actions.security.run-shell-injection.run-shell-injection
// -> security: run-shell-injection
func buildSemgrepTitle(checkID string) string {
	checkID = strings.TrimSpace(checkID)
	if checkID == "" {
		return "semgrep"
	}

	parts := strings.Split(checkID, ".")
	uniq := make([]string, 0, 2)
	seen := make(map[string]bool, 4)

	// take last 2 unique segments from the end
	for i := len(parts) - 1; i >= 0; i-- {
		p := strings.TrimSpace(parts[i])
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		uniq = append(uniq, p)
		if len(uniq) >= 2 {
			break
		}
	}

	// reverse
	for i, j := 0, len(uniq)-1; i < j; i, j = i+1, j-1 {
		uniq[i], uniq[j] = uniq[j], uniq[i]
	}

	if len(uniq) == 1 {
		return uniq[0]
	}
	return fmt.Sprintf("%s: %s", uniq[0], uniq[1])
}

func buildSemgrepLocation(path string, line int, col int) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if line <= 0 {
		return path
	}
	if col > 0 {
		return fmt.Sprintf("%s:%d:%d", path, line, col)
	}
	return fmt.Sprintf("%s:%d", path, line)
}

func buildSemgrepRawData(r semgrepResult) map[string]any {
	rawData := map[string]any{
		"type":              "sast",
		"path":              strings.TrimSpace(r.Path),
		"original_severity": strings.TrimSpace(r.Extra.Severity),
		"check_id":          strings.TrimSpace(r.CheckID),
	}

	// Location/range hints for debugging/analytics
	if r.Start.Line > 0 {
		rawData["start_line"] = r.Start.Line
	}
	if r.Start.Col > 0 {
		rawData["start_col"] = r.Start.Col
	}
	if r.End.Line > 0 {
		rawData["end_line"] = r.End.Line
	}
	if r.End.Col > 0 {
		rawData["end_col"] = r.End.Col
	}

	if r.Extra.Fingerprint != "" {
		rawData["fingerprint"] = r.Extra.Fingerprint
	}
	if r.Extra.EngineKind != "" {
		rawData["engine_kind"] = r.Extra.EngineKind
	}
	if r.Extra.ValidationState != "" {
		rawData["validation_state"] = r.Extra.ValidationState
	}
	if r.Extra.IsIgnored {
		rawData["is_ignored"] = true
	}
	if r.Extra.Fix != "" {
		rawData["fix"] = r.Extra.Fix
	}
	if r.Extra.FixRegex != nil {
		rawData["fix_regex"] = map[string]any{
			"regex":       r.Extra.FixRegex.Regex,
			"replacement": r.Extra.FixRegex.Replacement,
			"count":       r.Extra.FixRegex.Count,
		}
	}
	if len(r.Extra.Metavars) > 0 && string(r.Extra.Metavars) != "null" {
		rawData["metavars"] = r.Extra.Metavars
	}

	// Metadata (rich)
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata

		if len(meta.Raw) > 0 && string(meta.Raw) != "null" {
			rawData["metadata_raw"] = meta.Raw
		}
		if meta.Category != "" {
			rawData["category"] = meta.Category
		}
		if len(meta.Subcategory) > 0 {
			rawData["subcategory"] = meta.Subcategory
		}
		if len(meta.Technology) > 0 {
			rawData["technology"] = meta.Technology
		}
		if len(meta.Cwe) > 0 {
			rawData["cwe"] = meta.Cwe
		}
		if len(meta.Owasp) > 0 {
			rawData["owasp"] = meta.Owasp
		}
		if len(meta.References) > 0 {
			rawData["references"] = meta.References
		}
		if meta.Confidence != "" {
			rawData["confidence"] = meta.Confidence
		}
		if meta.Likelihood != "" {
			rawData["likelihood"] = meta.Likelihood
		}
		if meta.Impact != "" {
			rawData["impact"] = meta.Impact
		}
		if len(meta.VulnerabilityClass) > 0 {
			rawData["vulnerability_class"] = meta.VulnerabilityClass
		}
		if meta.License != "" {
			rawData["license"] = meta.License
		}
		if meta.Source != "" {
			rawData["source"] = meta.Source
		}
		if meta.Shortlink != "" {
			rawData["url"] = meta.Shortlink
		} else if meta.SemgrepURL != "" {
			rawData["url"] = meta.SemgrepURL
		}
		if meta.CweTop25 {
			rawData["cwe_top25_2022"] = true
		}
		if meta.CweTop25_2021 {
			rawData["cwe_top25_2021"] = true
		}
		// "asvs" может быть bool/object/array → не типизируем, чтобы не падать
		if len(meta.ASVS) > 0 && string(meta.ASVS) != "null" {
			rawData["asvs"] = meta.ASVS
		}
	}

	return rawData
}

type semgrepReport struct {
	Results []semgrepResult `json:"results"`
	Paths   json.RawMessage `json:"paths"`
	Errors  json.RawMessage `json:"errors"`
	Version string          `json:"version"`
}

type semgrepResult struct {
	CheckID string `json:"check_id"`
	Path    string `json:"path"`
	Start   struct {
		Line   int `json:"line"`
		Col    int `json:"col"`
		Offset int `json:"offset"`
	} `json:"start"`
	End struct {
		Line   int `json:"line"`
		Col    int `json:"col"`
		Offset int `json:"offset"`
	} `json:"end"`
	Extra semgrepExtra `json:"extra"`
}

type semgrepExtra struct {
	Message         string           `json:"message"`
	Severity        string           `json:"severity"`
	Lines           json.RawMessage  `json:"lines"`
	Metadata        *semgrepMetadata `json:"metadata"`
	Fingerprint     string           `json:"fingerprint"`
	IsIgnored       bool             `json:"is_ignored"`
	EngineKind      string           `json:"engine_kind"`
	ValidationState string           `json:"validation_state"`
	Metavars        json.RawMessage  `json:"metavars"`
	Fix             string           `json:"fix"`
	FixRegex        *semgrepFixRegex `json:"fix_regex"`
}

// stringList accepts both "x" and ["x","y"]
type stringList []string

func (s *stringList) UnmarshalJSON(data []byte) error {
	data = []byte(strings.TrimSpace(string(data)))
	if len(data) == 0 || string(data) == "null" {
		*s = nil
		return nil
	}
	var arr []string
	if err := json.Unmarshal(data, &arr); err == nil {
		*s = arr
		return nil
	}
	var one string
	if err := json.Unmarshal(data, &one); err == nil {
		one = strings.TrimSpace(one)
		if one == "" {
			*s = nil
			return nil
		}
		*s = []string{one}
		return nil
	}
	*s = nil
	return nil
}

type semgrepMetadata struct {
	Category           string          `json:"category"`
	Subcategory        stringList      `json:"subcategory"`
	Technology         stringList      `json:"technology"`
	Cwe                stringList      `json:"cwe"`
	Owasp              stringList      `json:"owasp"`
	References         stringList      `json:"references"`
	Confidence         string          `json:"confidence"`
	Likelihood         string          `json:"likelihood"`
	Impact             string          `json:"impact"`
	VulnerabilityClass stringList      `json:"vulnerability_class"`
	License            string          `json:"license"`
	Source             string          `json:"source"`
	Shortlink          string          `json:"shortlink"`
	SemgrepURL         string          `json:"semgrep.url"` // есть в примере JSON
	CweTop25           bool            `json:"cwe2022-top25"`
	CweTop25_2021      bool            `json:"cwe2021-top25"`
	ASVS               json.RawMessage `json:"asvs"` // bool/object/array
	Raw                json.RawMessage `json:"-"`    // full metadata
}

func (m *semgrepMetadata) UnmarshalJSON(data []byte) error {
	type alias semgrepMetadata
	var decoded alias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*m = semgrepMetadata(decoded)
	m.Raw = append(m.Raw[:0], data...)
	return nil
}

type semgrepFixRegex struct {
	Regex       string `json:"regex"`
	Replacement string `json:"replacement"`
	Count       int    `json:"count"`
}

var semgrepSeverityMap = map[string]string{
	"ERROR":    models.SeverityHigh,
	"WARNING":  models.SeverityMedium,
	"INFO":     models.SeverityLow,
	"LOW":      models.SeverityLow,
	"MEDIUM":   models.SeverityMedium,
	"HIGH":     models.SeverityHigh,
	"CRITICAL": models.SeverityCritical,
}

func mapSemgrepSeverity(raw string) string {
	if v, ok := semgrepSeverityMap[strings.ToUpper(strings.TrimSpace(raw))]; ok {
		return v
	}
	return models.SeverityLow
}

func buildSemgrepEvidence(r semgrepResult) map[string]any {
	evidence := map[string]any{
		"scannerType": "semgrep",
		"findingType": "sast",
		"category":    models.CategorySAST,

		"ruleId":      strings.TrimSpace(r.CheckID),
		"path":        strings.TrimSpace(r.Path),
		"severityRaw": strings.TrimSpace(r.Extra.Severity),
	}

	if message := strings.TrimSpace(r.Extra.Message); message != "" {
		evidence["message"] = message
	}

	// Range
	if r.Start.Line > 0 || r.Start.Col > 0 {
		start := map[string]any{}
		if r.Start.Line > 0 {
			start["line"] = r.Start.Line
		}
		if r.Start.Col > 0 {
			start["col"] = r.Start.Col
		}
		evidence["start"] = start
	}
	if r.End.Line > 0 || r.End.Col > 0 {
		end := map[string]any{}
		if r.End.Line > 0 {
			end["line"] = r.End.Line
		}
		if r.End.Col > 0 {
			end["col"] = r.End.Col
		}
		evidence["end"] = end
	}

	// Code snippet
	if snippet := semgrepLinesToSnippet(r.Extra.Lines); snippet != "" {
		evidence["code"] = snippet
	}

	// Fix suggestions
	if r.Extra.Fix != "" {
		evidence["fix"] = r.Extra.Fix
	}
	if r.Extra.FixRegex != nil {
		evidence["fix_regex"] = map[string]any{
			"regex":       r.Extra.FixRegex.Regex,
			"replacement": r.Extra.FixRegex.Replacement,
			"count":       r.Extra.FixRegex.Count,
		}
	}

	// Additional context
	if r.Extra.ValidationState != "" {
		evidence["validationState"] = r.Extra.ValidationState
	}
	if len(r.Extra.Metavars) > 0 && string(r.Extra.Metavars) != "null" {
		evidence["metavars"] = r.Extra.Metavars
	}

	// METADATA — ключевое для твоего UI + RemediationGuidance
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata

		// full object for UI (FindingDetail.tsx ожидает evidence.metadata как объект)
		if len(meta.Raw) > 0 && string(meta.Raw) != "null" {
			evidence["metadata"] = json.RawMessage(meta.Raw)
		}

		// useful top-level fields (как в Trivy)
		if meta.Shortlink != "" {
			evidence["primaryUrl"] = meta.Shortlink
		} else if meta.SemgrepURL != "" {
			evidence["primaryUrl"] = meta.SemgrepURL
		} else if meta.Source != "" {
			evidence["primaryUrl"] = meta.Source
		}

		if len(meta.References) > 0 {
			evidence["references"] = meta.References
		}
	}

	// cleanup empty strings
	for key, value := range evidence {
		if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
			delete(evidence, key)
		}
	}

	return evidence
}

func semgrepLinesToSnippet(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	// Most common Semgrep format: string
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return normalizeSemgrepSnippet(s)
	}

	// Sometimes it's []string
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return normalizeSemgrepSnippet(strings.Join(arr, "\n"))
	}

	// Or an object with "lines"/"content"
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err == nil {
		if v, ok := obj["lines"].(string); ok {
			return normalizeSemgrepSnippet(v)
		}
		if v, ok := obj["content"].(string); ok {
			return normalizeSemgrepSnippet(v)
		}
	}

	return ""
}

func normalizeSemgrepSnippet(v string) string {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(strings.ToLower(trimmed), "requires login") {
		return ""
	}
	return trimmed
}
