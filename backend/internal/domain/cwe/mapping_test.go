package cwe

import "testing"

func TestLookupOWASP(t *testing.T) {
	tests := []struct {
		cweID    int
		wantID   string
		wantName string
		wantNil  bool
	}{
		{79, "A03:2021", "Injection", false},
		{89, "A03:2021", "Injection", false},
		{502, "A08:2021", "Software and Data Integrity Failures", false},
		{9999, "", "", true},
	}

	for _, tc := range tests {
		got := LookupOWASP(tc.cweID)
		if tc.wantNil {
			if got != nil {
				t.Errorf("LookupOWASP(%d) = %v, want nil", tc.cweID, got)
			}
			continue
		}
		if got == nil {
			t.Fatalf("LookupOWASP(%d) = nil, want {%s %s}", tc.cweID, tc.wantID, tc.wantName)
		}
		if got.ID != tc.wantID || got.Name != tc.wantName {
			t.Errorf("LookupOWASP(%d) = {%s %s}, want {%s %s}",
				tc.cweID, got.ID, got.Name, tc.wantID, tc.wantName)
		}
	}
}

func TestLookupTop25(t *testing.T) {
	tests := []struct {
		cweID    int
		wantRank int
		wantNil  bool
	}{
		{79, 1, false},
		{89, 3, false},
		{9999, 0, true},
	}

	for _, tc := range tests {
		got := LookupTop25(tc.cweID)
		if tc.wantNil {
			if got != nil {
				t.Errorf("LookupTop25(%d) = %v, want nil", tc.cweID, got)
			}
			continue
		}
		if got == nil {
			t.Fatalf("LookupTop25(%d) = nil, want rank %d", tc.cweID, tc.wantRank)
		}
		if got.Rank != tc.wantRank {
			t.Errorf("LookupTop25(%d).Rank = %d, want %d", tc.cweID, got.Rank, tc.wantRank)
		}
	}
}
