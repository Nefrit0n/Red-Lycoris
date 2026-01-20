package intel

import (
	"reflect"
	"testing"

	"lotus-warden/backend/internal/parser"
)

func TestNormalizeIdentifiers(t *testing.T) {
	identifiers := NormalizeIdentifiers(
		"Fixes CVE-2024-1234 and ghsa-abcd-1234-efgh",
		"OSV-2024-XYZ9",
		"cve-2024-1234",
	)

	expected := []string{"CVE-2024-1234", "GHSA-ABCD-1234-EFGH", "OSV-2024-XYZ9"}
	if !reflect.DeepEqual(identifiers, expected) {
		t.Fatalf("expected %v, got %v", expected, identifiers)
	}
}

func TestExtractIdentifiersFromFinding(t *testing.T) {
	desc := "See CVE-2023-9999 for details"
	finding := parser.Finding{
		Title:       "Test GHSA-aaaa-bbbb-cccc",
		Description: &desc,
		RuleID:      "cve-2022-0001",
		RawData: map[string]any{
			"reference": "OSV-2021-TEST",
		},
	}

	got := ExtractIdentifiersFromFinding(finding)
	expected := []string{
		"CVE-2022-0001",
		"CVE-2023-9999",
		"GHSA-AAAA-BBBB-CCCC",
		"OSV-2021-TEST",
	}

	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("expected %v, got %v", expected, got)
	}
}
