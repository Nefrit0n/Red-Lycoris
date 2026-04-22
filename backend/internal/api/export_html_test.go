package api

import (
	"net/http/httptest"
	"testing"
)

func TestParseIncludeDetails(t *testing.T) {
	cases := []struct {
		q       string
		total   int
		want    bool
		wantErr bool
	}{
		{"", 100, true, false},
		{"", 600, false, false},
		{"true", 100, true, false},
		{"true", 501, false, true},
		{"false", 100, false, false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest("GET", "/?include_details="+tc.q, nil)
		got, _, err := parseIncludeDetails(req, tc.total)
		if (err != nil) != tc.wantErr {
			t.Fatalf("query %q err=%v wantErr=%v", tc.q, err, tc.wantErr)
		}
		if err == nil && got != tc.want {
			t.Fatalf("query %q got=%v want=%v", tc.q, got, tc.want)
		}
	}
}
