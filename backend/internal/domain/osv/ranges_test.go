package osv

import (
	"encoding/json"
	"testing"
)

func TestParseRanges_EmptyRaw(t *testing.T) {
	summary, err := ParseRanges(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.HasFix {
		t.Fatalf("expected HasFix false")
	}
	if len(summary.FixedVersions) != 0 || len(summary.IntroducedVersions) != 0 || len(summary.Ranges) != 0 {
		t.Fatalf("expected empty summary, got %#v", summary)
	}
}

func TestParseRanges_NullRaw(t *testing.T) {
	summary, err := ParseRanges(json.RawMessage("null"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.HasFix || len(summary.Ranges) != 0 {
		t.Fatalf("expected empty summary, got %#v", summary)
	}
}

func TestParseRanges_IntroducedAndFixed(t *testing.T) {
	raw := json.RawMessage(`[{"type":"SEMVER","events":[{"introduced":"0.2.0"},{"fixed":"8.0.0"}]}]`)
	summary, err := ParseRanges(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !summary.HasFix {
		t.Fatalf("expected HasFix true")
	}
	if len(summary.FixedVersions) != 1 || summary.FixedVersions[0] != "8.0.0" {
		t.Fatalf("unexpected fixed versions: %#v", summary.FixedVersions)
	}
	if len(summary.IntroducedVersions) != 1 || summary.IntroducedVersions[0] != "0.2.0" {
		t.Fatalf("unexpected introduced versions: %#v", summary.IntroducedVersions)
	}
	if len(summary.Ranges) != 1 || summary.Ranges[0].FixedIn != "8.0.0" {
		t.Fatalf("unexpected ranges: %#v", summary.Ranges)
	}
}

func TestParseRanges_MultipleFixedVersions(t *testing.T) {
	raw := json.RawMessage(`[
		{"type":"SEMVER","events":[{"introduced":"1.0.0"},{"fixed":"2.0.0"}]},
		{"type":"SEMVER","events":[{"introduced":"3.0.0"},{"fixed":"4.0.0"}]}
	]`)
	summary, err := ParseRanges(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(summary.FixedVersions) != 2 {
		t.Fatalf("expected 2 fixed versions, got %#v", summary.FixedVersions)
	}
}

func TestParseRanges_IntroducedZeroSkipped(t *testing.T) {
	raw := json.RawMessage(`[{"type":"SEMVER","events":[{"introduced":"0"},{"fixed":"1.2.3"}]}]`)
	summary, err := ParseRanges(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(summary.IntroducedVersions) != 0 {
		t.Fatalf("expected introduced version sentinel to be skipped, got %#v", summary.IntroducedVersions)
	}
}

func TestParseRanges_LastAffectedWithoutFix(t *testing.T) {
	raw := json.RawMessage(`[{"type":"SEMVER","events":[{"introduced":"1.0.0"},{"last_affected":"1.9.9"}]}]`)
	summary, err := ParseRanges(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.HasFix || len(summary.FixedVersions) != 0 {
		t.Fatalf("expected no fix, got %#v", summary)
	}
	if len(summary.Ranges) != 1 || summary.Ranges[0].LastAffected != "1.9.9" {
		t.Fatalf("unexpected ranges: %#v", summary.Ranges)
	}
}

func TestParseRanges_DuplicateFixedVersionsUnique(t *testing.T) {
	raw := json.RawMessage(`[
		{"type":"SEMVER","events":[{"fixed":"8.0.0"}]},
		{"type":"SEMVER","events":[{"fixed":"8.0.0"}]}
	]`)
	summary, err := ParseRanges(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(summary.FixedVersions) != 1 || summary.FixedVersions[0] != "8.0.0" {
		t.Fatalf("expected unique fixed version, got %#v", summary.FixedVersions)
	}
}
