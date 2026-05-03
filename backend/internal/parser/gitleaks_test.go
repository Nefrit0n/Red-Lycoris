package parser

import (
	"context"
	"testing"
)

const gitleaksListFixture = `[
  {
    "RuleID": "generic-api-key",
    "Description": "Generic API Key",
    "File": "config/.env",
    "StartLine": 10,
    "EndLine": 10,
    "Commit": "1234567890abcdef",
    "Author": "dev",
    "Match": "API_KEY=abcd1234efgh5678",
    "Secret": "abcd1234efgh5678"
  }
]`

const gitleaksEnvelopeFixture = `{
  "findings": [
    {
      "RuleID": "aws-access-token",
      "Description": "AWS token",
      "File": "secrets.txt",
      "StartLine": 3,
      "EndLine": 3,
      "Commit": "abcdef1234567890",
      "Author": "ci",
      "Match": "AKIAIOSFODNN7EXAMPLE",
      "Secret": "AKIAIOSFODNN7EXAMPLE"
    }
  ]
}`

func TestGitleaksParser_CanParse_List(t *testing.T) {
	p := &GitleaksParser{}
	if !p.CanParse([]byte(gitleaksListFixture)) {
		t.Fatal("expected list fixture to be detected as gitleaks")
	}
}

func TestGitleaksParser_CanParse_Envelope(t *testing.T) {
	p := &GitleaksParser{}
	if !p.CanParse([]byte(gitleaksEnvelopeFixture)) {
		t.Fatal("expected envelope fixture to be detected as gitleaks")
	}
}

func TestGitleaksParser_Parse_Envelope(t *testing.T) {
	p := &GitleaksParser{}
	findings, err := p.Parse(context.Background(), []byte(gitleaksEnvelopeFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].SourceType != "gitleaks" {
		t.Fatalf("unexpected source type: %s", findings[0].SourceType)
	}
}


func TestGitleaksParser_CanParse_EmptyCommit(t *testing.T) {
	p := &GitleaksParser{}
	payload := `[{"RuleID":"private-key","Match":"-----BEGIN REDACTED TEST KEY-----","Secret":"-----BEGIN REDACTED TEST KEY-----","Commit":""}]`
	if !p.CanParse([]byte(payload)) {
		t.Fatal("expected gitleaks payload with empty commit to be detected")
	}
}
