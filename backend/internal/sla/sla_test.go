package sla

import (
	"testing"
	"time"
)

func TestDueAtFromSeverity(t *testing.T) {
	matrix := Matrix{
		Critical: 7 * 24 * time.Hour,
		High:     30 * 24 * time.Hour,
		Medium:   90 * 24 * time.Hour,
		Low:      180 * 24 * time.Hour,
	}
	firstSeen := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	dueAt, ok := DueAt(firstSeen, "critical", matrix)
	if !ok {
		t.Fatalf("expected severity to be recognized")
	}
	expected := firstSeen.Add(7 * 24 * time.Hour)
	if !dueAt.Equal(expected) {
		t.Fatalf("expected due_at %s, got %s", expected, dueAt)
	}
}

func TestShouldUpdateDueAt(t *testing.T) {
	existing := time.Date(2024, 6, 10, 0, 0, 0, 0, time.UTC)
	candidateLater := time.Date(2024, 7, 10, 0, 0, 0, 0, time.UTC)
	if ShouldUpdateDueAt(&existing, candidateLater) {
		t.Fatalf("expected due_at not to move later for repeats")
	}
	candidateEarlier := time.Date(2024, 5, 10, 0, 0, 0, 0, time.UTC)
	if !ShouldUpdateDueAt(&existing, candidateEarlier) {
		t.Fatalf("expected due_at to update when candidate is earlier")
	}
}

func TestDaysRemaining(t *testing.T) {
	now := time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC)
	dueAt := now.Add(48 * time.Hour)
	days := DaysRemaining(&dueAt, now)
	if days == nil || *days != 2 {
		t.Fatalf("expected 2 days remaining, got %#v", days)
	}
	overdue := now.Add(-24 * time.Hour)
	days = DaysRemaining(&overdue, now)
	if days == nil || *days > 0 {
		t.Fatalf("expected overdue days remaining to be <= 0, got %#v", days)
	}
}

func TestIsBreached(t *testing.T) {
	now := time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC)
	dueAt := now.Add(-24 * time.Hour)
	if !IsBreached(&dueAt, "new", now) {
		t.Fatalf("expected breach for open finding after due_at")
	}
	if IsBreached(&dueAt, "mitigated", now) {
		t.Fatalf("expected no breach for closed finding")
	}
}
