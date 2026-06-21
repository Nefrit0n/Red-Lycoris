package api

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"redlycoris/internal/domain"
)

func intPtr(v int) *int {
	return &v
}

func TestApplyProjectUpdatePreservesInvariants(t *testing.T) {
	projectID := uuid.New()
	ownerID := uuid.New()
	bodyID := uuid.New()
	criticalDays := 7
	highDays := 30
	mediumDays := 90

	current := &domain.Project{
		ID:                  projectID,
		Slug:                "api",
		Name:                "API",
		Description:         "old",
		IconColor:           "#64748b",
		SourceKind:          domain.ProjectSourceGit,
		RepoURL:             "https://git.example/app.git",
		RepoProvider:        "gitlab",
		DefaultBranch:       "main",
		AutoscanOnPush:      true,
		Tags:                []string{"prod"},
		Status:              domain.ProjectStatusActive,
		SetupCompleted:      true,
		Visibility:          "workspace",
		CreatedBy:           ownerID,
		Owner:               domain.ProjectOwner{ID: ownerID},
		SLACriticalDays:     &criticalDays,
		SLAHighDays:         &highDays,
		SLAMediumDays:       &mediumDays,
		SLANotifyBeforeDays: 3,
	}

	raw := []byte(`{
		"id": "` + bodyID.String() + `",
		"name": "Renamed",
		"description": "",
		"sla": {
			"critical_days": null,
			"high_days": 14
		},
		"source": {
			"kind": "webhook"
		}
	}`)
	var req updateProjectRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}

	next, ownerChanged, err := applyProjectUpdate(current, req)
	if err != nil {
		t.Fatalf("applyProjectUpdate: %v", err)
	}
	if ownerChanged {
		t.Fatal("ownerChanged = true, want false")
	}
	if next.ID != projectID {
		t.Fatalf("project ID changed to %s, want %s", next.ID, projectID)
	}
	if next.Name != "Renamed" {
		t.Fatalf("name = %q, want Renamed", next.Name)
	}
	if next.Description != "" {
		t.Fatalf("description = %q, want empty", next.Description)
	}
	if next.SLACriticalDays != nil {
		t.Fatalf("critical SLA = %v, want nil", *next.SLACriticalDays)
	}
	if next.SLAHighDays == nil || *next.SLAHighDays != 14 {
		t.Fatalf("high SLA = %v, want 14", next.SLAHighDays)
	}
	if next.SLAMediumDays == nil || *next.SLAMediumDays != 90 {
		t.Fatalf("medium SLA was not preserved: %v", next.SLAMediumDays)
	}
	if next.SourceKind != domain.ProjectSourceWebhook {
		t.Fatalf("source kind = %q, want webhook", next.SourceKind)
	}
	if next.RepoURL != "" || next.RepoProvider != "" {
		t.Fatalf("webhook source kept repo fields: repo=%q provider=%q", next.RepoURL, next.RepoProvider)
	}
}

func TestApplyProjectUpdatePartialDoesNotResetSettings(t *testing.T) {
	ownerID := uuid.New()
	teamID := uuid.New().String()
	current := &domain.Project{
		ID:                  uuid.New(),
		Name:                "API",
		Slug:                "api",
		SourceKind:          domain.ProjectSourceGit,
		RepoURL:             "https://git.example/app.git",
		RepoProvider:        "github",
		DefaultBranch:       "release",
		AutoscanOnPush:      true,
		Tags:                []string{"prod", "pci"},
		Status:              domain.ProjectStatusActive,
		SetupCompleted:      true,
		Visibility:          "team",
		Team:                &domain.ProjectTeam{ID: teamID, Name: "AppSec"},
		CreatedBy:           ownerID,
		Owner:               domain.ProjectOwner{ID: ownerID},
		SLACriticalDays:     intPtr(5),
		SLAHighDays:         intPtr(15),
		SLAMediumDays:       intPtr(45),
		SLANotifyBeforeDays: 2,
	}

	var req updateProjectRequest
	if err := json.Unmarshal([]byte(`{"name":"New API"}`), &req); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	next, ownerChanged, err := applyProjectUpdate(current, req)
	if err != nil {
		t.Fatalf("applyProjectUpdate: %v", err)
	}
	if ownerChanged {
		t.Fatal("ownerChanged = true, want false")
	}
	if next.ID != current.ID {
		t.Fatalf("project ID changed")
	}
	if next.SourceKind != current.SourceKind || next.RepoURL != current.RepoURL || next.DefaultBranch != current.DefaultBranch || !next.AutoscanOnPush {
		t.Fatalf("source settings were reset: %+v", next)
	}
	if next.Team == nil || next.Team.ID != teamID {
		t.Fatalf("team was reset: %+v", next.Team)
	}
	if next.SLACriticalDays == nil || *next.SLACriticalDays != 5 {
		t.Fatalf("SLA was reset: %+v", next.SLACriticalDays)
	}
}

func TestApplyProjectUpdateOwnerChange(t *testing.T) {
	oldOwner := uuid.New()
	newOwner := uuid.New()
	current := &domain.Project{
		ID:             uuid.New(),
		Name:           "API",
		Slug:           "api",
		Status:         domain.ProjectStatusActive,
		SetupCompleted: true,
		Visibility:     "workspace",
		CreatedBy:      oldOwner,
		Owner:          domain.ProjectOwner{ID: oldOwner},
	}

	var req updateProjectRequest
	if err := json.Unmarshal([]byte(`{"owner_id":"`+newOwner.String()+`"}`), &req); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	next, ownerChanged, err := applyProjectUpdate(current, req)
	if err != nil {
		t.Fatalf("applyProjectUpdate: %v", err)
	}
	if !ownerChanged {
		t.Fatal("ownerChanged = false, want true")
	}
	if next.CreatedBy != newOwner || next.Owner.ID != newOwner {
		t.Fatalf("owner not updated: created_by=%s owner=%s", next.CreatedBy, next.Owner.ID)
	}
}

func TestApplyProjectUpdateRejectsGitSourceWithoutRepoURL(t *testing.T) {
	current := &domain.Project{
		ID:             uuid.New(),
		Name:           "API",
		Slug:           "api",
		Status:         domain.ProjectStatusActive,
		SetupCompleted: true,
		Visibility:     "workspace",
		SourceKind:     domain.ProjectSourceManual,
	}

	var req updateProjectRequest
	if err := json.Unmarshal([]byte(`{"source":{"kind":"git"}}`), &req); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if _, _, err := applyProjectUpdate(current, req); err == nil {
		t.Fatal("applyProjectUpdate succeeded, want error")
	}
}
