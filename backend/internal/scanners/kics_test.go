package scanners

import (
	"encoding/json"
	"testing"
)

func TestClassifyKICSExitCode(t *testing.T) {
	tests := []struct {
		name         string
		exitCode     int
		wantSuccess  bool
		wantFindings bool
		wantSeverity string
	}{
		{name: "exit 0 — no findings", exitCode: 0, wantSuccess: true, wantFindings: false, wantSeverity: ""},
		{name: "exit 20 — LOW findings", exitCode: 20, wantSuccess: true, wantFindings: true, wantSeverity: "low"},
		{name: "exit 30 — MEDIUM findings", exitCode: 30, wantSuccess: true, wantFindings: true, wantSeverity: "medium"},
		{name: "exit 40 — HIGH findings", exitCode: 40, wantSuccess: true, wantFindings: true, wantSeverity: "high"},
		{name: "exit 50 — CRITICAL findings", exitCode: 50, wantSuccess: true, wantFindings: true, wantSeverity: "critical"},
		{name: "exit 60 — mixed/fail-on findings", exitCode: 60, wantSuccess: true, wantFindings: true, wantSeverity: "critical"},
		{name: "exit 1 — engine error", exitCode: 1, wantSuccess: false, wantFindings: false, wantSeverity: ""},
		{name: "exit 2 — engine error", exitCode: 2, wantSuccess: false, wantFindings: false, wantSeverity: ""},
		{name: "exit 126 — permission denied", exitCode: 126, wantSuccess: false, wantFindings: false, wantSeverity: ""},
		{name: "exit 127 — command not found", exitCode: 127, wantSuccess: false, wantFindings: false, wantSeverity: ""},
		{name: "exit -1 — unknown", exitCode: -1, wantSuccess: false, wantFindings: false, wantSeverity: ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := ClassifyKICSExitCode(tc.exitCode)
			if result.Success != tc.wantSuccess {
				t.Errorf("ClassifyKICSExitCode(%d).Success = %v, want %v", tc.exitCode, result.Success, tc.wantSuccess)
			}
			if result.HasFindings != tc.wantFindings {
				t.Errorf("ClassifyKICSExitCode(%d).HasFindings = %v, want %v", tc.exitCode, result.HasFindings, tc.wantFindings)
			}
			if result.MaxSeverity != tc.wantSeverity {
				t.Errorf("ClassifyKICSExitCode(%d).MaxSeverity = %q, want %q", tc.exitCode, result.MaxSeverity, tc.wantSeverity)
			}
		})
	}
}

func TestIsKICSFindingsExitCode(t *testing.T) {
	// All finding-related codes should return true
	for _, code := range []int{0, 20, 30, 40, 50, 60} {
		if !IsKICSFindingsExitCode(code) {
			t.Errorf("IsKICSFindingsExitCode(%d) = false, want true", code)
		}
	}
	// Engine error codes should return false
	for _, code := range []int{1, 2, 10, 125, 126, 127, 255} {
		if IsKICSFindingsExitCode(code) {
			t.Errorf("IsKICSFindingsExitCode(%d) = true, want false", code)
		}
	}
}

func TestExitCodeFromError(t *testing.T) {
	if got := exitCodeFromError(nil); got != 0 {
		t.Errorf("exitCodeFromError(nil) = %d, want 0", got)
	}

	// Non-ExitError should return -1
	var dummy int
	if got := exitCodeFromError(json.Unmarshal([]byte("invalid"), &dummy)); got != -1 {
		t.Errorf("exitCodeFromError(non-exec-error) = %d, want -1", got)
	}
}

