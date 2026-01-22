package parser

import (
	"encoding/json"
	"strings"
	"testing"

	"lotus-warden/backend/internal/models"
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

func TestParseTrivyReportScaEvidenceFixedVersionOptional(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "billing-api",
		"Results": []any{
			map[string]any{
				"Target": "app",
				"Type":   "npm",
				"Vulnerabilities": []any{
					map[string]any{
						"VulnerabilityID":  "GHSA-xxxx-xxxx-xxxx",
						"PkgName":          "lodash",
						"InstalledVersion": "4.17.20",
						"FixedVersion":     "",
						"Severity":         "MEDIUM",
						"PrimaryURL":       "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx",
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

	f := findings[0]
	if f.Category != models.CategorySCA {
		t.Fatalf("expected category SCA, got %s", f.Category)
	}
	if f.Evidence == nil {
		t.Fatal("expected evidence")
	}
	if f.Evidence["pkgName"] != "lodash" {
		t.Fatalf("expected pkgName in evidence, got %v", f.Evidence["pkgName"])
	}
	if f.Evidence["installedVersion"] != "4.17.20" {
		t.Fatalf("expected installedVersion in evidence, got %v", f.Evidence["installedVersion"])
	}
	if _, ok := f.Evidence["fixedVersion"]; ok {
		t.Fatalf("expected fixedVersion to be omitted when empty")
	}
	if f.Evidence["vulnerabilityId"] != "GHSA-xxxx-xxxx-xxxx" {
		t.Fatalf("expected vulnerabilityId in evidence, got %v", f.Evidence["vulnerabilityId"])
	}
	if f.Evidence["primaryUrl"] != "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx" {
		t.Fatalf("expected primaryUrl in evidence, got %v", f.Evidence["primaryUrl"])
	}
}

func TestParseTrivyReportWithExtendedFields(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "myapp:latest",
		"Results": []any{
			map[string]any{
				"Target": "usr/local/lib/python3.9/site-packages",
				"Class":  "lang-pkgs",
				"Type":   "pip",
				"Vulnerabilities": []any{
					map[string]any{
						"VulnerabilityID":  "CVE-2024-1234",
						"Title":            "Remote Code Execution",
						"Description":      "A critical RCE vulnerability",
						"Severity":         "CRITICAL",
						"PkgName":          "requests",
						"PkgPath":          "usr/local/lib/python3.9/site-packages/requests",
						"InstalledVersion": "2.25.0",
						"FixedVersion":     "2.28.0",
						"Status":           "fixed",
						"PrimaryURL":       "https://nvd.nist.gov/vuln/detail/CVE-2024-1234",
						"References":       []string{"https://github.com/example/issue/123"},
						"CweIDs":           []string{"CWE-78", "CWE-94"},
						"SeveritySource":   "nvd",
						"CVSS": map[string]any{
							"nvd": map[string]any{
								"V3Score":  9.8,
								"V3Vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
							},
						},
						"VendorSeverity": map[string]any{
							"nvd":    4,
							"redhat": 3,
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

	f := findings[0]

	// Check basic fields
	if f.RuleID != "CVE-2024-1234" {
		t.Fatalf("expected rule id CVE-2024-1234, got %s", f.RuleID)
	}
	if f.Severity != "critical" {
		t.Fatalf("expected severity critical, got %s", f.Severity)
	}

	// Check that location uses PkgPath when available
	if f.Location != "usr/local/lib/python3.9/site-packages/requests" {
		t.Fatalf("expected location to use pkg_path, got %s", f.Location)
	}

	// Check RawData contains extended fields
	if f.RawData == nil {
		t.Fatal("expected raw_data to be populated")
	}
	if f.RawData["installed_version"] != "2.25.0" {
		t.Fatalf("expected installed_version 2.25.0, got %v", f.RawData["installed_version"])
	}
	if f.RawData["fixed_version"] != "2.28.0" {
		t.Fatalf("expected fixed_version 2.28.0, got %v", f.RawData["fixed_version"])
	}

	// Check Evidence
	if f.Evidence == nil {
		t.Fatal("expected evidence to be populated")
	}
	if f.Evidence["installedVersion"] != "2.25.0" {
		t.Fatalf("expected evidence installedVersion, got %v", f.Evidence["installedVersion"])
	}
	if f.Evidence["fixedVersion"] != "2.28.0" {
		t.Fatalf("expected evidence fixedVersion, got %v", f.Evidence["fixedVersion"])
	}

	// Check CWE IDs are in RawData
	cweIDs, ok := f.RawData["cwe_ids"].([]string)
	if !ok || len(cweIDs) != 2 {
		t.Fatalf("expected cwe_ids with 2 items, got %v", f.RawData["cwe_ids"])
	}
}

func TestParseTrivyMisconfigurations(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": ".",
		"Results": []any{
			map[string]any{
				"Target": "Dockerfile",
				"Class":  "config",
				"Type":   "dockerfile",
				"Misconfigurations": []any{
					map[string]any{
						"Type":        "Dockerfile Security Check",
						"ID":          "DS002",
						"AVDID":       "AVD-DS-0002",
						"Title":       "Image user should not be 'root'",
						"Description": "Running as root may give unnecessary privileges",
						"Message":     "Specify at least 1 USER command in Dockerfile",
						"Severity":    "HIGH",
						"Resolution":  "Add 'USER <non root user>' line to the Dockerfile",
						"PrimaryURL":  "https://avd.aquasec.com/misconfig/ds002",
						"References":  []string{"https://docs.docker.com/develop/dev-best-practices/"},
						"Status":      "FAIL",
						"CauseMetadata": map[string]any{
							"Provider":  "dockerfile",
							"Service":   "general",
							"StartLine": 1,
							"EndLine":   10,
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

	f := findings[0]

	if f.Title != "Image user should not be 'root'" {
		t.Fatalf("unexpected title: %s", f.Title)
	}
	if f.RuleID != "DS002" {
		t.Fatalf("expected rule id DS002, got %s", f.RuleID)
	}
	if f.Severity != "high" {
		t.Fatalf("expected severity high, got %s", f.Severity)
	}
	if f.Location != "Dockerfile:1" {
		t.Fatalf("expected location Dockerfile:1, got %s", f.Location)
	}

	// Check RawData
	if f.RawData["type"] != "misconfiguration" {
		t.Fatalf("expected type misconfiguration, got %v", f.RawData["type"])
	}

	// Check Evidence
	if f.Evidence == nil {
		t.Fatal("expected evidence to be populated")
	}
	if f.Evidence["resolution"] != "Add 'USER <non root user>' line to the Dockerfile" {
		t.Fatalf("expected resolution in evidence, got %v", f.Evidence["resolution"])
	}
}

func TestParseTrivyLicenses(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "myapp",
		"Results": []any{
			map[string]any{
				"Target": "package.json",
				"Class":  "license",
				"Licenses": []any{
					map[string]any{
						"Severity":   "HIGH",
						"Category":   "restricted",
						"PkgName":    "gpl-library",
						"FilePath":   "node_modules/gpl-library/LICENSE",
						"Name":       "GPL-3.0",
						"Confidence": 0.95,
						"Link":       "https://spdx.org/licenses/GPL-3.0.html",
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

	f := findings[0]

	if f.Title != "GPL-3.0 in gpl-library" {
		t.Fatalf("unexpected title: %s", f.Title)
	}
	if f.Severity != "high" {
		t.Fatalf("expected severity high, got %s", f.Severity)
	}
	if f.Location != "node_modules/gpl-library/LICENSE" {
		t.Fatalf("expected location to be file path, got %s", f.Location)
	}
	if f.RuleID != "license-gpl-3.0" {
		t.Fatalf("expected rule id license-gpl-3.0, got %s", f.RuleID)
	}

	// Check RawData
	if f.RawData["type"] != "license" {
		t.Fatalf("expected type license, got %v", f.RawData["type"])
	}
	if f.RawData["category"] != "restricted" {
		t.Fatalf("expected category restricted, got %v", f.RawData["category"])
	}
}

func TestParseTrivySecrets(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "myapp",
		"Results": []any{
			map[string]any{
				"Target": "config/settings.py",
				"Class":  "secret",
				"Secrets": []any{
					map[string]any{
						"RuleID":    "aws-access-key-id",
						"Category":  "AWS",
						"Severity":  "CRITICAL",
						"Title":     "AWS Access Key ID",
						"StartLine": 42,
						"EndLine":   42,
						"Match":     "AKIAIOSFODNN7EXAMPLE",
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

	f := findings[0]

	if f.Title != "AWS Access Key ID" {
		t.Fatalf("unexpected title: %s", f.Title)
	}
	if f.Severity != "critical" {
		t.Fatalf("expected severity critical, got %s", f.Severity)
	}
	if f.Location != "config/settings.py:42" {
		t.Fatalf("expected location with line number, got %s", f.Location)
	}

	// Check that match is redacted in evidence
	if f.Evidence != nil {
		if match, ok := f.Evidence["match_pattern"].(string); ok {
			if match == "AKIAIOSFODNN7EXAMPLE" {
				t.Fatal("expected match to be redacted")
			}
		}
	}
}

func TestParseTrivyMixedResults(t *testing.T) {
	payload := map[string]any{
		"ArtifactName": "myapp:latest",
		"Results": []any{
			map[string]any{
				"Target": "app",
				"Vulnerabilities": []any{
					map[string]any{
						"VulnerabilityID": "CVE-2024-0001",
						"Title":           "Vuln 1",
						"Severity":        "HIGH",
						"PkgName":         "pkg1",
					},
				},
				"Secrets": []any{
					map[string]any{
						"RuleID":    "generic-api-key",
						"Title":     "Secret 1",
						"Severity":  "CRITICAL",
						"StartLine": 10,
					},
				},
			},
			map[string]any{
				"Target": "Dockerfile",
				"Misconfigurations": []any{
					map[string]any{
						"ID":       "DS001",
						"Title":    "Misconfig 1",
						"Severity": "MEDIUM",
					},
				},
			},
			map[string]any{
				"Target": "package.json",
				"Licenses": []any{
					map[string]any{
						"Name":     "MIT",
						"PkgName":  "pkg2",
						"Severity": "LOW",
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

	// Should have 4 findings: 1 vuln + 1 secret + 1 misconfig + 1 license
	if len(findings) != 4 {
		t.Fatalf("expected 4 findings, got %d", len(findings))
	}

	// Count by type
	typeCount := map[string]int{}
	for _, f := range findings {
		if f.RawData != nil {
			if t, ok := f.RawData["type"].(string); ok {
				typeCount[t]++
			}
		}
	}

	if typeCount["vulnerability"] != 1 {
		t.Fatalf("expected 1 vulnerability, got %d", typeCount["vulnerability"])
	}
	if typeCount["secret"] != 1 {
		t.Fatalf("expected 1 secret, got %d", typeCount["secret"])
	}
	if typeCount["misconfiguration"] != 1 {
		t.Fatalf("expected 1 misconfiguration, got %d", typeCount["misconfiguration"])
	}
	if typeCount["license"] != 1 {
		t.Fatalf("expected 1 license, got %d", typeCount["license"])
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

func TestParseSemgrepReportWithMetadata(t *testing.T) {
	payload := map[string]any{
		"results": []any{
			map[string]any{
				"check_id": "python.django.security.injection.sql-injection",
				"path":     "app/views.py",
				"start": map[string]any{
					"line":   42,
					"col":    10,
					"offset": 1234,
				},
				"end": map[string]any{
					"line":   42,
					"col":    50,
					"offset": 1274,
				},
				"extra": map[string]any{
					"message":     "Detected SQL injection via string concatenation",
					"severity":    "ERROR",
					"fingerprint": "abc123def456",
					"engine_kind": "OSS",
					"lines":       "query = \"SELECT * FROM users WHERE id=\" + user_id",
					"fix":         "query = \"SELECT * FROM users WHERE id=%s\", (user_id,)",
					"metadata": map[string]any{
						"category":    "security",
						"subcategory": []string{"vuln", "audit"},
						"technology":  []string{"django", "python"},
						"cwe": []string{
							"CWE-89: Improper Neutralization of Special Elements used in an SQL Command",
						},
						"owasp": []string{
							"A03:2021 - Injection",
							"A01:2017 - Injection",
						},
						"references": []string{
							"https://owasp.org/Top10/A03_2021-Injection/",
							"https://cwe.mitre.org/data/definitions/89.html",
						},
						"confidence":          "HIGH",
						"likelihood":          "HIGH",
						"impact":              "HIGH",
						"vulnerability_class": []string{"SQL Injection"},
						"license":             "MIT",
						"source":              "https://semgrep.dev/r/python.django.security.injection.sql-injection",
						"shortlink":           "https://sg.run/AbCd",
						"cwe2022-top25":       true,
					},
				},
			},
		},
		"paths": map[string]any{
			"scanned": []string{"app/views.py"},
		},
		"version": "1.56.0",
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

	f := findings[0]

	// Basic fields
	if f.RuleID != "python.django.security.injection.sql-injection" {
		t.Fatalf("expected rule id, got %s", f.RuleID)
	}
	if f.Severity != "high" {
		t.Fatalf("expected severity high (ERROR maps to high), got %s", f.Severity)
	}
	if f.Location != "app/views.py:42" {
		t.Fatalf("expected location app/views.py:42, got %s", f.Location)
	}

	// Check RawData contains metadata
	if f.RawData == nil {
		t.Fatal("expected raw_data to be populated")
	}
	if f.RawData["fingerprint"] != "abc123def456" {
		t.Fatalf("expected fingerprint in raw_data, got %v", f.RawData["fingerprint"])
	}
	if f.RawData["category"] != "security" {
		t.Fatalf("expected category security, got %v", f.RawData["category"])
	}
	if f.RawData["confidence"] != "HIGH" {
		t.Fatalf("expected confidence HIGH, got %v", f.RawData["confidence"])
	}

	// Check CWE in RawData
	cwe, ok := f.RawData["cwe"].([]string)
	if !ok || len(cwe) != 1 {
		t.Fatalf("expected cwe with 1 item, got %v", f.RawData["cwe"])
	}
	if !strings.Contains(cwe[0], "CWE-89") {
		t.Fatalf("expected CWE-89, got %s", cwe[0])
	}

	// Check OWASP in RawData
	owasp, ok := f.RawData["owasp"].([]string)
	if !ok || len(owasp) != 2 {
		t.Fatalf("expected owasp with 2 items, got %v", f.RawData["owasp"])
	}

	// Check Evidence
	if f.Evidence == nil {
		t.Fatal("expected evidence to be populated")
	}
	if f.Evidence["fix"] != "query = \"SELECT * FROM users WHERE id=%s\", (user_id,)" {
		t.Fatalf("expected fix suggestion in evidence, got %v", f.Evidence["fix"])
	}
	if f.Evidence["code"] != "query = \"SELECT * FROM users WHERE id=\" + user_id" {
		t.Fatalf("expected code snippet in evidence, got %v", f.Evidence["code"])
	}

	// Check security classification in evidence
	evidenceCwe, ok := f.Evidence["cwe"].([]string)
	if !ok || len(evidenceCwe) != 1 {
		t.Fatalf("expected cwe in evidence, got %v", f.Evidence["cwe"])
	}
	if f.Evidence["confidence"] != "HIGH" {
		t.Fatalf("expected confidence in evidence, got %v", f.Evidence["confidence"])
	}
}

func TestParseSemgrepReportWithFixRegex(t *testing.T) {
	payload := map[string]any{
		"results": []any{
			map[string]any{
				"check_id": "javascript.express.security.audit.xss.mustache-escape.template-unescaped",
				"path":     "app/templates/user.html",
				"start": map[string]any{
					"line": 15,
				},
				"extra": map[string]any{
					"message":  "Unescaped template variable",
					"severity": "WARNING",
					"fix_regex": map[string]any{
						"regex":       "\\{\\{\\{(.+?)\\}\\}\\}",
						"replacement": "{{$1}}",
						"count":       1,
					},
				},
			},
		},
		"paths": map[string]any{
			"scanned": []string{"app/templates/user.html"},
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

	f := findings[0]

	if f.Evidence == nil {
		t.Fatal("expected evidence to be populated")
	}

	fixRegex, ok := f.Evidence["fix_regex"].(map[string]any)
	if !ok {
		t.Fatalf("expected fix_regex in evidence, got %v", f.Evidence["fix_regex"])
	}
	if fixRegex["regex"] != "\\{\\{\\{(.+?)\\}\\}\\}" {
		t.Fatalf("expected fix_regex.regex, got %v", fixRegex["regex"])
	}
	if fixRegex["replacement"] != "{{$1}}" {
		t.Fatalf("expected fix_regex.replacement, got %v", fixRegex["replacement"])
	}
}

func TestParseSemgrepIgnoredFinding(t *testing.T) {
	payload := map[string]any{
		"results": []any{
			map[string]any{
				"check_id": "generic.secrets.security.detected-api-key",
				"path":     "config.py",
				"start": map[string]any{
					"line": 5,
				},
				"extra": map[string]any{
					"message":    "API key detected",
					"severity":   "ERROR",
					"is_ignored": true,
				},
			},
		},
		"paths": map[string]any{
			"scanned": []string{"config.py"},
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

	f := findings[0]

	if f.RawData == nil {
		t.Fatal("expected raw_data to be populated")
	}
	if f.RawData["is_ignored"] != true {
		t.Fatalf("expected is_ignored=true in raw_data, got %v", f.RawData["is_ignored"])
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
