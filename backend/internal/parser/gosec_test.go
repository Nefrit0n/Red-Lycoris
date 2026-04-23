package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

func TestGosecParser_CanParse(t *testing.T) {
	t.Parallel()

	data := []byte(`{
		"Issues": [],
		"Stats": {"files": 1, "lines": 10, "nosec": 0, "found": 0},
		"GosecVersion": "dev"
	}`)

	p := &GosecParser{}
	if !p.CanParse(data) {
		t.Fatalf("expected gosec parser to detect report")
	}
}

func TestGosecParser_Parse(t *testing.T) {
	t.Parallel()

	data := []byte(`{
		"Issues": [
			{
				"severity": "HIGH",
				"confidence": "MEDIUM",
				"cwe": {"id": "190", "url": "https://cwe.mitre.org/data/definitions/190.html"},
				"rule_id": "G115",
				"details": "integer overflow conversion int -> int32",
				"file": "/src/backend/internal/enrichment/nvd/sync.go",
				"code": "663:\t\trec.CWEIDs = append(rec.CWEIDs, int32(id))",
				"line": "663",
				"column": "43"
			},
			{
				"severity": "LOW",
				"confidence": "HIGH",
				"cwe": {"id": "703"},
				"rule_id": "G104",
				"details": "Errors unhandled",
				"file": "/src/backend/internal/api/response.go",
				"code": "13:\tjson.NewEncoder(w).Encode(data)",
				"line": "13",
				"column": "2"
			}
		],
		"Stats": {"files": 114, "lines": 24276, "nosec": 0, "found": 2},
		"GosecVersion": "dev"
	}`)

	p := &GosecParser{}
	findings, err := p.Parse(context.Background(), data)
	if err != nil {
		t.Fatalf("parse returned error: %v", err)
	}
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}

	first := findings[0]
	if first.Kind != domain.KindSAST {
		t.Fatalf("unexpected kind: %v", first.Kind)
	}
	if first.Severity != domain.SeverityHigh {
		t.Fatalf("unexpected severity: %d", first.Severity)
	}
	if first.Confidence != 2 {
		t.Fatalf("unexpected confidence: %d", first.Confidence)
	}
	if first.LineStart != 663 || first.LineEnd != 663 {
		t.Fatalf("unexpected lines: %d-%d", first.LineStart, first.LineEnd)
	}
	if first.RuleID == nil || *first.RuleID != "G115" {
		t.Fatalf("unexpected rule id: %v", first.RuleID)
	}
	if len(first.CWEIDs) != 1 || first.CWEIDs[0] != 190 {
		t.Fatalf("unexpected cwe ids: %v", first.CWEIDs)
	}
	if first.SourceType != "gosec" {
		t.Fatalf("unexpected source type: %s", first.SourceType)
	}
}
