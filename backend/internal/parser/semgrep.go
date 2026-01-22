package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

type SemgrepParser struct{}

func (p *SemgrepParser) ScannerType() string {
	return "semgrep"
}

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
	// Title = path (для UI)
	title := strings.TrimSpace(r.Path)
	if title == "" {
		title = r.CheckID // fallback на ruleId если path почему-то пустой
	}

	// Location = path:line (для фильтров/контекста)
	location := title
	if r.Start.Line > 0 {
		location = fmt.Sprintf("%s:%d", title, r.Start.Line)
	}

	// Description = message (полный текст)
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
		RuleID:      r.CheckID,
		RawData:     rawData,
		Evidence:    evidence,
	}
}

func buildSemgrepRawData(r semgrepResult) map[string]any {
	rawData := map[string]any{
		"type":              "sast",
		"path":              r.Path,
		"original_severity": r.Extra.Severity,
		"check_id":          r.CheckID,
	}

	if r.Extra.Fingerprint != "" {
		rawData["fingerprint"] = r.Extra.Fingerprint
	}
	if r.Extra.EngineKind != "" {
		rawData["engine_kind"] = r.Extra.EngineKind
	}
	if r.Extra.IsIgnored {
		rawData["is_ignored"] = true
	}

	// Extract metadata fields
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata
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
		}
		if meta.CweTop25 {
			rawData["cwe_top25_2022"] = true
		}
		if meta.CweTop25_2021 {
			rawData["cwe_top25_2021"] = true
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
	Message     string           `json:"message"`
	Severity    string           `json:"severity"`
	Lines       json.RawMessage  `json:"lines"`
	Metadata    *semgrepMetadata `json:"metadata"`
	Fingerprint string           `json:"fingerprint"`
	IsIgnored   bool             `json:"is_ignored"`
	EngineKind  string           `json:"engine_kind"`
	Metavars    json.RawMessage  `json:"metavars"`
	Fix         string           `json:"fix"`
	FixRegex    *semgrepFixRegex `json:"fix_regex"`
}

type semgrepMetadata struct {
	Category           string          `json:"category"`
	Subcategory        []string        `json:"subcategory"`
	Technology         []string        `json:"technology"`
	Cwe                []string        `json:"cwe"`
	Owasp              []string        `json:"owasp"`
	References         []string        `json:"references"`
	Confidence         string          `json:"confidence"`
	Likelihood         string          `json:"likelihood"`
	Impact             string          `json:"impact"`
	VulnerabilityClass []string        `json:"vulnerability_class"`
	License            string          `json:"license"`
	Source             string          `json:"source"`
	Shortlink          string          `json:"shortlink"`
	CweTop25           bool            `json:"cwe2022-top25"`
	CweTop25_2021      bool            `json:"cwe2021-top25"`
	OwaspTop10         bool            `json:"asvs"`
	Raw                json.RawMessage `json:"-"` // Store full metadata for extensibility
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
		"ruleId":      strings.TrimSpace(r.CheckID),
		"path":        strings.TrimSpace(r.Path),
		"severityRaw": strings.TrimSpace(r.Extra.Severity),
	}

	if message := strings.TrimSpace(r.Extra.Message); message != "" {
		evidence["message"] = message
	}

	if r.Start.Line > 0 || r.Start.Col > 0 {
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
	if r.End.Line > 0 || r.End.Col > 0 {
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

	if snippet := semgrepLinesToSnippet(r.Extra.Lines); snippet != "" {
		evidence["code"] = snippet
	}

	// Add fix suggestion if available
	if r.Extra.Fix != "" {
		evidence["fix"] = r.Extra.Fix
	}
	if r.Extra.FixRegex != nil {
		evidence["fix_regex"] = map[string]any{
			"regex":       r.Extra.FixRegex.Regex,
			"replacement": r.Extra.FixRegex.Replacement,
		}
		if r.Extra.FixRegex.Count > 0 {
			evidence["fix_regex"].(map[string]any)["count"] = r.Extra.FixRegex.Count
		}
	}

	// Add security classification from metadata
	if r.Extra.Metadata != nil {
		meta := r.Extra.Metadata
		if len(meta.Cwe) > 0 {
			evidence["cwe"] = meta.Cwe
		}
		if len(meta.Owasp) > 0 {
			evidence["owasp"] = meta.Owasp
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
			evidence["vulnerability_class"] = meta.VulnerabilityClass
		}
		if len(meta.References) > 0 {
			evidence["references"] = meta.References
		}
	}

	// Clean up empty strings
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
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if strings.Contains(strings.ToLower(trimmed), "requires login") {
		return ""
	}
	return trimmed
}
