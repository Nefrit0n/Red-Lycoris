package storage

import (
	"testing"

	"redlycoris/internal/domain"
)

func TestResolveEffectiveLevel_GroupMax(t *testing.T) {
	got := resolveEffectiveLevel([]domain.AccessLevel{domain.AccessRead, domain.AccessAdmin, domain.AccessWrite}, nil)
	if got == nil || *got != domain.AccessAdmin {
		t.Fatalf("expected admin, got %#v", got)
	}
}

func TestResolveEffectiveLevel_PersonalOverrideWins(t *testing.T) {
	personal := domain.AccessRead
	got := resolveEffectiveLevel([]domain.AccessLevel{domain.AccessAdmin}, &personal)
	if got == nil || *got != domain.AccessRead {
		t.Fatalf("expected read override, got %#v", got)
	}
}

func TestResolveEffectiveLevel_NoSources(t *testing.T) {
	got := resolveEffectiveLevel(nil, nil)
	if got != nil {
		t.Fatalf("expected nil, got %#v", *got)
	}
}
