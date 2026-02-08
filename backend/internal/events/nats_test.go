package events

import (
	"context"
	"testing"
)

func TestSanitizeConsumerName(t *testing.T) {
	if name := sanitizeConsumerName("  "); name != "consumer" {
		t.Fatalf("expected default consumer name, got %s", name)
	}
	if name := sanitizeConsumerName("risk@worker#1"); name != "risk_worker_1" {
		t.Fatalf("unexpected sanitized name: %s", name)
	}
	if name := sanitizeConsumerName("valid-name_1"); name != "valid-name_1" {
		t.Fatalf("unexpected sanitized name: %s", name)
	}
}

func TestSameStringSet(t *testing.T) {
	if !sameStringSet([]string{"b", "a"}, []string{"a", "b"}) {
		t.Fatal("expected sets to match")
	}
	if sameStringSet([]string{"a"}, []string{"a", "b"}) {
		t.Fatal("expected sets with different lengths to differ")
	}
}

func TestPublishJSONWithNilPublisher(t *testing.T) {
	var publisher *Publisher
	if err := publisher.PublishJSON(context.Background(), "subject", map[string]string{"ok": "true"}); err != nil {
		t.Fatalf("expected nil publisher to no-op, got %v", err)
	}
}
