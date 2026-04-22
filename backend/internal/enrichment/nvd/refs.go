package nvd

import (
	"encoding/json"
	"sort"
)

type RefCategory string

const (
	CatPatch              RefCategory = "patch"
	CatExploit            RefCategory = "exploit"
	CatMitigation         RefCategory = "mitigation"
	CatAdvisoryVendor     RefCategory = "advisory_vendor"
	CatAdvisoryThirdParty RefCategory = "advisory_third_party"
	CatReport             RefCategory = "report"
	CatOther              RefCategory = "other"
)

type Reference struct {
	URL    string   `json:"url"`
	Source string   `json:"source,omitempty"`
	Tags   []string `json:"tags,omitempty"`
}

func ClassifyReferences(raw json.RawMessage) map[RefCategory][]Reference {
	if len(raw) == 0 || string(raw) == "[]" {
		return nil
	}

	var refs []Reference
	if err := json.Unmarshal(raw, &refs); err != nil {
		return nil
	}
	if len(refs) == 0 {
		return nil
	}

	out := make(map[RefCategory][]Reference)
	for _, ref := range refs {
		if ref.URL == "" {
			continue
		}
		cat := classifyReference(ref.Tags)
		out[cat] = append(out[cat], ref)
	}
	if len(out) == 0 {
		return nil
	}

	for cat := range out {
		sort.Slice(out[cat], func(i, j int) bool {
			return out[cat][i].URL < out[cat][j].URL
		})
	}

	return out
}

func classifyReference(tags []string) RefCategory {
	if hasTag(tags, "Patch") {
		return CatPatch
	}
	if hasTag(tags, "Exploit") {
		return CatExploit
	}
	if hasTag(tags, "Mitigation") {
		return CatMitigation
	}
	if hasAnyTag(tags, "Vendor Advisory", "Release Notes", "Product") {
		return CatAdvisoryVendor
	}
	if hasAnyTag(tags, "Third Party Advisory", "VDB Entry", "US Government Resource") {
		return CatAdvisoryThirdParty
	}
	if hasAnyTag(tags,
		"Issue Tracking",
		"Mailing List",
		"Press/Media Coverage",
		"Technical Description",
		"Tool Signature",
		"Related",
	) {
		return CatReport
	}
	return CatOther
}

func hasTag(tags []string, expected string) bool {
	for _, tag := range tags {
		if tag == expected {
			return true
		}
	}
	return false
}

func hasAnyTag(tags []string, expected ...string) bool {
	for _, e := range expected {
		if hasTag(tags, e) {
			return true
		}
	}
	return false
}
