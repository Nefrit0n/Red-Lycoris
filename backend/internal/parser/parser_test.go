package parser

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestParseTrivyReport(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "trivy_result.json"))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	findings, err := ParseReport("trivy", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) == 0 {
		t.Fatalf("expected findings, got %d", len(findings))
	}
	first := findings[0]
	if first.RuleID != "CVE-2024-0001" {
		t.Fatalf("expected rule id to be set")
	}
	if first.Title != "CVE-2024-0001 — lodash" {
		t.Fatalf("expected title to be stable, got %s", first.Title)
	}
	if first.Location != "package-lock.json" {
		t.Fatalf("expected location package-lock.json, got %s", first.Location)
	}
	if first.Severity != "high" {
		t.Fatalf("expected severity normalized, got %s", first.Severity)
	}
	if first.Evidence == nil {
		t.Fatalf("expected evidence to be set")
	}
	if tool, ok := first.Evidence["tool"].(string); !ok || tool != "trivy" {
		t.Fatalf("expected evidence tool trivy")
	}
	if evidenceType, ok := first.Evidence["type"].(string); !ok || evidenceType != "sca" {
		t.Fatalf("expected evidence type sca")
	}
	if vulnID, ok := first.Evidence["vulnerabilityId"].(string); !ok || vulnID == "" {
		t.Fatalf("expected vulnerability id to be present")
	}
	if pkg, ok := first.Evidence["pkgName"].(string); !ok || pkg == "" {
		t.Fatalf("expected package name to be present")
	}
	if severityRaw, ok := first.Evidence["severityRaw"].(string); !ok || severityRaw == "" {
		t.Fatalf("expected severity raw to be present")
	}
}

func TestParseTrivyEmptyResults(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "empty-report",
		"Results":      []any{},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	findings, err := ParseReport("trivy", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(findings))
	}
}

func TestParseZapReport(t *testing.T) {
	payload := map[string]any{
		"site": []any{
			map[string]any{
				"name": "https://example.com",
				"alerts": []any{
					map[string]any{
						"alert":    "XSS",
						"desc":     "Reflected XSS",
						"riskcode": "3",
						"uri":      "https://example.com/search",
						"pluginid": "90001",
					},
				},
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	findings, err := ParseReport("zap", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != "high" {
		t.Fatalf("expected severity high, got %s", findings[0].Severity)
	}
}

func TestParseSemgrepReport(t *testing.T) {
	payload := map[string]any{
		"results": []any{
			map[string]any{
				"check_id": "gosec.G101",
				"path":     "main.go",
				"start": map[string]any{
					"line": 42,
				},
				"extra": map[string]any{
					"message":  "Potential credential exposure",
					"severity": "HIGH",
				},
			},
		},
		"paths": map[string]any{
			"scanned": []string{"main.go"},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	findings, err := ParseReport("semgrep", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Location != "main.go:42" {
		t.Fatalf("expected location main.go:42, got %s", findings[0].Location)
	}
}

func TestParseSemgrepEmptyResults(t *testing.T) {
	payload := map[string]any{
		"results": []any{},
		"paths": map[string]any{
			"scanned": []string{"main.go"},
		},
		"errors": []any{},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	findings, err := ParseReport("semgrep", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(findings))
	}
}

func TestParseSarifReport(t *testing.T) {
	payload := map[string]any{
		"version": "2.1.0",
		"runs": []any{
			map[string]any{
				"tool": map[string]any{
					"driver": map[string]any{
						"name": "Trivy",
					},
				},
				"results": []any{
					map[string]any{
						"ruleId": "TRIVY-001",
						"level":  "warning",
						"message": map[string]any{
							"text": "Outdated dependency",
						},
						"locations": []any{
							map[string]any{
								"physicalLocation": map[string]any{
									"artifactLocation": map[string]any{
										"uri": "package.json",
									},
									"region": map[string]any{
										"startLine": 12,
									},
								},
							},
						},
					},
				},
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	findings, err := ParseReport("trivy", raw)
	if err != nil {
		t.Fatalf("parse report: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Severity != "medium" {
		t.Fatalf("expected severity medium, got %s", findings[0].Severity)
	}
}
