package parser

import (
	"context"
	"testing"

	"redlycoris/internal/domain"
)

const zapFixture = `{
  "@programName": "ZAP",
  "@version": "2.17.0",
  "site": [
    {
      "@name": "http://host.docker.internal:3000",
      "alerts": [
        {
          "pluginid": "10106",
          "alertRef": "10106",
          "alert": "HTTP Only Site",
          "name": "HTTP Only Site",
          "riskcode": "2",
          "confidence": "2",
          "desc": "<p>The site is only served under HTTP and not HTTPS.</p>",
          "instances": [
            {
              "uri": "http://host.docker.internal:3000/",
              "method": "GET",
              "param": "",
              "attack": "",
              "evidence": "",
              "otherinfo": "Failed to connect"
            }
          ],
          "solution": "<p>Use HTTPS.</p>",
          "reference": "<p>https://letsencrypt.org/</p>",
          "cweid": "311"
        },
        {
          "pluginid": "10049",
          "alert": "Non-Storable Content",
          "riskcode": "0",
          "confidence": "2",
          "instances": [
            {"uri": "http://host.docker.internal:3000", "method": "GET", "evidence": "403"},
            {"uri": "http://host.docker.internal:3000/robots.txt", "method": "GET", "evidence": "403"}
          ],
          "cweid": "524"
        }
      ]
    }
  ]
}`

func TestZAPParser_CanParse(t *testing.T) {
	p := &ZAPParser{}
	if !p.CanParse([]byte(zapFixture)) {
		t.Fatal("expected ZAP report to be detected")
	}
}

func TestZAPParser_Parse(t *testing.T) {
	p := &ZAPParser{}
	findings, err := p.Parse(context.Background(), []byte(zapFixture))
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if len(findings) != 3 {
		t.Fatalf("expected 3 findings (one per alert instance), got %d", len(findings))
	}

	first := findings[0]
	if first.Kind != domain.KindDAST {
		t.Fatalf("expected DAST kind, got %s", first.Kind.String())
	}
	if first.Severity != domain.SeverityMedium {
		t.Fatalf("expected medium severity from riskcode=2, got %d", first.Severity)
	}
	if first.SourceType != "zap" {
		t.Fatalf("expected source type zap, got %s", first.SourceType)
	}
	if first.URL == nil || *first.URL != "http://host.docker.internal:3000/" {
		t.Fatalf("unexpected URL: %#v", first.URL)
	}
	if len(first.CWEIDs) != 1 || first.CWEIDs[0] != 311 {
		t.Fatalf("expected CWE-311, got %v", first.CWEIDs)
	}
	if first.Fingerprint == "" {
		t.Fatal("fingerprint must be filled")
	}

	third := findings[2]
	if third.Severity != domain.SeverityInfo {
		t.Fatalf("expected informational severity for riskcode=0, got %d", third.Severity)
	}
}
