package parser

import (
	"reflect"
	"testing"
)

func TestExtractCVEs(t *testing.T) {
	cases := []struct {
		name   string
		result sarifResult
		rule   sarifRule
		want   []string
	}{
		{
			name:   "cve-in-ruleId-lowercase",
			result: sarifResult{RuleID: "cisa.known-exploited.cve-2021-44228"},
			rule:   sarifRule{ID: "cisa.known-exploited.cve-2021-44228"},
			want:   []string{"CVE-2021-44228"},
		},
		{
			name:   "cve-in-tags",
			result: sarifResult{RuleID: "rule-1"},
			rule: sarifRule{
				ID:         "rule-1",
				Properties: sarifProperties{Tags: []string{"security", "CVE-2024-1234"}},
			},
			want: []string{"CVE-2024-1234"},
		},
		{
			name: "multiple-cves-dedup",
			result: sarifResult{
				RuleID:  "cve-2021-44228",
				Message: sarifMessage{Text: "Also: CVE-2021-44228 and CVE-2021-45046"},
			},
			rule: sarifRule{},
			want: []string{"CVE-2021-44228", "CVE-2021-45046"},
		},
		{
			name:   "no-cves",
			result: sarifResult{RuleID: "xss-detector"},
			rule:   sarifRule{},
			want:   []string{},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := extractCVEs(tc.result, tc.rule)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("got %v, want %v", got, tc.want)
			}
		})
	}
}
