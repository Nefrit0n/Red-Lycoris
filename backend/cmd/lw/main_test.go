package main

import (
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

func TestCollectAllowlistGitLabEnv(t *testing.T) {
	env := []string{
		"CI_PIPELINE_ID=123",
		"CI_JOB_ID=456",
		"CI_PROJECT_URL=https://gitlab.example/a/b",
		"SECRET_TOKEN=must_not_be_included",
	}
	got := collectAllowlistGitLabEnv(env)
	if _, ok := got["SECRET_TOKEN"]; ok {
		t.Fatalf("unexpected secret key in allowlist output")
	}
	expected := map[string]string{
		"CI_PIPELINE_ID": "123",
		"CI_JOB_ID":      "456",
		"CI_PROJECT_URL": "https://gitlab.example/a/b",
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("unexpected map: %#v", got)
	}
}
