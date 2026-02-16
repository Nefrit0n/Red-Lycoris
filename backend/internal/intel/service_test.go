package intel

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
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
	}
	if service.ShouldRefresh(status, now) {
		t.Fatal("expected no refresh when interval not elapsed")
	}

	status = &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-48 * time.Hour), Valid: true},
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
	mux.HandleFunc("/bdu", func(w http.ResponseWriter, r *http.Request) {
		payload := map[string]any{
			"data": []map[string]any{
				{
					"cve":               "CVE-2024-0001",
					"description":       "BDU description",
					"cvss":              map[string]any{"vector": "CVSS:3.1/AV:N", "score": 9.8},
					"cwe":               []string{"CWE-79"},
					"affected_software": []map[string]any{{"vendor": "Acme", "product": "Widget", "version": "1.0", "platform": "linux"}},
					"remediation":       []string{"Upgrade to 1.0.1"},
					"status":            "published",
					"published_at":      "2024-01-01",
					"updated_at":        "2024-01-02",
					"external_ids":      map[string]any{"cve": []string{"CVE-2024-0001"}, "bdu": "BDU:2024-0001"},
					"references":        []map[string]any{{"url": "https://bdu.example/vuln/CVE-2024-0001", "title": "BDU"}},
				},
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
		bdu: &bduClient{
			url:    server.URL + "/bdu",
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
	if len(record.NVDPayload) == 0 || len(record.EPSSPayload) == 0 || len(record.KEVPayload) == 0 || len(record.BDUPayload) == 0 {
		t.Fatal("expected payloads to be populated")
	}
	if !strings.Contains(string(record.BDUPayload), "BDU description") {
		t.Fatalf("expected normalized bdu payload, got %s", string(record.BDUPayload))
	}
	if len(record.References) < 2 {
		t.Fatalf("expected aggregated references including bdu, got %d", len(record.References))
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
	mux := http.NewServeMux()

	// BDU search page returns links to vulnerability pages.
	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		if !strings.Contains(q, "CWE") || !strings.Contains(q, "1333") {
			http.Error(w, "unexpected query", http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`<html><body>
			<a href="/vul/2023-04393">BDU:2023-04393</a>
			<a href="/vul/2026-01715">BDU:2026-01715</a>
		</body></html>`))
	})

	// Individual vulnerability pages.
	mux.HandleFunc("/vul/2023-04393", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html><body>
			<div class="vulner_desc">ReDoS vulnerability from CWE-1333</div>
			<div>CVE-2023-12345</div>
		</body></html>`))
	})
	mux.HandleFunc("/vul/2026-01715", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html><body>
			<div class="vulner_desc">Another CWE-1333 related vuln</div>
		</body></html>`))
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	client := server.Client()
	service := &Service{
		nvd:  &nvdClient{baseURL: server.URL + "/nvd", client: client, sem: make(chan struct{}, 1)},
		epss: &epssClient{baseURL: server.URL + "/epss", disabled: true, client: client, sem: make(chan struct{}, 1)},
		kev:  &kevClient{url: server.URL + "/kev", client: client, sem: make(chan struct{}, 1)},
		bdu: &bduClient{
			url:    server.URL + "/bdu?cve={cve}",
			client: client,
			sem:    make(chan struct{}, 1),
		},
	}

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

	// BDU payload should be a JSON array.
	var entries []json.RawMessage
	if err := json.Unmarshal(record.BDUPayload, &entries); err != nil {
		t.Fatalf("expected array BDU payload, got: %s", string(record.BDUPayload))
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 BDU entries, got %d", len(entries))
	}

	// NVD/EPSS/KEV should be empty for CWE.
	if record.NVDPayload != nil {
		t.Fatal("expected nil NVD for CWE")
	}
	if record.EPSSPayload != nil {
		t.Fatal("expected nil EPSS for CWE")
	}
	if record.KEVPayload != nil {
		t.Fatal("expected nil KEV for CWE")
	}

	// References should include BDU links.
	if len(record.References) < 2 {
		t.Fatalf("expected at least 2 references, got %d", len(record.References))
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
