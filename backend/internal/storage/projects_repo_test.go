package storage

import (
	"testing"

	"redlycoris/internal/domain"
)

func TestSlugifyProjectName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"My Project", "my-project"},
		{"  spaces  ", "spaces"},
		{"Hello/World", "hello-world"},
		{"foo.bar", "foo-bar"},
		{"foo_bar", "foo-bar"},
		{"foo---bar", "foo---bar"},
		{"-leading", "leading"},
		{"trailing-", "trailing"},
		{"", "project"},
		{"UPPER CASE", "upper-case"},
		// Slug at exactly 96 chars stays unchanged
		{"abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefgh", "abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefgh"},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got := slugifyProjectName(tc.input)
			if got != tc.want {
				t.Errorf("slugifyProjectName(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestSetDerivedProjectHealth(t *testing.T) {
	tests := []struct {
		name   string
		p      domain.Project
		health domain.ProjectHealth
	}{
		{
			name:   "paused status",
			p:      domain.Project{Status: domain.ProjectStatusPaused},
			health: domain.ProjectHealthPaused,
		},
		{
			name:   "archived status",
			p:      domain.Project{Status: domain.ProjectStatusArchived},
			health: domain.ProjectHealthPaused,
		},
		{
			name:   "setup not completed",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: false},
			health: domain.ProjectHealthSetup,
		},
		{
			name:   "has critical findings",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: true, FindingsBySev: domain.ProjectFindingsBySeverity{Critical: 3}},
			health: domain.ProjectHealthBreach,
		},
		{
			name:   "sla breached",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: true, SLABreached: 2},
			health: domain.ProjectHealthBreach,
		},
		{
			name:   "has high findings only",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: true, FindingsBySev: domain.ProjectFindingsBySeverity{High: 1}},
			health: domain.ProjectHealthWarn,
		},
		{
			name:   "no significant findings",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: true, FindingsBySev: domain.ProjectFindingsBySeverity{Low: 5}},
			health: domain.ProjectHealthHealthy,
		},
		{
			name:   "all zeros",
			p:      domain.Project{Status: domain.ProjectStatusActive, SetupCompleted: true},
			health: domain.ProjectHealthHealthy,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setDerivedProjectHealth(&tc.p)
			if tc.p.Health != tc.health {
				t.Errorf("health = %q, want %q", tc.p.Health, tc.health)
			}
		})
	}
}
