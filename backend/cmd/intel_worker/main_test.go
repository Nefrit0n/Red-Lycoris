package main

import (
	"math/rand"
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	if value := parseDuration("", 5*time.Second); value != 5*time.Second {
		t.Fatalf("expected fallback duration, got %s", value)
	}
	if value := parseDuration("2m", 5*time.Second); value != 2*time.Minute {
		t.Fatalf("expected 2m, got %s", value)
	}
	if value := parseDuration("90", 5*time.Second); value != 90*time.Second {
		t.Fatalf("expected 90s, got %s", value)
	}
	if value := parseDuration("invalid", 5*time.Second); value != 5*time.Second {
		t.Fatalf("expected fallback on invalid input, got %s", value)
	}
}

func TestComputeBackoff(t *testing.T) {
	jitterMu.Lock()
	jitterRand = rand.New(rand.NewSource(1))
	jitterMu.Unlock()

	base := 2 * time.Second
	backoff := computeBackoff(base, 1)
	if backoff < base*2 || backoff >= base*3 {
		t.Fatalf("expected backoff between %s and %s, got %s", base*2, base*3, backoff)
	}

	backoff = computeBackoff(0, 2)
	if backoff != 0 {
		t.Fatalf("expected zero backoff for non-positive base, got %s", backoff)
	}
}

func TestHashIdentifierDeterministic(t *testing.T) {
	first := hashIdentifier("CVE-2024-0001")
	second := hashIdentifier("CVE-2024-0001")
	third := hashIdentifier("CVE-2024-0002")

	if first != second {
		t.Fatal("expected hash to be deterministic for same input")
	}
	if first == third {
		t.Fatal("expected different hash for different input")
	}
}
