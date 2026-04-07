package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"vulnscope/internal/domain"
)

// SARIF 2.1.0 structures (only fields we need)

type sarifReport struct {
	Schema  string     `json:"$schema"`
	Version string     `json:"version"`
	Runs    []sarifRun `json:"runs"`
}

type sarifRun struct {
	Tool    sarifTool     `json:"tool"`
	Results []sarifResult `json:"results"`
}

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name  string      `json:"name"`
	Rules []sarifRule `json:"rules"`
}

type sarifRule struct {
	ID               string          `json:"id"`
	ShortDescription sarifMessage    `json:"shortDescription"`
	FullDescription  sarifMessage    `json:"fullDescription"`
	DefaultConfig    sarifRuleConfig `json:"defaultConfiguration"`
	Properties       sarifProperties `json:"properties"`
	HelpURI          string          `json:"helpUri"`
}

type sarifRuleConfig struct {
	Level string `json:"level"`
}

type sarifProperties struct {
	Tags []string `json:"tags"`
}

type sarifMessage struct {
	Text string `json:"text"`
}

type sarifResult struct {
	RuleID    string          `json:"ruleId"`
	RuleIndex int             `json:"ruleIndex"`
	Level     string          `json:"level"`
	Message   sarifMessage    `json:"message"`
	Locations []sarifLocation `json:"locations"`
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
	StartLine int `json:"startLine"`
	EndLine   int `json:"endLine"`
}

type SARIFParser struct{}

func (p *SARIFParser) CanParse(data []byte) bool {
	var probe struct {
		Schema  string `json:"$schema"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(data, &probe); err != nil {
		return false
	}
	if strings.Contains(probe.Schema, "sarif") {
		return true
	}
	return probe.Version == "2.1.0" && probe.Schema != ""
}

func (p *SARIFParser) Parse(ctx context.Context, data []byte) ([]domain.Finding, error) {
	var report sarifReport
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("parser.SARIFParser.Parse: unmarshal: %w", err)
	}

	var findings []domain.Finding

	for _, run := range report.Runs {
		ruleMap := make(map[string]sarifRule, len(run.Tool.Driver.Rules))
		ruleByIndex := make(map[int]sarifRule, len(run.Tool.Driver.Rules))
		for i, rule := range run.Tool.Driver.Rules {
			ruleMap[rule.ID] = rule
			ruleByIndex[i] = rule
		}

		sourceName := run.Tool.Driver.Name

		for _, result := range run.Results {
			rule, ok := ruleMap[result.RuleID]
			if !ok {
				rule = ruleByIndex[result.RuleIndex]
			}

			title := result.Message.Text
			if title == "" {
				title = rule.ShortDescription.Text
			}
			if title == "" {
				title = result.RuleID
			}

			description := rule.FullDescription.Text

			level := result.Level
			if level == "" {
				level = rule.DefaultConfig.Level
			}

			severity := mapSARIFSeverity(level)
			confidence := mapSARIFConfidence(level)

			var filePath string
			var lineStart, lineEnd int
			if len(result.Locations) > 0 {
				loc := result.Locations[0]
				filePath = loc.PhysicalLocation.ArtifactLocation.URI
				lineStart = loc.PhysicalLocation.Region.StartLine
				lineEnd = loc.PhysicalLocation.Region.EndLine
			}

			cweIDs := extractCWEIDs(rule.Properties.Tags)

			f := domain.Finding{
				Title:       title,
				Description: description,
				Severity:    severity,
				Confidence:  confidence,
				Status:      domain.StatusOpen,
				FilePath:    filePath,
				LineStart:   lineStart,
				LineEnd:     lineEnd,
				CVEIDs:      []string{},
				CWEIDs:      cweIDs,
				SourceType:  sourceName,
			}
			f.Fingerprint = domain.CalculateFingerprint(&f)

			findings = append(findings, f)
		}
	}

	return findings, nil
}

func mapSARIFSeverity(level string) int {
	switch strings.ToLower(level) {
	case "error":
		return domain.SeverityHigh
	case "warning":
		return domain.SeverityMedium
	case "note":
		return domain.SeverityLow
	case "none", "":
		return domain.SeverityInfo
	default:
		return domain.SeverityInfo
	}
}

func mapSARIFConfidence(level string) int {
	switch strings.ToLower(level) {
	case "error":
		return 2 // high
	case "warning":
		return 1 // medium
	default:
		return 0 // low
	}
}

func extractCWEIDs(tags []string) []int {
	var ids []int
	for _, tag := range tags {
		lower := strings.ToLower(tag)
		if strings.HasPrefix(lower, "cwe-") {
			numStr := tag[4:]
			if n, err := strconv.Atoi(numStr); err == nil {
				ids = append(ids, n)
			}
		}
	}
	if ids == nil {
		ids = []int{}
	}
	return ids
}
