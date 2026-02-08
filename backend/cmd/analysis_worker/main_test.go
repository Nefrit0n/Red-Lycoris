package main

import (
	"path/filepath"
	"testing"
)

func TestArchivePathForKey(t *testing.T) {
	jobDir := t.TempDir()

	tests := []struct {
		name     string
		key      string
		expected string
	}{
		{
			name:     "zip",
			key:      "jobs/123/archive.zip",
			expected: filepath.Join(jobDir, "archive.zip"),
		},
		{
			name:     "tar-gz",
			key:      "jobs/123/archive.tar.gz",
			expected: filepath.Join(jobDir, "archive.tar.gz"),
		},
		{
			name:     "tgz",
			key:      "jobs/123/archive.tgz",
			expected: filepath.Join(jobDir, "archive.tar.gz"),
		},
		{
			name:     "tar",
			key:      "jobs/123/archive.tar",
			expected: filepath.Join(jobDir, "archive.tar"),
		},
		{
			name:     "unknown",
			key:      "jobs/123/archive.bin",
			expected: filepath.Join(jobDir, "archive"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := archivePathForKey(jobDir, tc.key)
			if got != tc.expected {
				t.Fatalf("expected %q, got %q", tc.expected, got)
			}
		})
	}
}
