package nvd

import (
	"encoding/json"
	"testing"
)

func TestClassifyReferencesPriority(t *testing.T) {
	raw := json.RawMessage(`[
		{"url":"https://a.example","tags":["Patch","Vendor Advisory"]},
		{"url":"https://b.example","tags":["Mitigation","Patch"]}
	]`)

	got := ClassifyReferences(raw)
	if len(got[CatPatch]) != 2 {
		t.Fatalf("expected 2 patch refs, got %d", len(got[CatPatch]))
	}
	if len(got[CatAdvisoryVendor]) != 0 || len(got[CatMitigation]) != 0 {
		t.Fatalf("priority failed: %#v", got)
	}
}

func TestClassifyReferencesEmptyInput(t *testing.T) {
	if got := ClassifyReferences(nil); got != nil {
		t.Fatalf("expected nil for nil input")
	}
	if got := ClassifyReferences(json.RawMessage(`[]`)); got != nil {
		t.Fatalf("expected nil for []")
	}
}

func TestClassifyReferencesInvalidJSON(t *testing.T) {
	if got := ClassifyReferences(json.RawMessage(`{`)); got != nil {
		t.Fatalf("expected nil for invalid json")
	}
}

func TestClassifyReferencesSkipsEmptyURLAndNoTagsToOther(t *testing.T) {
	raw := json.RawMessage(`[
		{"url":"","tags":["Patch"]},
		{"url":"https://x.example"}
	]`)

	got := ClassifyReferences(raw)
	if got == nil {
		t.Fatalf("expected non-nil map")
	}
	if len(got[CatPatch]) != 0 {
		t.Fatalf("expected empty patch category")
	}
	if len(got[CatOther]) != 1 {
		t.Fatalf("expected one other ref, got %d", len(got[CatOther]))
	}
}

func TestClassifyReferencesSortedByURL(t *testing.T) {
	raw := json.RawMessage(`[
		{"url":"https://z.example","tags":["Report"]},
		{"url":"https://a.example","tags":["Related"]}
	]`)
	got := ClassifyReferences(raw)
	if got[CatReport][0].URL != "https://a.example" {
		t.Fatalf("expected sorted URLs, got %#v", got[CatReport])
	}
}
