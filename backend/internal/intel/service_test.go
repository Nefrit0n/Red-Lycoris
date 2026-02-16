package intel

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"time"

	"red-lycoris/backend/internal/storage"
)

func TestShouldRefresh(t *testing.T) {
	service := &Service{refreshInterval: 24 * time.Hour}
	now := time.Now().UTC()

	if !service.ShouldRefresh(nil, now) {
		t.Fatal("expected refresh for missing status")
	}

	status := &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-2 * time.Hour), Valid: true},
		HasBDUPayload:   true,
	}
	if service.ShouldRefresh(status, now) {
		t.Fatal("expected no refresh when interval not elapsed")
	}

	status = &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-48 * time.Hour), Valid: true},
		HasBDUPayload:   true,
	}
	if !service.ShouldRefresh(status, now) {
		t.Fatal("expected refresh when interval elapsed")
	}

	status = &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-48 * time.Hour), Valid: true},
		NextRetryAt:     sql.NullTime{Time: now.Add(2 * time.Hour), Valid: true},
	}
	if service.ShouldRefresh(status, now) {
		t.Fatal("expected no refresh when next retry is in the future")
	}
}

func TestShouldRefresh_MissingBDU(t *testing.T) {
	service := &Service{refreshInterval: 24 * time.Hour, bduEnabled: true}
	now := time.Now().UTC()

	// BDU enabled but payload missing — should force refresh even if interval not elapsed.
	status := &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-2 * time.Hour), Valid: true},
		HasBDUPayload:   false,
	}
	if !service.ShouldRefresh(status, now) {
		t.Fatal("expected refresh when BDU enabled but payload missing")
	}

	// BDU enabled and payload present — normal interval logic applies.
	status = &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-2 * time.Hour), Valid: true},
		HasBDUPayload:   true,
	}
	if service.ShouldRefresh(status, now) {
		t.Fatal("expected no refresh when BDU payload already present")
	}
}

func TestDedupeReferences(t *testing.T) {
	title := "Ref"
	refs := dedupeReferences([]storage.IntelReference{
		{Title: &title, URL: "https://example.com"},
		{Title: nil, URL: "https://example.com"},
		{Title: nil, URL: "https://example.org"},
	})
	if len(refs) != 2 {
		t.Fatalf("expected 2 refs, got %d", len(refs))
	}
}

