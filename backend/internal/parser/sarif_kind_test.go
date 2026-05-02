package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

func TestSARIFParser_GosecToolIsSAST(t *testing.T) {
	p := &SARIFParser{}
	input := []byte(`{
		"version": "2.1.0",
		"runs": [{
			"tool": {"driver": {"name": "gosec", "rules": [{"id":"G124","name":"cookie"}]}},
			"results": [{
				"ruleId": "G124",
				"level": "error",
				"message": {"text": "http.Cookie missing or has insecure attributes"},
				"locations": [{"physicalLocation": {"artifactLocation": {"uri":"internal/api/auth.go"}, "region": {"startLine": 116, "endLine": 116}}}]
			}]
		}]
	}`)

	findings, err := p.Parse(context.Background(), input)
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Kind != domain.KindSAST {
		t.Fatalf("expected KindSAST for gosec SARIF, got %v", findings[0].Kind)
	}
}
