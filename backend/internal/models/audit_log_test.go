package models

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestAuditLogPrepareForInsert_NormalizesEmptyJSON(t *testing.T) {
	entry := &AuditLog{
		TenantID:   uuid.New(),
		Action:     "finding.updated",
		TargetType: "finding",
		Scope:      "product",
		DiffJSON:   json.RawMessage{},
	}

	entry.PrepareForInsert()

	if entry.DiffJSON != nil {
		t.Fatalf("expected DiffJSON to be nil for empty input, got %q", string(entry.DiffJSON))
	}
	if string(entry.MetadataJSON) != "{}" {
		t.Fatalf("expected MetadataJSON to be {}, got %q", string(entry.MetadataJSON))
	}
	if string(entry.Payload) != "{}" {
		t.Fatalf("expected Payload to be {}, got %q", string(entry.Payload))
	}
}
