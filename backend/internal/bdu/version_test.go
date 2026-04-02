package bdu

import (
	"testing"
)

func TestParseVersionConstraints(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []VersionConstraint
	}{
		{
			name:  "up to inclusive",
			input: "до 7.7.5 включительно (QuickTime)",
			expected: []VersionConstraint{
				{MaxVersion: "7.7.5"},
			},
		},
		{
			name:  "up to without inclusive keyword",
			input: "до 2.8",
			expected: []VersionConstraint{
				{MaxVersion: "2.8"},
			},
		},
		{
			name:  "from-to inclusive",
			input: "от 1.1 до 2.2.13 включительно (Dovecot)",
			expected: []VersionConstraint{
				{MinVersion: "1.1", MaxVersion: "2.2.13"},
			},
		},
		{
			name:  "from-to without inclusive keyword and suffix",
			input: "от 1.0.2 до 1.0.2zh",
			expected: []VersionConstraint{
				{MinVersion: "1.0.2", MaxVersion: "1.0.2zh"},
			},
		},
		{
			name:  "dash range",
			input: "9.0.0 - 9.0.16 (PostgreSQL)",
			expected: []VersionConstraint{
				{MinVersion: "9.0.0", MaxVersion: "9.0.16"},
			},
		},
		{
			name:  "exact versions comma separated",
			input: "11.1.0.7 (Database), 11.2.0.3 (Database), 11.2.0.4 (Database), 12.1.0.1 (Database)",
			expected: []VersionConstraint{
				{ExactVersion: "11.1.0.7"},
				{ExactVersion: "11.2.0.3"},
				{ExactVersion: "11.2.0.4"},
				{ExactVersion: "12.1.0.1"},
			},
		},
		{
			name:  "up to integer version",
			input: "до 28 включительно (Firefox)",
			expected: []VersionConstraint{
				{MaxVersion: "28"},
			},
		},
		{
			name:  "up to with colon version",
			input: "до 2.26:rc1 включительно (SeaMonkey)",
			expected: []VersionConstraint{
				{MaxVersion: "2.26"},
			},
		},
		{
			name:  "multiple ranges for same software",
			input: "до 8.4.20 включительно (PostgreSQL), 9.0.0 - 9.0.16 (PostgreSQL), 9.1.0 - 9.1.12 (PostgreSQL), 9.2.0 - 9.2.7 (PostgreSQL), 9.3.0 - 9.3.3 (PostgreSQL)",
			expected: []VersionConstraint{
				{MaxVersion: "8.4.20"},
				{MinVersion: "9.0.0", MaxVersion: "9.0.16"},
				{MinVersion: "9.1.0", MaxVersion: "9.1.12"},
				{MinVersion: "9.2.0", MaxVersion: "9.2.7"},
				{MinVersion: "9.3.0", MaxVersion: "9.3.3"},
			},
		},
		{
			name:  "from-to range for ESR",
			input: "от 24.0 до 24.4 включительно (Firefox ESR)",
			expected: []VersionConstraint{
				{MinVersion: "24.0", MaxVersion: "24.4"},
			},
		},
		{
			name:  "mixed comma-separated with names",
			input: "4.0 (Microsoft Dynamics AX), 2009 (Microsoft Dynamics AX), 2012 (Microsoft Dynamics AX)",
			expected: []VersionConstraint{
				{ExactVersion: "4.0"},
				{ExactVersion: "2009"},
				{ExactVersion: "2012"},
			},
		},
		{
			name:  "simple exact version",
			input: "2.0.5 (nginx)",
			expected: []VersionConstraint{
				{ExactVersion: "2.0.5"},
			},
		},
		{
			name:  "decimal comma exact version",
			input: "7,3",
			expected: []VersionConstraint{
				{ExactVersion: "7.3"},
			},
		},
		{
			name:  "hyphen package version treated as exact",
			input: "1.14.0-1",
			expected: []VersionConstraint{
				{ExactVersion: "1.14.0-1"},
			},
		},
		{
			name:     "empty string",
			input:    "",
			expected: nil,
		},
		{
			name:  "dovecot exact versions",
			input: "2.2.0 (Dovecot), 2.2.1 (Dovecot)",
			expected: []VersionConstraint{
				{ExactVersion: "2.2.0"},
				{ExactVersion: "2.2.1"},
			},
		},
		{
			name:  "up to inclusive QEMU",
			input: "до 2.0 включительно (QEMU)",
			expected: []VersionConstraint{
				{MaxVersion: "2.0"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseVersionConstraints(tt.input)
			if len(got) != len(tt.expected) {
				t.Fatalf("ParseVersionConstraints(%q): got %d constraints, want %d\n  got: %+v", tt.input, len(got), len(tt.expected), got)
			}
			for i, exp := range tt.expected {
				if got[i] != exp {
					t.Errorf("constraint[%d]: got %+v, want %+v", i, got[i], exp)
				}
			}
		})
	}
}

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.0", "1.0", 0},
		{"1.0", "2.0", -1},
		{"2.0", "1.0", 1},
		{"1.0.0", "1.0", 0},
		{"1.2.3", "1.2.4", -1},
		{"9.1.5", "9.1.12", -1},
		{"10.0", "9.9.9", 1},
		{"28", "28", 0},
		{"27", "28", -1},
		{"29", "28", 1},
		{"11.2.0.3", "11.2.0.4", -1},
		{"11.2.0.4", "11.2.0.4", 0},
	}

	for _, tt := range tests {
		t.Run(tt.a+"_vs_"+tt.b, func(t *testing.T) {
			got := CompareVersions(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("CompareVersions(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestMatchesAny(t *testing.T) {
	tests := []struct {
		name        string
		version     string
		constraints []VersionConstraint
		want        bool
	}{
		{
			name:        "within upper bound",
			version:     "7.7.4",
			constraints: []VersionConstraint{{MaxVersion: "7.7.5"}},
			want:        true,
		},
		{
			name:        "at upper bound",
			version:     "7.7.5",
			constraints: []VersionConstraint{{MaxVersion: "7.7.5"}},
			want:        true,
		},
		{
			name:        "above upper bound",
			version:     "7.7.6",
			constraints: []VersionConstraint{{MaxVersion: "7.7.5"}},
			want:        false,
		},
		{
			name:        "within range",
			version:     "9.0.8",
			constraints: []VersionConstraint{{MinVersion: "9.0.0", MaxVersion: "9.0.16"}},
			want:        true,
		},
		{
			name:        "below range",
			version:     "8.4.21",
			constraints: []VersionConstraint{{MinVersion: "9.0.0", MaxVersion: "9.0.16"}},
			want:        false,
		},
		{
			name:        "exact match",
			version:     "11.2.0.3",
			constraints: []VersionConstraint{{ExactVersion: "11.2.0.3"}},
			want:        true,
		},
		{
			name:        "exact no match",
			version:     "11.2.0.5",
			constraints: []VersionConstraint{{ExactVersion: "11.2.0.3"}},
			want:        false,
		},
		{
			name:    "matches one of multiple constraints",
			version: "9.1.5",
			constraints: []VersionConstraint{
				{MaxVersion: "8.4.20"},
				{MinVersion: "9.0.0", MaxVersion: "9.0.16"},
				{MinVersion: "9.1.0", MaxVersion: "9.1.12"},
			},
			want: true,
		},
		{
			name:    "matches none of multiple constraints",
			version: "9.4.0",
			constraints: []VersionConstraint{
				{MaxVersion: "8.4.20"},
				{MinVersion: "9.0.0", MaxVersion: "9.0.16"},
				{MinVersion: "9.1.0", MaxVersion: "9.1.12"},
				{MinVersion: "9.2.0", MaxVersion: "9.2.7"},
				{MinVersion: "9.3.0", MaxVersion: "9.3.3"},
			},
			want: false,
		},
		{
			name:        "empty version",
			version:     "",
			constraints: []VersionConstraint{{MaxVersion: "7.7.5"}},
			want:        false,
		},
		{
			name:        "no constraints",
			version:     "1.0",
			constraints: nil,
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MatchesAny(tt.version, tt.constraints)
			if got != tt.want {
				t.Errorf("MatchesAny(%q, %+v) = %v, want %v", tt.version, tt.constraints, got, tt.want)
			}
		})
	}
}
