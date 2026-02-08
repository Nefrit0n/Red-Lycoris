package main

import (
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	if value := parseDuration("15m", time.Minute); value != 15*time.Minute {
		t.Fatalf("expected 15m, got %s", value)
	}
	if value := parseDuration("invalid", 2*time.Minute); value != 2*time.Minute {
		t.Fatalf("expected fallback on invalid input, got %s", value)
	}
}
