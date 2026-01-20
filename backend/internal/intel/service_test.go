package intel

import (
	"database/sql"
	"testing"
	"time"

	"lotus-warden/backend/internal/storage"
)

func TestShouldRefresh(t *testing.T) {
	service := &Service{refreshInterval: 24 * time.Hour}
	now := time.Now().UTC()

	if !service.ShouldRefresh(nil, now) {
		t.Fatal("expected refresh for missing status")
	}

	status := &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-2 * time.Hour), Valid: true},
	}
	if service.ShouldRefresh(status, now) {
		t.Fatal("expected no refresh when interval not elapsed")
	}

	status = &storage.VulnIntelStatus{
		LastRefreshedAt: sql.NullTime{Time: now.Add(-48 * time.Hour), Valid: true},
	}
	if !service.ShouldRefresh(status, now) {
		t.Fatal("expected refresh when interval elapsed")
	}
}

func TestDedupeReferences(t *testing.T) {
	title := "Ref"
	refs := dedupeReferences([]storage.IntelReference{
		{Title: &title, URL: "https://example.com"},
		{Title: nil, URL: "https://example.com"},
		{Title: nil, URL: "https://example.org"},
	})
	if len(refs) != 2 {
		t.Fatalf("expected 2 refs, got %d", len(refs))
	}
}
