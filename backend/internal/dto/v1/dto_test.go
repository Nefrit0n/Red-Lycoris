package v1

import (
	"encoding/json"
	"testing"
)

func TestDashboardMetricsJSONTags(t *testing.T) {
	payload := DashboardMetrics{
		TotalOpenFindings:    5,
		CriticalHighFindings: 2,
		FixedThisWeek:        1,
		ProductsAtRisk:       3,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded map[string]int
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["totalOpenFindings"] != 5 {
		t.Fatalf("expected totalOpenFindings 5, got %d", decoded["totalOpenFindings"])
	}
	if decoded["criticalHighFindings"] != 2 {
		t.Fatalf("expected criticalHighFindings 2, got %d", decoded["criticalHighFindings"])
	}
	if decoded["fixedThisWeek"] != 1 {
		t.Fatalf("expected fixedThisWeek 1, got %d", decoded["fixedThisWeek"])
	}
	if decoded["productsAtRisk"] != 3 {
		t.Fatalf("expected productsAtRisk 3, got %d", decoded["productsAtRisk"])
	}
}
