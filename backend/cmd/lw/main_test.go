package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestComputeIdempotencyKeyDeterministic(t *testing.T) {
	meta := map[string]any{"schema_version": "1.0", "x": "y"}
	artsA := []artifactSpec{
		{Path: "b.json", SHA256: "bbb", SizeBytes: 2, FormatHint: "json"},
		{Path: "a.json", SHA256: "aaa", SizeBytes: 1, FormatHint: "json"},
	}
	artsB := []artifactSpec{
		{Path: "a.json", SHA256: "aaa", SizeBytes: 1, FormatHint: "json"},
		{Path: "b.json", SHA256: "bbb", SizeBytes: 2, FormatHint: "json"},
	}
	k1 := computeIdempotencyKey("proj", meta, artsA)
	k2 := computeIdempotencyKey("proj", meta, artsB)
	if k1 != k2 {
		t.Fatalf("expected deterministic key, got %s != %s", k1, k2)
	}
}

func TestComputeIdempotencyKeyChangesOnArtifactChange(t *testing.T) {
	meta := map[string]any{"schema_version": "1.0"}
	base := []artifactSpec{{Path: "a.json", SHA256: "aaa", SizeBytes: 1, FormatHint: "json"}}
	changed := []artifactSpec{{Path: "a.json", SHA256: "bbb", SizeBytes: 1, FormatHint: "json"}}
	if computeIdempotencyKey("proj", meta, base) == computeIdempotencyKey("proj", meta, changed) {
		t.Fatalf("idempotency key must change when artifact checksum changes")
	}
}

func TestCollectAllowlistGitLabEnv(t *testing.T) {
	env := []string{
		"CI=true",
		"GITLAB_CI=true",
		"CI_PIPELINE_ID=123",
		"CI_JOB_ID=456",
		"CI_PROJECT_URL=https://gitlab.example/a/b",
		"CI_REPOSITORY_URL=https://example/a/b.git",
		"SECRET_TOKEN=must_not_be_included",
	}
	got := collectAllowlistGitLabEnv(env)
	if _, ok := got["SECRET_TOKEN"]; ok {
		t.Fatalf("unexpected secret key in allowlist output")
	}
	if _, ok := got["CI_REPOSITORY_URL"]; ok {
		t.Fatalf("CI_REPOSITORY_URL must never be included")
	}
	expected := map[string]string{
		"CI":             "true",
		"GITLAB_CI":      "true",
		"CI_PIPELINE_ID": "123",
		"CI_JOB_ID":      "456",
		"CI_PROJECT_URL": "https://gitlab.example/a/b",
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("unexpected map: %#v", got)
	}
}

func TestComputeMultipartRangesByPartCount(t *testing.T) {
	plan := uploadPlanItem{}
	plan.Multipart.Parts = []uploadPlanPart{{PartNumber: 1}, {PartNumber: 2}, {PartNumber: 3}}
	ranges, err := computeMultipartRanges(10, plan)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := map[int]multipartRange{
		1: {Offset: 0, Size: 4},
		2: {Offset: 4, Size: 4},
		3: {Offset: 8, Size: 2},
	}
	if !reflect.DeepEqual(ranges, expected) {
		t.Fatalf("unexpected ranges: %#v", ranges)
	}
}

func TestDoCommitIncludesObjectKey(t *testing.T) {
	var payload map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	cfg := uploadArgs{Endpoint: srv.URL, Token: "token", MaxRetries: 1}
	artifacts := []artifactSpec{{Path: "a.json", SHA256: "aaa", SizeBytes: 10}}
	if err := doCommit(srv.Client(), cfg, artifacts, "run-1", map[string]string{"a.json": "obj-1"}); err != nil {
		t.Fatalf("doCommit failed: %v", err)
	}

	items, ok := payload["artifacts"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("unexpected payload artifacts: %#v", payload)
	}
	item, ok := items[0].(map[string]any)
	if !ok {
		t.Fatalf("unexpected artifact entry: %#v", items[0])
	}
	if got := item["object_key"]; got != "obj-1" {
		t.Fatalf("expected object_key=obj-1, got %#v", got)
	}
}
