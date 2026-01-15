package dedup

import (
	"testing"

	"lotus-warden/backend/internal/parser"
)

func TestComputeFingerprintSameFinding(t *testing.T) {
	finding := parser.Finding{
		Title:    "SQL Injection",
		Severity: "high",
		Location: "/login",
	}
	first := ComputeFingerprint("sast", finding)
	second := ComputeFingerprint("sast", finding)
	if first != second {
		t.Fatalf("expected deterministic fingerprint, got %s and %s", first, second)
	}
}

func TestComputeFingerprintDifferentFinding(t *testing.T) {
	finding := parser.Finding{
		Title:    "SQL Injection",
		Severity: "high",
		Location: "/login",
	}
	other := parser.Finding{
		Title:    "XSS",
		Severity: "medium",
		Location: "/search",
	}
	first := ComputeFingerprint("sast", finding)
	second := ComputeFingerprint("sast", other)
	if first == second {
		t.Fatalf("expected different fingerprints, got %s", first)
	}
}

func TestComputeFingerprintPartialMatch(t *testing.T) {
	base := parser.Finding{
		Title:    "SQL Injection",
		Severity: "high",
		Location: "/login",
	}
	partial := parser.Finding{
		Title:    "SQL Injection",
		Severity: "high",
		Location: "/profile",
	}
	first := ComputeFingerprint("sast", base)
	second := ComputeFingerprint("sast", partial)
	if first == second {
		t.Fatalf("expected fingerprints to differ on location change")
	}
}
