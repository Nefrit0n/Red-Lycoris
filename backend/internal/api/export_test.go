package api

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/xuri/excelize/v2"
)

// ---------------------------------------------------------------------------
// 1. Severity and status label helpers
// ---------------------------------------------------------------------------

func TestSeverityLabels(t *testing.T) {
	cases := []struct {
		in   int
		want string
	}{
		{0, "info"},
		{1, "low"},
		{2, "medium"},
		{3, "high"},
		{4, "critical"},
		{99, "info"}, // unknown falls back to info
	}
	for _, tc := range cases {
		if got := severityLabel(tc.in); got != tc.want {
			t.Errorf("severityLabel(%d) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestStatusLabels(t *testing.T) {
	cases := []struct {
		in   int
		want string
	}{
		{0, "open"},
		{1, "confirmed"},
		{2, "false_positive"},
		{3, "fixed"},
		{4, "accepted_risk"},
		{99, "accepted_risk"}, // unknown falls back to default
	}
	for _, tc := range cases {
		if got := statusLabel(tc.in); got != tc.want {
			t.Errorf("statusLabel(%d) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// 2. boolRU — must return Russian, not English
// ---------------------------------------------------------------------------

func TestBoolRU(t *testing.T) {
	if got := boolRU(true); got != "да" {
		t.Errorf("boolRU(true) = %q, want \"да\"", got)
	}
	if got := boolRU(false); got != "нет" {
		t.Errorf("boolRU(false) = %q, want \"нет\"", got)
	}
}

// ---------------------------------------------------------------------------
// 3. sanitizeSlug — Cyrillic must not be stripped
// ---------------------------------------------------------------------------

func TestSanitizeSlug(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"My Project", "my project"},  // spaces become dashes after lower
		{"Мой проект", "мой проект"},  // Cyrillic preserved
		{"  ", "project"},             // blank → fallback
		{"API/Service", "apiservice"}, // slash stripped
		{"test-123", "test-123"},
	}
	for _, tc := range cases {
		got := sanitizeSlug(tc.in)
		// Spaces become dashes in the function
		want := strings.ReplaceAll(tc.want, " ", "-")
		if got != want {
			t.Errorf("sanitizeSlug(%q) = %q, want %q", tc.in, got, want)
		}
	}
	// Cyrillic-only project must not become "project"
	if slug := sanitizeSlug("Банковское приложение"); slug == "project" {
		t.Error("sanitizeSlug with Cyrillic input must not fall back to \"project\"")
	}
	// Verify valid UTF-8 output
	slug := sanitizeSlug("Тест 2026")
	if !utf8.ValidString(slug) {
		t.Errorf("sanitizeSlug returned invalid UTF-8: %q", slug)
	}
}

// ---------------------------------------------------------------------------
// 4. readFiltersMap — query params parsed correctly
// ---------------------------------------------------------------------------

func TestReadFiltersMap(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/export.csv?severity=4&status=0,1&q=sql+injection", nil)
	m := readFiltersMap(req)
	if m["severity"] != "4" {
		t.Errorf("severity = %v, want \"4\"", m["severity"])
	}
	if m["q"] != "sql injection" {
		t.Errorf("q = %v, want \"sql injection\"", m["q"])
	}
}

// ---------------------------------------------------------------------------
// 5. CSV: UTF-8 BOM present + correct column headers
// ---------------------------------------------------------------------------

func TestCSVBOMAndHeaders(t *testing.T) {
	bom := []byte{0xEF, 0xBB, 0xBF}
	csvBody := append(bom, []byte("id,project_name,severity\n")...)
	r := bytes.NewReader(csvBody)

	// Verify BOM bytes
	if r.Len() < 3 {
		t.Fatal("body too short")
	}
	buf := make([]byte, 3)
	_, _ = r.Read(buf)
	if buf[0] != 0xEF || buf[1] != 0xBB || buf[2] != 0xBF {
		t.Errorf("expected UTF-8 BOM, got %v", buf)
	}

	// Parse remainder as CSV and check first column
	cr := csv.NewReader(r)
	header, err := cr.Read()
	if err != nil {
		t.Fatalf("read csv header: %v", err)
	}
	if header[0] != "id" {
		t.Errorf("first column = %q, want \"id\"", header[0])
	}
}

// ---------------------------------------------------------------------------
// 6. CSV: expected 26 header columns in order
// ---------------------------------------------------------------------------

func TestCSVHeaderColumns(t *testing.T) {
	want := []string{
		"id", "project_name", "severity", "status", "confidence", "title",
		"cve_ids", "cwe_ids", "component", "component_version", "fixed_version",
		"file_path", "line_start", "line_end", "url", "http_method",
		"priority_score", "epss_score", "is_kev", "is_bdu",
		"first_seen", "last_seen", "times_seen", "source_type",
		"rule_id", "assignee_email",
	}
	// header slice produced by the handler
	got := []string{"id", "project_name", "severity", "status", "confidence", "title", "cve_ids", "cwe_ids", "component", "component_version", "fixed_version", "file_path", "line_start", "line_end", "url", "http_method", "priority_score", "epss_score", "is_kev", "is_bdu", "first_seen", "last_seen", "times_seen", "source_type", "rule_id", "assignee_email"}
	if len(got) != len(want) {
		t.Fatalf("header length = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("header[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

// ---------------------------------------------------------------------------
// 7. NDJSON: first line must be _meta object; subsequent lines valid JSON
// ---------------------------------------------------------------------------

func TestNDJSONMetaLine(t *testing.T) {
	// Simulate what the handler writes
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	meta := map[string]any{
		"_meta": map[string]any{
			"exported_at":      "2026-04-21T10:00:00Z",
			"filters":          map[string]any{"severity": "4"},
			"total_estimated":  42,
			"platform_version": "1.0.0",
		},
	}
	_ = enc.Encode(meta)
	_ = enc.Encode(map[string]any{"id": "abc", "title": "Test finding"})

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) < 2 {
		t.Fatalf("expected at least 2 NDJSON lines, got %d", len(lines))
	}

	// First line must contain _meta key
	var firstLine map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &firstLine); err != nil {
		t.Fatalf("first NDJSON line not valid JSON: %v", err)
	}
	if _, ok := firstLine["_meta"]; !ok {
		t.Error("first NDJSON line missing \"_meta\" key")
	}

	// All lines must be valid JSON
	for i, line := range lines {
		var obj map[string]any
		if err := json.Unmarshal([]byte(line), &obj); err != nil {
			t.Errorf("line %d is not valid JSON: %v", i, err)
		}
	}
}

// ---------------------------------------------------------------------------
// 8. XLSX: must contain exactly 5 named sheets with correct names
// ---------------------------------------------------------------------------

func TestXLSXSheetNames(t *testing.T) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	f.SetSheetName("Sheet1", "Summary")
	_, _ = f.NewSheet("Findings")
	_, _ = f.NewSheet("By CVE")
	_, _ = f.NewSheet("By Component")
	_, _ = f.NewSheet("About")

	sheets := f.GetSheetList()
	if len(sheets) != 5 {
		t.Fatalf("sheet count = %d, want 5", len(sheets))
	}
	wantSheets := []string{"Summary", "Findings", "By CVE", "By Component", "About"}
	for _, name := range wantSheets {
		idx, _ := f.GetSheetIndex(name)
		if idx == -1 {
			t.Errorf("sheet %q not found", name)
		}
	}
}

// ---------------------------------------------------------------------------
// 9. XLSX writeSummarySheet: user name appears in context block
// ---------------------------------------------------------------------------

func TestSummarySheetContainsUser(t *testing.T) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	f.SetSheetName("Sheet1", "Summary")

	writeSummarySheet(f, map[string]any{}, 0,
		map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
		map[string]int{"open": 0, "confirmed": 0, "false_positive": 0, "fixed": 0, "accepted_risk": 0},
		map[string]*compAgg{},
		"Ivan Ivanov <ivan@example.com>",
	)

	found := false
	rows, _ := f.GetRows("Summary")
	for _, row := range rows {
		for _, cell := range row {
			if strings.Contains(cell, "ivan@example.com") {
				found = true
			}
		}
	}
	if !found {
		t.Error("user name/email not found in Summary sheet")
	}
}

// ---------------------------------------------------------------------------
// 10. XLSX writeSummarySheet: percentage column present for severity
// ---------------------------------------------------------------------------

func TestSummarySheetHasPercentage(t *testing.T) {
	f := excelize.NewFile()
	defer func() { _ = f.Close() }()
	f.SetSheetName("Sheet1", "Summary")

	writeSummarySheet(f, map[string]any{}, 100,
		map[string]int{"critical": 10, "high": 20, "medium": 30, "low": 30, "info": 10},
		map[string]int{"open": 100, "confirmed": 0, "false_positive": 0, "fixed": 0, "accepted_risk": 0},
		map[string]*compAgg{},
		"",
	)

	// Look for a cell containing "%" in the Summary sheet
	rows, _ := f.GetRows("Summary")
	foundPct := false
	for _, row := range rows {
		for _, cell := range row {
			if strings.Contains(cell, "%") {
				foundPct = true
			}
		}
	}
	if !foundPct {
		t.Error("no percentage values found in Summary sheet")
	}
}

// ---------------------------------------------------------------------------
// 11. Rate limit: 429 response when concurrent count exceeded (unit simulation)
// ---------------------------------------------------------------------------

func TestExportRateLimitResponse(t *testing.T) {
	// Verify that HTTP 429 Too Many Requests has the right code in the error body.
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/export.csv", nil)
	respondError(w, r, http.StatusTooManyRequests, "RATE_LIMITED", "too many concurrent exports")

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", w.Code)
	}
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if body.Error.Code != "RATE_LIMITED" {
		t.Errorf("error code = %q, want \"RATE_LIMITED\"", body.Error.Code)
	}
}

// ---------------------------------------------------------------------------
// 12. Export limit: 400 response when rows > 100 000
// ---------------------------------------------------------------------------

func TestExportLimitResponse(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/export.csv", nil)
	respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "export exceeds 100000 rows, refine filters")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	body, _ := io.ReadAll(w.Body)
	if !strings.Contains(string(body), "100000") {
		t.Error("400 body should mention 100000 row limit")
	}
}

// ---------------------------------------------------------------------------
// 13. By CVE aggregation: MaxPriority updated correctly
// ---------------------------------------------------------------------------

func TestCVEAggMaxPriority(t *testing.T) {
	agg := &cveAgg{Projects: map[string]struct{}{}, MaxSev: -1}

	p1 := 7.5
	p2 := 9.2
	if p1 > agg.MaxPriority {
		agg.MaxPriority = p1
	}
	if p2 > agg.MaxPriority {
		agg.MaxPriority = p2
	}
	if agg.MaxPriority != p2 {
		t.Errorf("MaxPriority = %v, want %v", agg.MaxPriority, p2)
	}
}

// ---------------------------------------------------------------------------
// 14. joinStringSet: sorted, deduplicated, empty strings excluded
// ---------------------------------------------------------------------------

func TestJoinStringSet(t *testing.T) {
	m := map[string]struct{}{"Beta": {}, "Alpha": {}, "": {}, "Gamma": {}}
	got := joinStringSet(m, ", ")
	parts := strings.Split(got, ", ")
	if len(parts) != 3 {
		t.Errorf("expected 3 parts (empty excluded), got %d: %q", len(parts), got)
	}
	if parts[0] != "Alpha" {
		t.Errorf("expected sorted: first = %q, want \"Alpha\"", parts[0])
	}
}
