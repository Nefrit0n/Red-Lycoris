package parser

import (
	"context"
	"os"
	"strings"
	"testing"

	"redlycoris/internal/domain"
)

func TestAppScreenerParser_CanParse(t *testing.T) {
	t.Parallel()

	p := &AppScreenerParser{}
	for _, name := range []string{"appscreener_sast.sarif", "appscreener_sca.sarif"} {
		data := readParserFixture(t, name)
		if !p.CanParse(data) {
			t.Fatalf("expected appScreener parser to detect %s", name)
		}
	}

	otherSARIF := []byte(`{
		"version": "2.1.0",
		"runs": [{
			"tool": {"driver": {"name": "gosec", "rules": []}},
			"results": []
		}]
	}`)
	if p.CanParse(otherSARIF) {
		t.Fatal("expected appScreener parser to reject non-appScreener SARIF")
	}
}

func TestAppScreenerParser_DetectorPrecedesGenericSARIF(t *testing.T) {
	t.Parallel()

	name, findings, err := DetectAndParse(context.Background(), readParserFixture(t, "appscreener_sast.sarif"))
	if err != nil {
		t.Fatalf("DetectAndParse returned error: %v", err)
	}
	if name != "appscreener" {
		t.Fatalf("expected appscreener parser, got %q", name)
	}
	if len(findings) != 3 {
		t.Fatalf("expected 3 findings, got %d", len(findings))
	}
}

func TestAppScreenerParser_ParseSAST(t *testing.T) {
	t.Parallel()

	findings, err := (&AppScreenerParser{}).Parse(context.Background(), readParserFixture(t, "appscreener_sast.sarif"))
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if len(findings) != 3 {
		t.Fatalf("expected 3 findings, got %d", len(findings))
	}
	for _, f := range findings {
		if f.Kind != domain.KindSAST {
			t.Fatalf("expected KindSAST, got %v for %+v", f.Kind, f)
		}
		if f.SourceType != "appscreener" {
			t.Fatalf("unexpected source type: %s", f.SourceType)
		}
	}

	f := findByRuleID(t, findings, "PYTHON_PASSWORD_HARDCODED")
	if f.Severity != domain.SeverityHigh {
		t.Fatalf("expected high severity, got %d", f.Severity)
	}
	if !containsInt(f.CWEIDs, 256) || !containsInt(f.CWEIDs, 798) {
		t.Fatalf("expected CWE 256 and 798, got %v", f.CWEIDs)
	}
	if f.FilePath == "" || f.LineStart == 0 {
		t.Fatalf("expected file path and line start, got path=%q line=%d", f.FilePath, f.LineStart)
	}
	if f.CodeSnippet == nil || strings.TrimSpace(*f.CodeSnippet) == "" {
		t.Fatal("expected code snippet")
	}
	if strings.TrimSpace(f.Description) == "" {
		t.Fatal("expected non-empty description")
	}
	if strings.ContainsAny(f.Description, "<>") {
		t.Fatalf("expected sanitized plain description, got %q", f.Description)
	}
	if f.RuleName == nil || *f.RuleName != "Hardcoded password" {
		t.Fatalf("unexpected rule name: %v", f.RuleName)
	}
	if f.Fingerprint == "" {
		t.Fatal("expected fingerprint")
	}
}

func TestAppScreenerParser_ParseSCA(t *testing.T) {
	t.Parallel()

	findings, err := (&AppScreenerParser{}).Parse(context.Background(), readParserFixture(t, "appscreener_sca.sarif"))
	if err != nil {
		t.Fatalf("Parse returned error: %v", err)
	}
	if len(findings) != 3 {
		t.Fatalf("expected 3 findings, got %d", len(findings))
	}
	for _, f := range findings {
		if f.Kind != domain.KindSCA {
			t.Fatalf("expected KindSCA, got %v for %+v", f.Kind, f)
		}
		if f.SourceType != "appscreener" {
			t.Fatalf("unexpected source type: %s", f.SourceType)
		}
		if f.Title == f.Description || strings.Contains(f.Title, "\n") || len(f.Title) > 120 {
			t.Fatalf("expected compact title, got %q", f.Title)
		}
	}

	flask := findByCVE(t, findings, "CVE-2023-30861")
	if flask.Component != "flask" || flask.ComponentVersion != "2.0.1" {
		t.Fatalf("unexpected flask component payload: %+v", flask)
	}
	if flask.Purl == nil || *flask.Purl != "pkg:pypi/flask@2.0.1" {
		t.Fatalf("unexpected purl: %v", flask.Purl)
	}
	if flask.PackageEcosystem == nil || *flask.PackageEcosystem != "pypi" {
		t.Fatalf("unexpected package ecosystem: %v", flask.PackageEcosystem)
	}
	if flask.Severity != domain.SeverityHigh {
		t.Fatalf("expected high severity, got %d", flask.Severity)
	}
	if flask.FixedVersion == nil || *flask.FixedVersion != "2.2.5" {
		t.Fatalf("unexpected fixed version: %v", flask.FixedVersion)
	}

	expected := map[string]string{
		"CVE-2023-30861": "flask:2.0.1",
		"CVE-2024-35195": "requests:2.26.0",
		"CVE-2023-32681": "requests:2.26.0",
	}
	fingerprints := make(map[string]struct{}, len(findings))
	for cve, component := range expected {
		f := findByCVE(t, findings, cve)
		got := f.Component + ":" + f.ComponentVersion
		if got != component {
			t.Fatalf("for %s expected component %s, got %s", cve, component, got)
		}
		if len(f.CVEIDs) != 1 || f.CVEIDs[0] != cve {
			t.Fatalf("unexpected CVE IDs for %s: %v", cve, f.CVEIDs)
		}
		fingerprints[f.Fingerprint] = struct{}{}
	}
	if len(fingerprints) != 3 {
		t.Fatalf("expected 3 distinct fingerprints, got %d", len(fingerprints))
	}
}

func readParserFixture(t *testing.T, name string) []byte {
	t.Helper()

	data, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return data
}

func findByRuleID(t *testing.T, findings []domain.Finding, ruleID string) domain.Finding {
	t.Helper()

	for _, f := range findings {
		if f.RuleID != nil && *f.RuleID == ruleID {
			return f
		}
	}
	t.Fatalf("finding with rule id %s not found", ruleID)
	return domain.Finding{}
}

func findByCVE(t *testing.T, findings []domain.Finding, cve string) domain.Finding {
	t.Helper()

	for _, f := range findings {
		for _, id := range f.CVEIDs {
			if id == cve {
				return f
			}
		}
	}
	t.Fatalf("finding with CVE %s not found", cve)
	return domain.Finding{}
}

func containsInt(values []int, want int) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}