func TestExtractKICSSummary(t *testing.T) {
	t.Run("valid KICS report with findings", func(t *testing.T) {
		report := map[string]any{
			"kics_version":  "1.7.0",
			"total_counter": 5,
			"files_scanned": 10,
			"severity_counters": map[string]int{
				"CRITICAL": 0,
				"HIGH":     2,
				"MEDIUM":   1,
				"LOW":      2,
				"INFO":     0,
			},
			"queries": []any{},
		}
		data, _ := json.Marshal(report)

		summary, err := ExtractKICSSummary(data)
		if err != nil {
			t.Fatalf("ExtractKICSSummary() error: %v", err)
		}
		if summary == nil {
			t.Fatal("ExtractKICSSummary() returned nil summary")
		}
		if summary.ResultCount != 5 {
			t.Errorf("ResultCount = %d, want 5", summary.ResultCount)
		}
		if summary.MaxSeverity != "high" {
			t.Errorf("MaxSeverity = %q, want %q", summary.MaxSeverity, "high")
		}
		if summary.SeverityCounts["HIGH"] != 2 {
			t.Errorf("SeverityCounts[HIGH] = %d, want 2", summary.SeverityCounts["HIGH"])
		}
	})

	t.Run("valid KICS report with no findings", func(t *testing.T) {
		report := map[string]any{
			"kics_version":  "1.7.0",
			"total_counter": 0,
			"files_scanned": 3,
			"severity_counters": map[string]int{
				"CRITICAL": 0,
				"HIGH":     0,
				"MEDIUM":   0,
				"LOW":      0,
				"INFO":     0,
			},
			"queries": []any{},
		}
		data, _ := json.Marshal(report)

		summary, err := ExtractKICSSummary(data)
		if err != nil {
			t.Fatalf("ExtractKICSSummary() error: %v", err)
		}
		if summary == nil {
			t.Fatal("ExtractKICSSummary() returned nil summary")
		}
		if summary.ResultCount != 0 {
			t.Errorf("ResultCount = %d, want 0", summary.ResultCount)
		}
		if summary.MaxSeverity != "" {
			t.Errorf("MaxSeverity = %q, want empty", summary.MaxSeverity)
		}
	})

	t.Run("valid KICS report with only CRITICAL", func(t *testing.T) {
		report := map[string]any{
			"kics_version":  "2.0.0",
			"total_counter": 1,
			"severity_counters": map[string]int{
				"CRITICAL": 1,
				"HIGH":     0,
				"MEDIUM":   0,
				"LOW":      0,
				"INFO":     0,
			},
			"queries": []any{},
		}
		data, _ := json.Marshal(report)

		summary, err := ExtractKICSSummary(data)
		if err != nil {
			t.Fatalf("ExtractKICSSummary() error: %v", err)
		}
		if summary == nil {
			t.Fatal("ExtractKICSSummary() returned nil")
		}
		if summary.MaxSeverity != "critical" {
			t.Errorf("MaxSeverity = %q, want %q", summary.MaxSeverity, "critical")
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		summary, err := ExtractKICSSummary([]byte("not json"))
		if err != nil {
			t.Fatalf("expected nil error for invalid JSON, got: %v", err)
		}
		if summary != nil {
			t.Errorf("expected nil summary for invalid JSON, got: %+v", summary)
		}
	})

	t.Run("non-KICS JSON (no queries key)", func(t *testing.T) {
		data, _ := json.Marshal(map[string]any{"results": []any{}})

		summary, err := ExtractKICSSummary(data)
		if err != nil {
			t.Fatalf("expected nil error, got: %v", err)
		}
		if summary != nil {
			t.Errorf("expected nil summary for non-KICS JSON, got: %+v", summary)
		}
	})

	t.Run("empty data", func(t *testing.T) {
		summary, err := ExtractKICSSummary([]byte{})
		if err != nil {
			t.Fatalf("expected nil error, got: %v", err)
		}
		if summary != nil {
			t.Errorf("expected nil summary for empty data, got: %+v", summary)
		}
	})
}

func TestExtractKICSSummaryFromFixture(t *testing.T) {
	// Mirrors the structure from docs/template/kics.json
	fixture := `{
		"kics_version": "1.7.0",
		"files_scanned": 5,
		"lines_scanned": 250,
		"total_counter": 2,
		"severity_counters": {
			"CRITICAL": 0,
			"HIGH": 1,
			"INFO": 0,
			"LOW": 1,
			"MEDIUM": 0,
			"TRACE": 0
		},
		"queries": [
			{
				"query_name": "S3 Bucket Without Server-side-encryption",
				"query_id": "5a2a7640-7f75-4088-9c2d-5b0f3e3e3f3e",
				"severity": "HIGH",
				"files": [{"file_name": "main.tf", "line": 15}]
			}
		]
	}`

	summary, err := ExtractKICSSummary([]byte(fixture))
	if err != nil {
		t.Fatalf("ExtractKICSSummary() error: %v", err)
	}
	if summary == nil {
		t.Fatal("ExtractKICSSummary() returned nil")
	}
	if summary.ResultCount != 2 {
		t.Errorf("ResultCount = %d, want 2", summary.ResultCount)
	}
	if summary.MaxSeverity != "high" {
		t.Errorf("MaxSeverity = %q, want %q", summary.MaxSeverity, "high")
	}
	if summary.SeverityCounts["HIGH"] != 1 {
		t.Errorf("SeverityCounts[HIGH] = %d, want 1", summary.SeverityCounts["HIGH"])
	}
	if summary.SeverityCounts["LOW"] != 1 {
		t.Errorf("SeverityCounts[LOW] = %d, want 1", summary.SeverityCounts["LOW"])
	}
}
