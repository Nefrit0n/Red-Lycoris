package parser

import (
	"encoding/json"
	"strings"

	"lotus-warden/backend/internal/models"
)

// CodeQLParser parses CodeQL SARIF output.
// CodeQL only outputs SARIF format.
type CodeQLParser struct{}

func (p *CodeQLParser) ScannerType() string { return "codeql" }

func (p *CodeQLParser) CanParse(data []byte) bool {
	if !canParseSarif(data) {
		return false
	}

	// Check if it's specifically CodeQL SARIF
	var sarif sarifReport
	if err := json.Unmarshal(data, &sarif); err != nil {
		return false
	}

	for _, run := range sarif.Runs {
		toolName := strings.ToLower(run.Tool.Driver.Name)
		if strings.Contains(toolName, "codeql") {
			return true
		}
	}

	return false
}

func (p *CodeQLParser) Parse(data []byte) ([]Finding, error) {
	findings, err := parseSarif(data, "codeql")
	if err != nil {
		return nil, err
	}

	// Post-process findings to set correct category and enhance evidence
	for i := range findings {
		findings[i].Category = models.CategorySAST
		if findings[i].Evidence == nil {
			findings[i].Evidence = map[string]any{}
		}
		findings[i].Evidence["scannerType"] = "codeql"
		findings[i].Evidence["findingType"] = "sast"
		findings[i].Evidence["category"] = models.CategorySAST
	}

	return findings, nil
}
