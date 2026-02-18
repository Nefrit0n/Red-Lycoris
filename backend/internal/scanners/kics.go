package scanners

import (
	"encoding/json"
	"errors"
	"os/exec"
	"strings"
)

// KICSExitResult classifies a KICS process exit code.
type KICSExitResult struct {
	Success     bool   // true if the scan completed (with or without findings)
	HasFindings bool   // true if findings were reported
	MaxSeverity string // normalized severity: "critical", "high", "medium", "low", or "" if no findings
}

// ClassifyKICSExitCode maps a KICS process exit code to a scan outcome.
//
// KICS exit codes (without --ignore-on-exit):
//
//	0  — scan completed, no findings
//	20 — findings with max severity LOW
//	30 — findings with max severity MEDIUM
//	40 — findings with max severity HIGH
//	50 — findings with max severity CRITICAL
//	60 — findings present (multiple severities / --fail-on match)
//
// All other exit codes indicate engine errors (docker failure, invalid args, etc.).
func ClassifyKICSExitCode(exitCode int) KICSExitResult {
	switch exitCode {
	case 0:
		return KICSExitResult{Success: true}
	case 20:
		return KICSExitResult{Success: true, HasFindings: true, MaxSeverity: "low"}
	case 30:
		return KICSExitResult{Success: true, HasFindings: true, MaxSeverity: "medium"}
	case 40:
		return KICSExitResult{Success: true, HasFindings: true, MaxSeverity: "high"}
	case 50:
		return KICSExitResult{Success: true, HasFindings: true, MaxSeverity: "critical"}
	case 60:
		return KICSExitResult{Success: true, HasFindings: true, MaxSeverity: "critical"}
	default:
		return KICSExitResult{Success: false}
	}
}

// IsKICSFindingsExitCode returns true if the exit code corresponds to
// KICS findings (not an engine error).
func IsKICSFindingsExitCode(exitCode int) bool {
	return ClassifyKICSExitCode(exitCode).Success
}

// exitCodeFromError extracts the process exit code from an exec error.
// Returns 0 if err is nil, -1 if the exit code cannot be determined.
func exitCodeFromError(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitCode()
	}
	return -1
}

// KICSScanSummary holds summary statistics extracted from a KICS JSON report.
type KICSScanSummary struct {
	ResultCount    int            `json:"result_count"`
	MaxSeverity    string         `json:"max_severity"`
	SeverityCounts map[string]int `json:"severity_counts"`
}

// ExtractKICSSummary parses a KICS native JSON report and returns summary statistics.
// Returns nil without error if the data is not a valid KICS report.
func ExtractKICSSummary(data []byte) (*KICSScanSummary, error) {
	if !json.Valid(data) {
		return nil, nil
	}

	var report struct {
		SeverityCounters map[string]int  `json:"severity_counters"`
		TotalCounter     int             `json:"total_counter"`
		Queries          json.RawMessage `json:"queries"`
	}
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, nil
	}
	// Require "queries" key to confirm this is a KICS report
	if report.Queries == nil {
		return nil, nil
	}

	summary := &KICSScanSummary{
		ResultCount:    report.TotalCounter,
		SeverityCounts: report.SeverityCounters,
	}

	// Determine max severity by priority order
	severityOrder := []string{"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}
	for _, sev := range severityOrder {
		if count, ok := report.SeverityCounters[sev]; ok && count > 0 {
			summary.MaxSeverity = strings.ToLower(sev)
			break
		}
	}

	return summary, nil
}
