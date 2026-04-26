package api

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"redlycoris/internal/storage"
)

func TestCanGroupAuditEvents(t *testing.T) {
	uid := uuid.New()
	resType := "finding"
	resID := "abc"
	action := "create"
	now := time.Now().UTC()

	base := storage.AuditRecord{
		UserID:       &uid,
		ResourceType: &resType,
		ResourceID:   &resID,
		Action:       &action,
		Method:       "POST",
		CreatedAt:    now,
	}

	withinWindow := base
	withinWindow.CreatedAt = now.Add(-20 * time.Second)
	if !canGroupAuditEvents(base, withinWindow) {
		t.Fatalf("expected events in 30s window to be grouped")
	}

	outsideWindow := base
	outsideWindow.CreatedAt = now.Add(-31 * time.Second)
	if canGroupAuditEvents(base, outsideWindow) {
		t.Fatalf("expected events outside 30s window to not be grouped")
	}
}

func TestGroupAuditFeed(t *testing.T) {
	uid := uuid.New()
	resType := "finding"
	resID := "id-1"
	action := "create"
	now := time.Now().UTC()

	items := []storage.AuditRecord{
		{ID: uuid.New(), UserID: &uid, ResourceType: &resType, ResourceID: &resID, Action: &action, Method: "POST", CreatedAt: now},
		{ID: uuid.New(), UserID: &uid, ResourceType: &resType, ResourceID: &resID, Action: &action, Method: "POST", CreatedAt: now.Add(-10 * time.Second)},
		{ID: uuid.New(), UserID: &uid, ResourceType: &resType, ResourceID: &resID, Action: &action, Method: "POST", CreatedAt: now.Add(-20 * time.Second)},
		{ID: uuid.New(), UserID: &uid, ResourceType: &resType, ResourceID: &resID, Action: &action, Method: "POST", CreatedAt: now.Add(-31 * time.Second)},
	}

	feed := groupAuditFeed(items)
	if len(feed) != 2 {
		t.Fatalf("expected 2 feed items, got %d", len(feed))
	}

	grp, ok := feed[0].(auditFeedGroup)
	if !ok {
		t.Fatalf("expected first feed item to be group")
	}
	if grp.Count != 3 {
		t.Fatalf("expected grouped count=3, got %d", grp.Count)
	}

	if _, ok := feed[1].(storage.AuditRecord); !ok {
		t.Fatalf("expected second feed item to stay as event")
	}
}

func TestDeriveAuditRisk(t *testing.T) {
	level, signals := deriveAuditRisk("DELETE", 500)
	if level != "critical" {
		t.Fatalf("expected critical risk for DELETE+500, got %s", level)
	}
	if len(signals) == 0 {
		t.Fatalf("expected risk signals")
	}
}

func TestInferAuditChangesDelete(t *testing.T) {
	resourceType := "finding-comment"
	resourceID := "1bfe3-468a-8c24-efd14f00c5e9"
	action := "delete"
	rec := storage.AuditRecord{
		ResourceType: &resourceType,
		ResourceID:   &resourceID,
		Action:       &action,
		StatusCode:   204,
	}

	changes := inferAuditChanges(rec)
	if len(changes) != 1 {
		t.Fatalf("expected one inferred change, got %d", len(changes))
	}
	if changes[0].Field != "resource" {
		t.Fatalf("expected field=resource, got %s", changes[0].Field)
	}
	if changes[0].Before == nil || changes[0].After != nil {
		t.Fatalf("expected delete before set and after=nil")
	}
}

func TestInferAuditChangesSkipsErrors(t *testing.T) {
	resourceType := "finding"
	resourceID := "7941dffa--948a-be44d798baa7"
	action := "delete"
	rec := storage.AuditRecord{
		ResourceType: &resourceType,
		ResourceID:   &resourceID,
		Action:       &action,
		StatusCode:   404,
	}

	if changes := inferAuditChanges(rec); len(changes) != 0 {
		t.Fatalf("expected no inferred changes for error status, got %d", len(changes))
	}
}
