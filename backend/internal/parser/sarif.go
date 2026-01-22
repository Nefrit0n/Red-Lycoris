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

type sarifTool struct {
	Driver sarifDriver `json:"driver"`
}

type sarifDriver struct {
	Name string `json:"name"`
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
	StartLine int `json:"startLine"`
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
		for _, result := range run.Results {
			location := ""
			if len(result.Locations) > 0 {
				uri := strings.TrimSpace(result.Locations[0].PhysicalLocation.ArtifactLocation.URI)
				line := result.Locations[0].PhysicalLocation.Region.StartLine
				if line > 0 {
					location = uri + ":" + strconv.Itoa(line)
				} else {
					location = uri
				}
			}

			findings = append(findings, Finding{
				Category: models.CategorySAST,
				Title:    result.Message.Text,
				Severity: mapSarifLevel(result.Level),
				Location: location,
				RuleID:   result.RuleID,
				RawData: map[string]any{
					"rule_id": result.RuleID,
					"level":   result.Level,
				},
			})
		}
	}
	return findings, nil
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
