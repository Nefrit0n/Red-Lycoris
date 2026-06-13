package storage

import (
	"testing"
	"time"
)

func TestComputeDisplayStatus(t *testing.T) {
	past := time.Now().Add(-time.Hour)
	future := time.Now().Add(time.Hour)

	cases := []struct {
		status      string
		lockedUntil *time.Time
		want        string
	}{
		{"active", nil, "active"},
		{"pending", nil, "pending"},
		{"disabled", nil, "disabled"},
		{"active", &past, "active"},    // expired lock → not locked
		{"active", &future, "locked"},  // valid lock → locked
		{"pending", &future, "locked"},
		{"disabled", &future, "locked"},
	}
	for _, c := range cases {
		got := computeDisplayStatus(c.status, c.lockedUntil)
		if got != c.want {
			t.Errorf("status=%q locked=%v: want %q got %q", c.status, c.lockedUntil, c.want, got)
		}
	}
}
