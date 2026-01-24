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

	"lotus-warden/backend/internal/storage"
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
		t.Fatal("expected payloads to be populated")
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
