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
	// Title как у Trivy-эталона: стабильный идентификатор (не path)
	// Пример: yaml.github-actions.security.run-shell-injection.run-shell-injection
	//      -> security: run-shell-injection
	title := buildSemgrepTitle(r.CheckID)
	if title == "" {
		title = "semgrep"
	}

	// Location = path:line:col
	location := buildSemgrepLocation(r.Path, r.Start.Line)
	if location == "" {
		// fallback, чтобы не было пусто
		location = strings.TrimSpace(r.Path)
	}

	// Description = message
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

// buildSemgrepTitle extracts a readable short title from check_id.
// Takes last 2 unique segments (from right), keeps order:
//
//	a.b.security.run-shell-injection.run-shell-injection -> security: run-shell-injection
func buildSemgrepTitle(checkID string) string {
	checkID = strings.TrimSpace(checkID)
	if checkID == "" {
		return ""
	}
	parts := strings.Split(checkID, ".")

	seen := map[string]bool{}
	uniq := make([]string, 0, 2)

	for i := len(parts) - 1; i >= 0; i-- {
		p := strings.TrimSpace(parts[i])
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		uniq = append(uniq, p)
		if len(uniq) == 2 {
			break
		}
	}

	// reverse uniq
	for i, j := 0, len(uniq)-1; i < j; i, j = i+1, j-1 {
		uniq[i], uniq[j] = uniq[j], uniq[i]
	}

	if len(uniq) == 0 {
		return ""
	}
	if len(uniq) == 1 {
		return uniq[0]
	}
	return fmt.Sprintf("%s: %s", uniq[0], uniq[1])
}

