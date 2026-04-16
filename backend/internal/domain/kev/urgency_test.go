package kev

import (
	"testing"
	"time"
)

func TestComputeUrgency(t *testing.T) {
	now := time.Date(2026, 4, 16, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name    string
		dueDate *time.Time
		wantT   UrgencyTier
		wantD   int
	}{
		{name: "nil due date", dueDate: nil, wantT: UrgencyNoDeadline, wantD: 0},
		{name: "past date", dueDate: ptrTime(now.AddDate(0, 0, -5)), wantT: UrgencyOverdue, wantD: -5},
		{name: "today", dueDate: ptrTime(now), wantT: UrgencyImminent, wantD: 0},
		{name: "five days", dueDate: ptrTime(now.AddDate(0, 0, 5)), wantT: UrgencyImminent, wantD: 5},
		{name: "fifteen days", dueDate: ptrTime(now.AddDate(0, 0, 15)), wantT: UrgencyHigh, wantD: 15},
		{name: "sixty days", dueDate: ptrTime(now.AddDate(0, 0, 60)), wantT: UrgencyNormal, wantD: 60},
		{name: "two hundred days", dueDate: ptrTime(now.AddDate(0, 0, 200)), wantT: UrgencyLow, wantD: 200},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotT, gotD := ComputeUrgency(tc.dueDate, now)
			if gotT != tc.wantT || gotD != tc.wantD {
				t.Fatalf("ComputeUrgency() = (%q, %d), want (%q, %d)", gotT, gotD, tc.wantT, tc.wantD)
			}
		})
	}
}

func ptrTime(v time.Time) *time.Time { return &v }
