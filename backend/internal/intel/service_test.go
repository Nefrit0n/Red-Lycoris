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

func TestEnrichCWE_SkippedWhenBDUDisabled(t *testing.T) {
	service := &Service{}
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
