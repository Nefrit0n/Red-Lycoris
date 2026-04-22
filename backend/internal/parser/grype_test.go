package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

const grypeEmptyFixture = `{
  "matches": [],
  "source": {"type": "file", "target": "."},
  "descriptor": {"name": "grype", "version": "0.111.1"}
}`

const grypeFixture = `{
  "matches": [
    {
      "vulnerability": {
        "id": "CVE-2024-12345",
        "severity": "High",
        "description": "Example vulnerability.",
        "dataSource": "https://github.com/advisories/GHSA-xxxx",
        "namespace": "nvd:cpe",
        "cweIDs": ["CWE-79"],
        "fix": {"versions": ["2.1.0"], "state": "fixed"}
      },
      "artifact": {
        "name": "openssl",
        "version": "2.0.0",
        "type": "rpm",
        "purl": "pkg:rpm/redhat/openssl@2.0.0",
        "locations": [{"path": "/usr/lib64/libssl.so"}]
      }
    }
  ],
  "source": {"type": "image", "target": "registry.example.com/app:latest"},
  "descriptor": {"name": "grype", "version": "0.111.1"}
}`

func TestGrypeParser_CanParse(t *testing.T) {
	p := &GrypeParser{}
	if !p.CanParse([]byte(grypeEmptyFixture)) {
		t.Fatal("expected grype payload to be detected")
	}
}

func TestGrypeParser_Parse_EmptyMatches(t *testing.T) {
	p := &GrypeParser{}
	findings, err := p.Parse(context.Background(), []byte(grypeEmptyFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected empty findings, got %d", len(findings))
	}
}

func TestGrypeParser_Parse_Vulnerability(t *testing.T) {
	p := &GrypeParser{}
	findings, err := p.Parse(context.Background(), []byte(grypeFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}

	f := findings[0]
	if f.Kind != domain.KindSCA {
		t.Fatalf("expected SCA kind, got %v", f.Kind)
	}
	if f.SourceType != "grype" {
		t.Fatalf("unexpected source type: %s", f.SourceType)
	}
	if f.Severity != domain.SeverityHigh {
		t.Fatalf("unexpected severity: %d", f.Severity)
	}
	if f.Component != "openssl" || f.ComponentVersion != "2.0.0" {
		t.Fatalf("unexpected component payload: %+v", f)
	}
	if f.FilePath != "/usr/lib64/libssl.so" {
		t.Fatalf("unexpected file path: %s", f.FilePath)
	}
	if len(f.CVEIDs) != 1 || f.CVEIDs[0] != "CVE-2024-12345" {
		t.Fatalf("unexpected CVE IDs: %#v", f.CVEIDs)
	}
	if len(f.CWEIDs) != 1 || f.CWEIDs[0] != 79 {
		t.Fatalf("unexpected CWE IDs: %#v", f.CWEIDs)
	}
	if f.FixedVersion == nil || *f.FixedVersion != "2.1.0" {
		t.Fatalf("unexpected fixed version: %#v", f.FixedVersion)
	}
	if f.Purl == nil || *f.Purl != "pkg:rpm/redhat/openssl@2.0.0" {
		t.Fatalf("unexpected purl: %#v", f.Purl)
	}
	if f.PackageEcosystem == nil || *f.PackageEcosystem != "rpm" {
		t.Fatalf("unexpected package ecosystem: %#v", f.PackageEcosystem)
	}
	if f.Fingerprint == "" {
		t.Fatal("expected fingerprint to be set")
	}
}
