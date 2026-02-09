package plugins

import (
	"encoding/json"
	"testing"

	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/parser"
)

func TestNormalizeTrivyVulnerabilityComponent(t *testing.T) {
	findings := []parser.Finding{
		{
			Category: models.CategorySCA,
			Title:    "CVE-2024-0001",
			Severity: models.SeverityHigh,
			RuleID:   "CVE-2024-0001",
			Evidence: map[string]any{
				"findingType":      "vulnerability",
				"pkgName":          "openssl",
				"installedVersion": "1.0.2",
				"fixedVersion":     "1.0.2u",
			},
			RawData: map[string]any{
				"type":              "vulnerability",
				"installed_version": "1.0.2",
			},
		},
	}

	normalized, err := normalizeTrivyFindings(findings, "0.0.0")
	if err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if len(normalized) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(normalized))
	}
	item := normalized[0]
	if item.Category != models.CategorySCA {
		t.Fatalf("expected category %s, got %s", models.CategorySCA, item.Category)
	}
	if item.Kind != "vulnerability" {
		t.Fatalf("expected kind vulnerability, got %s", item.Kind)
	}
	canonical, ok := item.RawData["canonical"].(map[string]any)
	if !ok {
		t.Fatalf("expected canonical map in raw data")
	}
	component, ok := canonical["component"].(map[string]any)
	if !ok {
		t.Fatalf("expected component map in canonical data")
	}
	if component["package_name"] != "openssl" {
		t.Fatalf("expected package_name openssl, got %#v", component["package_name"])
	}
	if component["installed_version"] != "1.0.2" {
		t.Fatalf("expected installed_version 1.0.2, got %#v", component["installed_version"])
	}
	if component["fixed_version"] != "1.0.2u" {
		t.Fatalf("expected fixed_version 1.0.2u, got %#v", component["fixed_version"])
	}
}

func TestNormalizeSemgrepMetadataRaw(t *testing.T) {
	rawMeta := json.RawMessage(`{"confidence":"HIGH","extra":"value"}`)
	findings := []parser.Finding{
		{
			Category: models.CategorySAST,
			Title:    "app.py",
			Severity: models.SeverityMedium,
			RuleID:   "semgrep.test",
			RawData: map[string]any{
				"type":         "sast",
				"metadata_raw": rawMeta,
			},
		},
	}

	normalized, err := normalizeSemgrepFindings(findings, "1.0.0")
	if err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if len(normalized) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(normalized))
	}
	item := normalized[0]
	if item.Category != models.CategorySAST {
		t.Fatalf("expected category %s, got %s", models.CategorySAST, item.Category)
	}
	if _, ok := item.RawData["metadata_raw"]; !ok {
		t.Fatalf("expected metadata_raw to be preserved in raw data")
	}
}

func TestNormalizeTrivyUnknownFindingType(t *testing.T) {
	findings := []parser.Finding{
		{
			Category: models.CategoryConfig,
			Title:    "unknown finding",
			Severity: models.SeverityLow,
			RuleID:   "UNKNOWN-1",
			Evidence: map[string]any{
				"findingType": "mystery",
			},
		},
	}

	normalized, err := normalizeTrivyFindings(findings, "0.0.0")
	if err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if len(normalized) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(normalized))
	}
	item := normalized[0]
	if item.Category != models.CategoryUnknown {
		t.Fatalf("expected category %s, got %s", models.CategoryUnknown, item.Category)
	}
	if item.Kind != "mystery" {
		t.Fatalf("expected kind mystery, got %s", item.Kind)
	}
}