func buildSemgrepLocation(path string, line int) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if line <= 0 {
		return path
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
	if len(r.Extra.Metavars) > 0 && string(r.Extra.Metavars) != "null" {
		rawData["metavars"] = r.Extra.Metavars
	}

	// Extract metadata fields
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata
		if len(meta.Raw) > 0 && string(meta.Raw) != "null" {
			rawData["metadata_raw"] = meta.Raw
		}
		if meta.Category != "" {
			rawData["category"] = meta.Category
		}
		if len(meta.Subcategory) > 0 {
			rawData["subcategory"] = []string(meta.Subcategory)
		}
		if len(meta.Technology) > 0 {
			rawData["technology"] = []string(meta.Technology)
		}
		if len(meta.Cwe) > 0 {
			rawData["cwe"] = []string(meta.Cwe)
			if ids := extractCweIDs(meta.Cwe); len(ids) > 0 {
				rawData["cwe_ids"] = ids
			}
		}
		if len(meta.Owasp) > 0 {
			rawData["owasp"] = []string(meta.Owasp)
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
			rawData["vulnerability_class"] = []string(meta.VulnerabilityClass)
		}
		if meta.License != "" {
			rawData["license"] = meta.License
		}
		if meta.Source != "" {
			rawData["source"] = meta.Source
		}

		// url priority: shortlink -> semgrep.url -> source
		if meta.Shortlink != "" {
			rawData["url"] = meta.Shortlink
		} else if meta.SemgrepURL != "" {
			rawData["url"] = meta.SemgrepURL
		} else if meta.Source != "" {
			rawData["url"] = meta.Source
		}

		if meta.CweTop25 {
			rawData["cwe_top25_2022"] = true
		}
		if meta.CweTop25_2021 {
			rawData["cwe_top25_2021"] = true
		}

		// asvs can be bool/object/array
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

// stringList accepts ["a","b"] or "a"
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
	SemgrepURL         string          `json:"semgrep.url"`
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

		// каноничные ключи (как Trivy-стиль / как DTO)
		"ruleId":   strings.TrimSpace(r.CheckID),
		"filePath": strings.TrimSpace(r.Path),
	}

	// message
	if msg := strings.TrimSpace(r.Extra.Message); msg != "" {
		evidence["message"] = msg
	}

	// start/end (канонично)
	if r.Start.Line > 0 {
		evidence["startLine"] = r.Start.Line
	}
	if r.End.Line > 0 {
		evidence["endLine"] = r.End.Line
	}
	if r.Start.Col > 0 {
		evidence["startCol"] = r.Start.Col
	}
	if r.End.Col > 0 {
		evidence["endCol"] = r.End.Col
	}

	// snippet (канонично)
	if snippet := semgrepLinesToSnippet(r.Extra.Lines); snippet != "" {
		evidence["snippet"] = snippet
	}

	// severity raw
	if sev := strings.TrimSpace(r.Extra.Severity); sev != "" {
		evidence["severityRaw"] = sev
	}

	// fix
	if r.Extra.Fix != "" {
		evidence["fix"] = r.Extra.Fix
	}
	if r.Extra.FixRegex != nil {
		fixRegex := map[string]any{
			"regex":       r.Extra.FixRegex.Regex,
			"replacement": r.Extra.FixRegex.Replacement,
			"count":       r.Extra.FixRegex.Count,
		}
		evidence["fix_regex"] = fixRegex
		evidence["fixRegex"] = fixRegex
	}

	// meta derived fields + primaryUrl
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata

		// primaryUrl приоритет: shortlink -> semgrep.url -> source
		if meta.Shortlink != "" {
			evidence["primaryUrl"] = meta.Shortlink
		} else if meta.SemgrepURL != "" {
			evidence["primaryUrl"] = meta.SemgrepURL
		} else if meta.Source != "" {
			evidence["primaryUrl"] = meta.Source
		}

		if len(meta.References) > 0 {
			evidence["references"] = []string(meta.References)
		}
		if len(meta.Cwe) > 0 {
			evidence["cwe"] = []string(meta.Cwe)
		}
		if len(meta.Owasp) > 0 {
			evidence["owasp"] = []string(meta.Owasp)
		}
		if meta.Confidence != "" {
			evidence["confidence"] = meta.Confidence
		}
		if meta.Likelihood != "" {
			evidence["likelihood"] = meta.Likelihood
		}
		if meta.Impact != "" {
			evidence["impact"] = meta.Impact
		}
		if len(meta.VulnerabilityClass) > 0 {
			evidence["vulnerabilityClass"] = []string(meta.VulnerabilityClass)
		}

		// asvs — как raw json, чтобы не падать
		if len(meta.ASVS) > 0 && string(meta.ASVS) != "null" {
			evidence["asvs"] = meta.ASVS
		}

		// если хочешь “богато” для UI — сохраним metadata целиком
		if len(meta.Raw) > 0 && string(meta.Raw) != "null" {
			evidence["metadata"] = json.RawMessage(meta.Raw)
		}
	}

	// -------------- Backward compatibility --------------
	// Старые ключи оставляем, чтобы ничего не сломать:
	evidence["path"] = strings.TrimSpace(r.Path)

	// start/end object
	if r.Start.Line > 0 || r.Start.Col > 0 || r.Start.Offset > 0 {
		start := map[string]any{}
		if r.Start.Line > 0 {
			start["line"] = r.Start.Line
		}
		if r.Start.Col > 0 {
			start["col"] = r.Start.Col
		}
		if r.Start.Offset > 0 {
			start["offset"] = r.Start.Offset
		}
		evidence["start"] = start
	}
	if r.End.Line > 0 || r.End.Col > 0 || r.End.Offset > 0 {
		end := map[string]any{}
		if r.End.Line > 0 {
			end["line"] = r.End.Line
		}
		if r.End.Col > 0 {
			end["col"] = r.End.Col
		}
		if r.End.Offset > 0 {
			end["offset"] = r.End.Offset
		}
		evidence["end"] = end
	}

	// code (старый ключ)
	if snippet := semgrepLinesToSnippet(r.Extra.Lines); snippet != "" {
		evidence["code"] = snippet
	}

	// cleanup empty strings
	for k, v := range evidence {
		if s, ok := v.(string); ok && strings.TrimSpace(s) == "" {
			delete(evidence, k)
		}
	}

	return evidence
}

func semgrepLinesToSnippet(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	// string
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return normalizeSnippet(s)
	}

	// []string
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return normalizeSnippet(strings.Join(arr, "\n"))
	}

	// object with "lines"/"content"
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err == nil {
		if v, ok := obj["lines"].(string); ok {
			return normalizeSnippet(v)
		}
		if v, ok := obj["content"].(string); ok {
			return normalizeSnippet(v)
		}
	}

	return ""
}

func normalizeSnippet(s string) string {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(strings.ToLower(trimmed), "requires login") {
		return ""
	}
	return trimmed
}

// Extract "CWE-78" from strings like:
// "CWE-78: Improper Neutralization ..."
// returns unique IDs.
func extractCweIDs(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))

	for _, v := range values {
		u := strings.ToUpper(v)
		idx := strings.Index(u, "CWE-")
		if idx < 0 {
			continue
		}
		rest := u[idx+4:]
		n := 0
		for n < len(rest) && rest[n] >= '0' && rest[n] <= '9' {
			n++
		}
		if n == 0 {
			continue
		}
		id := "CWE-" + rest[:n]
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}