func TestEnrichCVE(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/nvd", func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.RawQuery, "cveId=CVE-2024-0001") {
			http.Error(w, "missing cveId", http.StatusBadRequest)
			return
		}
		payload := map[string]any{
			"vulnerabilities": []map[string]any{
				{
					"cve": map[string]any{
						"id": "CVE-2024-0001",
						"references": []map[string]any{
							{"url": "https://example.com/advisory", "name": "Advisory"},
						},
						"metrics": map[string]any{
							"cvssMetricV31": []map[string]any{
								{"cvssData": map[string]any{"baseScore": 9.8, "version": "3.1"}},
							},
						},
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(payload)
	})
	mux.HandleFunc("/epss", func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.RawQuery, "cve=CVE-2024-0001") {
			http.Error(w, "missing cve", http.StatusBadRequest)
			return
		}
		payload := map[string]any{
			"data": []map[string]any{
				{"epss": "0.42", "percentile": "0.88"},
			},
		}
		_ = json.NewEncoder(w).Encode(payload)
	})
	mux.HandleFunc("/kev", func(w http.ResponseWriter, r *http.Request) {
		payload := map[string]any{
			"vulnerabilities": []map[string]any{
				{"cveID": "CVE-2024-0001", "vendorProject": "Example"},
			},
		}
		_ = json.NewEncoder(w).Encode(payload)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := server.Client()
	service := &Service{
		nvd: &nvdClient{
			baseURL: server.URL + "/nvd",
			client:  client,
			sem:     make(chan struct{}, 1),
		},
		epss: &epssClient{
			baseURL: server.URL + "/epss",
			client:  client,
			sem:     make(chan struct{}, 1),
		},
		kev: &kevClient{
			url:    server.URL + "/kev",
			client: client,
			sem:    make(chan struct{}, 1),
		},
	}

	record, skipped, err := service.Enrich(context.Background(), "CVE-2024-0001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if skipped {
		t.Fatal("expected enrich not to be skipped for CVE")
	}
	if record.CVSSScore == nil || *record.CVSSScore != 9.8 {
		t.Fatalf("expected cvss score 9.8, got %+v", record.CVSSScore)
	}
	if record.EPSSScore == nil || *record.EPSSScore != 0.42 {
		t.Fatalf("expected epss score 0.42, got %+v", record.EPSSScore)
	}
	if record.EPSSPercentile == nil || *record.EPSSPercentile != 0.88 {
		t.Fatalf("expected epss percentile 0.88, got %+v", record.EPSSPercentile)
	}
	if !record.KEV {
		t.Fatal("expected kev true")
	}
	if len(record.NVDPayload) == 0 || len(record.EPSSPayload) == 0 || len(record.KEVPayload) == 0 {
		t.Fatal("expected NVD/EPSS/KEV payloads to be populated")
	}
	if len(record.BDUPayload) != 0 {
		t.Fatalf("expected empty BDU payload without local DB, got %s", string(record.BDUPayload))
	}
	if len(record.References) < 1 {
		t.Fatalf("expected references from intel providers, got %d", len(record.References))
	}
}

func TestEnrichNonCVE(t *testing.T) {
	service := &Service{}
	record, skipped, err := service.Enrich(context.Background(), "GHSA-xxxx-xxxx-xxxx")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !skipped {
		t.Fatal("expected non-CVE to be skipped")
	}
	if record.Identifier != "GHSA-xxxx-xxxx-xxxx" {
		t.Fatalf("expected identifier to be preserved, got %s", record.Identifier)
	}
}

func TestParseBDU_NormalizesExpectedFields(t *testing.T) {
	payload := []byte(`{
		"data": [{
			"cve": "CVE-2024-7777",
			"description": "<p>Example BDU entry</p>",
			"cvss_v2": {"vector": "AV:N/AC:L", "score": 5.0},
			"cvss": {"vector": "CVSS:3.1/AV:N/AC:L", "score": 8.2},
			"cvss_v4": {"vector": "CVSS:4.0/AV:N", "score": 9.1},
			"cwe": ["CWE-89"],
			"affected_software": [{"vendor": "<b>Acme</b>", "product": "DB", "version": "2.1", "type":"library", "platform": "linux"}],
			"remediation": ["<ul><li>Apply patch</li></ul>", "Rotate creds"],
			"status": "published",
			"published_at": "2024-01-10",
			"updated_at": "2024-01-12",
			"external_ids": {"cve": ["CVE-2024-7777"], "fg-ir": ["FG-IR-7777"]},
			"references": [{"url": "https://bdu.example/item/7777", "title": "BDU"}]
		}]
	}`)

	normalized, refs, found := parseBDU(payload, "CVE-2024-7777")
	if !found {
		t.Fatal("expected BDU entry to be found")
	}
	if len(normalized) == 0 {
		t.Fatal("expected normalized payload")
	}
	if len(refs) != 1 || refs[0].URL != "https://bdu.example/item/7777" {
		t.Fatalf("unexpected refs: %+v", refs)
	}

	var doc map[string]any
	if err := json.Unmarshal(normalized, &doc); err != nil {
		t.Fatalf("failed to unmarshal normalized payload: %v", err)
	}
	if doc["description"] != "Example BDU entry" {
		t.Fatalf("unexpected sanitized description: %v", doc["description"])
	}
	cvss, ok := doc["cvss"].(map[string]any)
	if !ok || cvss["v2"] == nil || cvss["v3"] == nil || cvss["v4"] == nil {
		t.Fatalf("expected cvss v2/v3/v4, got: %+v", doc["cvss"])
	}
	affected, ok := doc["affected_software"].([]any)
	if !ok || len(affected) != 1 {
		t.Fatalf("expected affected software rows, got: %+v", doc["affected_software"])
	}
	row := affected[0].(map[string]any)
	if row["vendor"] != "Acme" || row["type"] != "library" {
		t.Fatalf("unexpected affected software row: %+v", row)
	}
	steps, ok := doc["remediation_steps"].([]any)
	if !ok || len(steps) != 2 {
		t.Fatalf("expected remediation steps, got: %+v", doc["remediation_steps"])
	}
	if steps[0] != "Apply patch" {
		t.Fatalf("expected sanitized remediation step, got: %v", steps[0])
	}
}

func TestParseBDU_MatchesSpacedCVEInExternalIDs(t *testing.T) {
	payload := []byte(`{
		"items": [{
			"id": "BDU:2025-14042",
			"description": "entry",
			"external_ids": {
				"cve": ["CVE-2025 - 52565"],
				"bdu": ["BDU:2025-14042"]
			}
		}]
	}`)

	normalized, refs, found := parseBDU(payload, "CVE-2025-52565")
	if !found {
		t.Fatal("expected BDU entry to be found for spaced CVE format")
	}
	if len(normalized) == 0 {
		t.Fatal("expected normalized payload")
	}
	if len(refs) != 0 {
		t.Fatalf("expected no references, got %+v", refs)
	}
}

func TestExtractBDUVulLinks(t *testing.T) {
	html := []byte(`
		<html><body>
		  <a href="/vul/2025-14042">one</a>
		  <a href="/vul/2025-14042">dup</a>
		  <a href="/vul/2024-1">bad</a>
		  <a href="/other/2025-14042">bad2</a>
		</body></html>`)

	links := extractBDUVulLinks("https://bdu.fstec.ru", html)
	if len(links) != 1 {
		t.Fatalf("expected 1 unique link, got %d: %+v", len(links), links)
	}
	if links[0] != "https://bdu.fstec.ru/vul/2025-14042" {
		t.Fatalf("unexpected link: %s", links[0])
	}
}

func TestParseBDUHTMLPage_FindsCVEWithSpaces(t *testing.T) {
	html := []byte(`<html><body><div>Идентификаторы: CVE-2025 - 52565</div></body></html>`)

	normalized, refs, found := parseBDUHTMLPage(html, "https://bdu.fstec.ru/vul/2025-14042", "CVE-2025-52565")
	if !found {
		t.Fatal("expected cve to be matched from html page")
	}
	if len(normalized) == 0 {
		t.Fatal("expected normalized payload")
	}
	if len(refs) != 1 || refs[0].URL != "https://bdu.fstec.ru/vul/2025-14042" {
		t.Fatalf("unexpected refs: %+v", refs)
	}

	var doc map[string]any
	if err := json.Unmarshal(normalized, &doc); err != nil {
		t.Fatalf("failed to decode payload: %v", err)
	}
	ids, ok := doc["external_ids"].(map[string]any)
	if !ok {
		t.Fatalf("expected external_ids, got: %+v", doc["external_ids"])
	}
	bduValues, ok := ids["bdu"].([]any)
	if !ok || len(bduValues) != 1 || bduValues[0] != "2025-14042" {
		t.Fatalf("unexpected bdu ids: %+v", ids["bdu"])
	}
}

func TestExtractCWENumber(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"CWE-1333", "1333"},
		{"cwe-79", "79"},
		{"CWE-89", "89"},
		{"CWE-", ""},
		{"CVE-2024-0001", ""},
		{"", ""},
		{"CWE-0", "0"},
	}
	for _, tc := range tests {
		got := extractCWENumber(tc.input)
		if got != tc.want {
			t.Errorf("extractCWENumber(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestParseBDUHTMLPageGeneric(t *testing.T) {
	html := []byte(`<html><body>
		<h1>BDU:2023-04393</h1>
		<div class="vulner_desc">Test CWE vulnerability description</div>
		<div>Идентификаторы: CVE-2023-12345</div>
	</body></html>`)

	normalized, refs := parseBDUHTMLPageGeneric(html, "https://bdu.fstec.ru/vul/2023-04393")
	if normalized == nil {
		t.Fatal("expected normalized payload for generic parse")
	}
	if len(refs) != 1 || refs[0].URL != "https://bdu.fstec.ru/vul/2023-04393" {
		t.Fatalf("unexpected refs: %+v", refs)
	}

	var doc map[string]any
	if err := json.Unmarshal(normalized, &doc); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if doc["identifier"] != "BDU:2023-04393" {
		t.Fatalf("unexpected identifier: %v", doc["identifier"])
	}
	ids, ok := doc["external_ids"].(map[string]any)
	if !ok {
		t.Fatalf("expected external_ids map, got: %+v", doc["external_ids"])
	}
	bduIDs, ok := ids["bdu"].([]any)
	if !ok || len(bduIDs) != 1 || bduIDs[0] != "2023-04393" {
		t.Fatalf("unexpected bdu ids: %+v", ids["bdu"])
	}
	cveIDs, ok := ids["cve"].([]any)
	if !ok || len(cveIDs) != 1 || cveIDs[0] != "CVE-2023-12345" {
		t.Fatalf("unexpected cve ids: %+v", ids["cve"])
	}
}

func TestParseBDUHTMLPageGeneric_NoBduID(t *testing.T) {
	html := []byte(`<html><body>page</body></html>`)
	normalized, _ := parseBDUHTMLPageGeneric(html, "https://bdu.fstec.ru/other/page")
	if normalized != nil {
		t.Fatal("expected nil for non-vul URL")
	}
}

func TestEnrichCWE_BDUSearch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock init: %v", err)
	}
	defer db.Close()

	rows := sqlmock.NewRows([]string{
		"bdu_id", "name", "description", "vendor",
		"software_name", "software_version", "software_type", "os_hardware",
		"vuln_class", "detection_date",
		"cvss_v2", "cvss_v3", "cvss_v4", "severity",
		"remediation", "status", "exploit_exists", "fix_info",
		"source_urls", "other_ids", "other_info", "incident_info",
		"exploitation_method", "fix_method", "published_date", "updated_date",
		"consequences", "vuln_state", "cwe_description", "cwe_id",
	}).
		AddRow("BDU:2023-04393", "One", "Desc one", "Vendor", "SW", "1", "Type", "OS", "Class", "", "", "", "", "", "", "", "", "", "", "CVE-2023-12345", "", "", "", "", "", "", "", "", "", "CWE-1333").
		AddRow("BDU:2026-01715", "Two", "Desc two", "Vendor", "SW", "1", "Type", "OS", "Class", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "CWE-1333")

	mock.ExpectQuery("FROM bdu_identifier_map").WillReturnRows(rows)

	service := &Service{db: db, bduEnabled: true}
	record, skipped, err := service.Enrich(context.Background(), "CWE-1333")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if skipped {
		t.Fatal("expected CWE enrich not to be skipped")
	}
	if len(record.BDUPayload) == 0 {
		t.Fatal("expected BDU payload for CWE search")
	}

	var entries []json.RawMessage
	if err := json.Unmarshal(record.BDUPayload, &entries); err != nil {
		t.Fatalf("expected array BDU payload, got: %s", string(record.BDUPayload))
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 BDU entries, got %d", len(entries))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestBuildBDUSearchQuery(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"CVE-2025-31133", "(CVE AND 2025 AND 31133)"},
		{"CVE-2024-0001", "(CVE AND 2024 AND 0001)"},
		{"CWE-1333", "(CWE AND 1333)"},
		{"GHSA-fh74-hm69-rqjw", "(GHSA AND FH74 AND HM69 AND RQJW)"},
		{"single", ""},
		{"", ""},
	}
	for _, tc := range tests {
		got := buildBDUSearchQuery(tc.input)
		if got != tc.want {
			t.Errorf("buildBDUSearchQuery(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestEnrichCWE_SkippedWhenBDUDisabled(t *testing.T) {
	service := &Service{
		bdu: &bduClient{disabled: true},
	}
	record, skipped, err := service.Enrich(context.Background(), "CWE-1333")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if skipped {
		t.Fatal("expected CWE not to be marked as skipped")
	}
	if record.BDUPayload != nil {
		t.Fatal("expected nil BDU payload when disabled")
	}
}
