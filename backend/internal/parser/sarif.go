package parser

import (
	"encoding/json"
	"strconv"
	"strings"

	"lotus-warden/backend/internal/models"
)

type sarifReport struct {
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

type sarifRun struct {
	Tool    sarifTool     `json:"tool"`
	Results []sarifResult `json:"results"`
}

type sarifRule struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	ShortDescription sarifMessage      `json:"shortDescription"`
	FullDescription  sarifMessage      `json:"fullDescription"`
	Help             sarifMessage      `json:"help"`
	HelpURI          string            `json:"helpUri"`
	Properties       sarifRuleProps    `json:"properties"`
	DefaultConfig    sarifDefaultConfig `json:"defaultConfiguration"`
}

type sarifRuleProps struct {
	Tags     []string `json:"tags"`
	CWE      []string `json:"cwe"`
	Category string   `json:"category"`
	Security string   `json:"security-severity"`
}

type sarifDefaultConfig struct {
	Level string `json:"level"`
}

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name    string      `json:"name"`
	Version string      `json:"version"`
	Rules   []sarifRule `json:"rules"`
}

type sarifResult struct {
	RuleID    string          `json:"ruleId"`
	Message   sarifMessage    `json:"message"`
	Level     string          `json:"level"`
	Locations []sarifLocation `json:"locations"`
}

type sarifMessage struct {
	Text string `json:"text"`
}

type sarifLocation struct {
	PhysicalLocation sarifPhysicalLocation `json:"physicalLocation"`
}

type sarifPhysicalLocation struct {
	ArtifactLocation sarifArtifactLocation `json:"artifactLocation"`
	Region           sarifRegion           `json:"region"`
}

type sarifArtifactLocation struct {
	URI string `json:"uri"`
}

type sarifRegion struct {
	StartLine   int          `json:"startLine"`
	EndLine     int          `json:"endLine"`
	StartColumn int          `json:"startColumn"`
	EndColumn   int          `json:"endColumn"`
	Snippet     sarifSnippet `json:"snippet"`
}

type sarifSnippet struct {
	Text string `json:"text"`
}

func canParseSarif(data []byte) bool {
	if !json.Valid(data) {
		return false
	}
	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return false
	}
	return report.Version != "" && len(report.Runs) > 0
}

func parseSarif(data []byte, toolName string) ([]Finding, error) {
	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, err
	}

	findings := []Finding{}
	for _, run := range report.Runs {
		if toolName != "" && !strings.Contains(strings.ToLower(run.Tool.Driver.Name), strings.ToLower(toolName)) {
			continue
		}

		// Build rule lookup for descriptions and help text
		ruleMap := make(map[string]sarifRule)
		for _, rule := range run.Tool.Driver.Rules {
			ruleMap[rule.ID] = rule
		}

		for _, result := range run.Results {
			location := ""
			var filePath string
			var region sarifRegion

			if len(result.Locations) > 0 {
				physLoc := result.Locations[0].PhysicalLocation
				filePath = strings.TrimSpace(physLoc.ArtifactLocation.URI)
				region = physLoc.Region

				if region.StartLine > 0 {
					location = filePath + ":" + strconv.Itoa(region.StartLine)
				} else {
					location = filePath
				}
			}

			// Build evidence with all available information
			evidence := buildSarifEvidence(result, region, filePath, toolName)

			// Build rawData
			rawData := map[string]any{
				"rule_id": result.RuleID,
				"level":   result.Level,
			}

			// Add rule description if available
			if rule, ok := ruleMap[result.RuleID]; ok {
				if rule.ShortDescription.Text != "" {
					rawData["short_description"] = rule.ShortDescription.Text
				}
				if rule.FullDescription.Text != "" {
					rawData["full_description"] = rule.FullDescription.Text
				}
				if rule.Help.Text != "" {
					rawData["help"] = rule.Help.Text
				}
				if rule.HelpURI != "" {
					rawData["help_uri"] = rule.HelpURI
					evidence["primaryUrl"] = rule.HelpURI
				}
				if len(rule.Properties.Tags) > 0 {
					rawData["tags"] = rule.Properties.Tags
				}
				if len(rule.Properties.CWE) > 0 {
					rawData["cwe"] = rule.Properties.CWE
					evidence["cwe"] = rule.Properties.CWE
				}
			}

			// Determine title - prefer message text, fallback to rule description
			title := strings.TrimSpace(result.Message.Text)
			if title == "" {
				if rule, ok := ruleMap[result.RuleID]; ok && rule.ShortDescription.Text != "" {
					title = rule.ShortDescription.Text
				} else {
					title = result.RuleID
				}
			}

			findings = append(findings, Finding{
				Category: models.CategorySAST,
				Title:    title,
				Severity: mapSarifLevel(result.Level),
				Location: location,
				RuleID:   result.RuleID,
				RawData:  rawData,
				Evidence: evidence,
			})
		}
	}
	return findings, nil
}

func buildSarifEvidence(result sarifResult, region sarifRegion, filePath, toolName string) map[string]any {
	evidence := map[string]any{
		"scannerType": "sarif",
		"findingType": "sast",
		"category":    models.CategorySAST,
	}

	if toolName != "" {
		evidence["scannerType"] = toolName
	}

	if result.RuleID != "" {
		evidence["ruleId"] = result.RuleID
	}

	if filePath != "" {
		evidence["filePath"] = filePath
	}

	if region.StartLine > 0 {
		evidence["startLine"] = region.StartLine
	}
	if region.EndLine > 0 {
		evidence["endLine"] = region.EndLine
	}
	if region.StartColumn > 0 {
		evidence["startCol"] = region.StartColumn
	}
	if region.EndColumn > 0 {
		evidence["endCol"] = region.EndColumn
	}

	// Extract snippet - this is the key field for code display
	snippet := strings.TrimSpace(region.Snippet.Text)
	if snippet != "" {
		evidence["snippet"] = snippet
		evidence["code"] = snippet // backward compatibility
	}

	if result.Message.Text != "" {
		evidence["message"] = result.Message.Text
	}

	if result.Level != "" {
		evidence["severityRaw"] = result.Level
	}

	return evidence
}

func mapSarifLevel(level string) string {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "error":
		return "high"
	case "warning":
		return "medium"
	case "note", "none":
		return "low"
	default:
		return "low"
	}
}

type SarifParser struct{}

func (p *SarifParser) ScannerType() string {
	return "sarif"
}

func (p *SarifParser) CanParse(data []byte) bool {
	return canParseSarif(data)
}

func (p *SarifParser) Parse(data []byte) ([]Finding, error) {
	return parseSarif(data, "")
}
