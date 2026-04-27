package nvd

import (
	"encoding/json"
	"testing"
)

func testFixture() json.RawMessage {
	return json.RawMessage(`[
	  {
	    "operator":"OR",
	    "nodes":[
	      {
	        "operator":"OR",
	        "cpeMatch":[
	          {
	            "vulnerable": true,
	            "criteria":"cpe:2.3:a:vendor:lodash:*:*:*:*:*:*:*:*",
	            "versionStartIncluding":"0.2.0",
	            "versionEndExcluding":"8.0.0"
	          }
	        ]
	      }
	    ]
	  }
	]`)
}

func TestMatchCPEBasicCases(t *testing.T) {
	if got := MatchCPE("lodash", "1.0.0", nil); got.Verdict != "unknown" {
		t.Fatalf("expected unknown for empty raw, got %+v", got)
	}
	if got := MatchCPE("", "1.0.0", testFixture()); got.Verdict != "unknown" {
		t.Fatalf("expected unknown for empty component, got %+v", got)
	}
	if got := MatchCPE("express", "1.0.0", testFixture()); got.Verdict != "unknown" {
		t.Fatalf("expected unknown for non-matching product, got %+v", got)
	}
}

func TestMatchCPERanges(t *testing.T) {
	fixture := testFixture()

	affected := MatchCPE("lodash", "1.0.0", fixture)
	if affected.Verdict != "affected" {
		t.Fatalf("expected affected, got %+v", affected)
	}

	startBoundary := MatchCPE("lodash", "0.2.0", fixture)
	if startBoundary.Verdict != "affected" {
		t.Fatalf("expected affected at inclusive start, got %+v", startBoundary)
	}

	endBoundary := MatchCPE("lodash", "8.0.0", fixture)
	if endBoundary.Verdict != "not_affected" {
		t.Fatalf("expected not_affected at exclusive end, got %+v", endBoundary)
	}

	below := MatchCPE("lodash", "0.1.0", fixture)
	if below.Verdict != "not_affected" {
		t.Fatalf("expected not_affected below range, got %+v", below)
	}

	above := MatchCPE("lodash", "9.0.0", fixture)
	if above.Verdict != "not_affected" {
		t.Fatalf("expected not_affected above range, got %+v", above)
	}
}

func TestMatchCPEVersionNormalization(t *testing.T) {
	fixture := testFixture()
	if got := MatchCPE("lodash", "v1.2.3", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected for v-prefixed version, got %+v", got)
	}
	if got := MatchCPE("lodash", "1.2.3-rc1", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected for pre-release suffix, got %+v", got)
	}
}

func TestMatchCPEGarbageVersionUnknown(t *testing.T) {
	if got := MatchCPE("lodash", "garbage!", testFixture()); got.Verdict != "unknown" {
		t.Fatalf("expected unknown for garbage version, got %+v", got)
	}
}

func TestMatchCPETwoProductsSecondMatches(t *testing.T) {
	fixture := json.RawMessage(`[
	  {
	    "operator":"OR",
	    "nodes":[
	      {"operator":"OR","cpeMatch":[
	        {"vulnerable": true, "criteria":"cpe:2.3:a:vendor:express:*:*:*:*:*:*:*:*", "versionStartIncluding":"1.0.0", "versionEndExcluding":"2.0.0"},
	        {"vulnerable": true, "criteria":"cpe:2.3:a:vendor:lodash:*:*:*:*:*:*:*:*", "versionStartIncluding":"1.0.0", "versionEndExcluding":"2.0.0"}
	      ]}
	    ]
	  }
	]`)
	if got := MatchCPE("lodash", "1.2.0", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected for second match, got %+v", got)
	}
}

func TestMatchCPENormalizeComponentName(t *testing.T) {
	fixture := json.RawMessage(`[
	  {
	    "operator":"OR",
	    "nodes":[
	      {"operator":"OR","cpeMatch":[
	        {"vulnerable": true, "criteria":"cpe:2.3:a:vendor:path-to-regexp:*:*:*:*:*:*:*:*", "versionStartIncluding":"1.0.0", "versionEndExcluding":"3.0.0"}
	      ]}
	    ]
	  }
	]`)
	if got := MatchCPE("path_to_regexp", "2.0.0", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected with normalized component, got %+v", got)
	}
}

func TestMatchCPEFirmwareSuffixAlias(t *testing.T) {
	fixture := json.RawMessage(`[
	  {
	    "operator":"OR",
	    "nodes":[
	      {"operator":"OR","cpeMatch":[
	        {"vulnerable": true, "criteria":"cpe:2.3:o:vendor:device_firmware:*:*:*:*:*:*:*:*", "versionEndExcluding":"2.7.0"}
	      ]}
	    ]
	  }
	]`)

	if got := MatchCPE("device", "2.6.9", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected for firmware alias, got %+v", got)
	}
}

func TestMatchCPEEscapedCharactersInProduct(t *testing.T) {
	fixture := json.RawMessage(`[
	  {
	    "operator":"OR",
	    "nodes":[
	      {"operator":"OR","cpeMatch":[
	        {"vulnerable": true, "criteria":"cpe:2.3:a:siemens:logo\\!_soft_comfort:*:*:*:*:*:*:*:*", "versionEndExcluding":"9.0.0"}
	      ]}
	    ]
	  }
	]`)

	if got := MatchCPE("logo! soft comfort", "8.5.0", fixture); got.Verdict != "affected" {
		t.Fatalf("expected affected for escaped chars in CPE, got %+v", got)
	}
}
