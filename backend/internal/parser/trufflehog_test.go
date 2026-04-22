package parser

import (
	"context"
	"strings"
	"testing"

	"redlycoris/internal/domain"
)

const trufflehogNDJSONFixture = `
{
    "SourceMetadata": {
        "Data": {
            "Filesystem": { "file": "vault/.git/packed-refs", "line": 2610 }
        }
    },
    "SourceID": 1,
    "SourceType": 15,
    "SourceName": "trufflehog - filesystem",
    "DetectorType": 4,
    "DetectorName": "Circle",
    "DetectorDescription": "CircleCI is a continuous integration...",
    "DecoderName": "PLAIN",
    "Verified": false,
    "VerificationFromCache": false,
    "Raw": "d29d64371cfe425829df970b4f4ecef66b91e8fc",
    "RawV2": "",
    "Redacted": "",
    "ExtraData": { "Version": "1" },
    "StructuredData": null
}
{
    "SourceMetadata": { "Data": { "Git": { "commit": "abc123def456", "file": "src/config.py", "email": "dev@example.com", "repository": "https://github.com/acme/app", "timestamp": "2024-03-20T10:00:00Z", "line": 42 } } },
    "SourceType": 7, "SourceName": "trufflehog - git",
    "DetectorName": "AWS", "Verified": true,
    "Raw": "AKIAIOSFODNN7EXAMPLE",
    "ExtraData": { "account": "123456789012", "rotation_guide": "https://rotate.example.com" }
}
`

const trufflehogJSONArrayFixture = `[
  {
    "SourceMetadata": {
      "Data": {
        "Filesystem": { "file": "vault/.git/packed-refs", "line": 2610 }
      }
    },
    "SourceName": "trufflehog - filesystem",
    "DetectorName": "Circle",
    "DetectorDescription": "CircleCI is a continuous integration...",
    "DecoderName": "PLAIN",
    "Verified": false,
    "Raw": "d29d64371cfe425829df970b4f4ecef66b91e8fc"
  }
]`

func TestTruffleHogParser_CanParse_NDJSON(t *testing.T) {
	p := &TruffleHogParser{}
	if !p.CanParse([]byte(trufflehogNDJSONFixture)) {
		t.Fatal("expected NDJSON TruffleHog payload to be detected")
	}
}

func TestTruffleHogParser_CanParse_JSONArray(t *testing.T) {
	p := &TruffleHogParser{}
	if !p.CanParse([]byte(trufflehogJSONArrayFixture)) {
		t.Fatal("expected JSON array TruffleHog payload to be detected")
	}
}

func TestTruffleHogParser_CanParse_RejectsGitleaks(t *testing.T) {
	p := &TruffleHogParser{}
	gitleaks := `[{"RuleID":"aws-access-token","Description":"token","File":"main.go","StartLine":1,"EndLine":1,"Commit":"abc","Author":"dev","Match":"AKIA...","Secret":"AKIA"}]`
	if p.CanParse([]byte(gitleaks)) {
		t.Fatal("gitleaks payload must not be detected as trufflehog")
	}
}

func TestTruffleHogParser_CanParse_RejectsSarif(t *testing.T) {
	p := &TruffleHogParser{}
	sarif := `{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"x"}},"results":[]}]}`
	if p.CanParse([]byte(sarif)) {
		t.Fatal("sarif payload must not be detected as trufflehog")
	}
}

func TestTruffleHogParser_Parse_FilesystemSource(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(trufflehogJSONArrayFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}

	f := findings[0]
	if f.FilePath != "vault/.git/packed-refs" || f.LineStart != 2610 || f.LineEnd != 2610 {
		t.Fatalf("unexpected filesystem location: %+v", f)
	}
	if f.SourceType != "trufflehog" {
		t.Fatalf("unexpected source type: %s", f.SourceType)
	}
}

func TestTruffleHogParser_Parse_GitSource(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(trufflehogNDJSONFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}

	f := findings[1]
	if f.FilePath != "src/config.py" || f.LineStart != 42 {
		t.Fatalf("unexpected git file location: %+v", f)
	}
	if f.CommitSHA == nil || *f.CommitSHA != "abc123def456" {
		t.Fatalf("expected commit sha to be filled, got %#v", f.CommitSHA)
	}
	if f.URL == nil || *f.URL != "https://github.com/acme/app#L42" {
		t.Fatalf("expected repository url with line anchor, got %#v", f.URL)
	}
}

func TestTruffleHogParser_Parse_VerifiedCritical(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(trufflehogNDJSONFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	f := findings[1]
	if f.Severity != domain.SeverityCritical {
		t.Fatalf("expected critical severity, got %d", f.Severity)
	}
	if f.Confidence != 3 {
		t.Fatalf("expected confidence 3, got %d", f.Confidence)
	}
}

func TestTruffleHogParser_Parse_UnverifiedHigh(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(trufflehogNDJSONFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	f := findings[0]
	if f.Severity != domain.SeverityHigh {
		t.Fatalf("expected high severity, got %d", f.Severity)
	}
	if f.Confidence != 2 {
		t.Fatalf("expected confidence 2, got %d", f.Confidence)
	}
}

func TestTruffleHogParser_Parse_DoesNotLeakRaw(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(trufflehogNDJSONFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) == 0 {
		t.Fatal("expected findings")
	}
	needle := "AKIAIOSFODNN7EXAMPLE"
	for _, f := range findings {
		if strings.Contains(f.Description, needle) || strings.Contains(f.Title, needle) {
			t.Fatalf("raw secret leaked into finding fields: %+v", f)
		}
		if f.CodeSnippet != nil && strings.Contains(*f.CodeSnippet, needle) {
			t.Fatalf("raw secret leaked into code snippet: %s", *f.CodeSnippet)
		}
	}
}

func TestTruffleHogParser_Parse_EmptyInput(t *testing.T) {
	p := &TruffleHogParser{}
	findings, err := p.Parse(context.Background(), []byte(`[]`))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected empty findings, got %d", len(findings))
	}
}
