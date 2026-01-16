package parser

import (
	"encoding/json"
	"fmt"
	"strings"
)

type TextParser struct {
	scannerType string
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
			Title:       "Unstructured report",
			Description: &description,
			Severity:    "low",
			RawData: map[string]any{
				"format": "text",
			},
		},
	}, nil
}
