package api

import (
	"net/http/httptest"
	"testing"
)

func TestSeverityAndStatusLabels(t *testing.T) {
	if severityLabel(4) != "critical" {
		t.Fatalf("severity label mismatch")
	}
	if statusLabel(3) != "fixed" {
		t.Fatalf("status label mismatch")
	}
}

func TestReadFiltersMap(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/findings/export.csv?severity=4&status=0,1", nil)
	m := readFiltersMap(req)
	if m["severity"] != "4" {
		t.Fatalf("severity not parsed")
	}
}
