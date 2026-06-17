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

func TestSARIFParser_GrypePropertiesPURLIsSCA(t *testing.T) {
	p := &SARIFParser{}
	input := []byte(`{
		"version": "2.1.0",
		"runs": [{
			"tool": {"driver": {"name": "grype", "rules": [{
				"id": "CVE-2021-44228",
				"name": "CVE-2021-44228",
				"properties": {
					"purl": "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
					"fixedVersion": "2.17.1"
				}
			}]}},
			"results": [{
				"ruleId": "CVE-2021-44228",
				"level": "error",
				"message": {"text": "CVE-2021-44228 in log4j-core"}
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
	f := findings[0]
	if f.Kind != domain.KindSCA {
		t.Fatalf("expected KindSCA for Grype SARIF with purl, got %v", f.Kind)
	}
	if f.Purl == nil || *f.Purl != "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1" {
		t.Fatalf("unexpected purl: %v", f.Purl)
	}
	if f.Component != "log4j-core" {
		t.Fatalf("expected component from purl, got %q", f.Component)
	}
	if f.ComponentVersion != "2.14.1" {
		t.Fatalf("expected component version from purl, got %q", f.ComponentVersion)
	}
	if f.PackageEcosystem == nil || *f.PackageEcosystem != "maven" {
		t.Fatalf("expected ecosystem maven, got %v", f.PackageEcosystem)
	}
}

func TestSARIFParser_WebRequestIsDAST(t *testing.T) {
	p := &SARIFParser{}
	input := []byte(`{
		"version": "2.1.0",
		"runs": [{
			"tool": {"driver": {"name": "burp", "rules": [{"id": "xss", "name": "Reflected XSS"}]}},
			"results": [{
				"ruleId": "xss",
				"level": "error",
				"message": {"text": "Reflected XSS"},
				"webRequest": {"method": "GET", "target": "https://example.test/search?q=xss"},
				"webResponse": {"statusCode": 200},
				"locations": [{
					"properties": {"parameter": "q", "evidence": "<script>alert(1)</script>"}
				}]
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
	f := findings[0]
	if f.Kind != domain.KindDAST {
		t.Fatalf("expected KindDAST for SARIF webRequest, got %v", f.Kind)
	}
	if f.URL == nil || *f.URL != "https://example.test/search?q=xss" {
		t.Fatalf("unexpected url: %v", f.URL)
	}
	if f.HTTPMethod == nil || *f.HTTPMethod != "GET" {
		t.Fatalf("unexpected http method: %v", f.HTTPMethod)
	}
	if f.HTTPParam == nil || *f.HTTPParam != "q" {
		t.Fatalf("unexpected http param: %v", f.HTTPParam)
	}
	if len(f.HTTPEvidence) == 0 {
		t.Fatal("expected http evidence")
	}
}
