package parser

import (
	"encoding/json"
	"testing"
)

func TestParseTrivyReport(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "billing-api",
		"Results": []any{
			map[string]any{
				"Target": "app",
				"Vulnerabilities": []any{
					map[string]any{
						"VulnerabilityID": "CVE-2024-0001",
						"Title":           "SQL Injection",
						"Description":     "SQLi found",
						"Severity":        "HIGH",
						"PkgName":         "lib-sql",
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
	if findings[0].RuleID != "CVE-2024-0001" {
		t.Fatalf("expected rule id to be set")
	}
	if findings[0].Severity != "high" {
		t.Fatalf("expected severity normalized, got %s", findings[0].Severity)
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
