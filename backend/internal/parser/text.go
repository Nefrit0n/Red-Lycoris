package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"lotus-warden/backend/internal/models"
)

type TextParser struct {
	scannerType string
}

func NewTextParser(scannerType string) *TextParser {
	return &TextParser{scannerType: scannerType}
}

func (p *TextParser) ScannerType() string {
	return p.scannerType
}

func (p *TextParser) CanParse(data []byte) bool {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" {
		return false
	}
	return !json.Valid(data)
}

func (p *TextParser) Parse(data []byte) ([]Finding, error) {
	content := strings.TrimSpace(string(data))
	if content == "" {
		return nil, fmt.Errorf("report is empty")
	}
	description := content
	return []Finding{
		{
			Category:    models.CategorySAST,
			Title:       "Unstructured report",
			Description: &description,
			Severity:    "low",
			RawData: map[string]any{
				"format": "text",
			},
		},
	}, nil
}
