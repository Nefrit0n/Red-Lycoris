package scanners

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestRunTrivyWithoutDocker(t *testing.T) {
	if _, err := exec.LookPath("docker"); err == nil {
		t.Skip("docker available; skipping external command test")
	}
	originalPath := os.Getenv("PATH")
	t.Setenv("PATH", "")
	t.Cleanup(func() { _ = os.Setenv("PATH", originalPath) })

	_, err := RunTrivy(context.Background(), RunnerConfig{Timeout: 1 * time.Second}, "/tmp", "/tmp/out.json")
	if err == nil {
		t.Fatal("expected error when docker is unavailable")
	}
}

func TestIsTransientDockerPullError(t *testing.T) {
	tests := []struct {
		name   string
		output string
		want   bool
	}{
		{name: "registry eof", output: `failed to do request: Get "https://registry-1.docker.io/v2/...": EOF`, want: true},
		{name: "tls timeout", output: `Get "https://registry-1.docker.io/v2/...": TLS handshake timeout`, want: true},
		{name: "non registry eof", output: `local error: EOF`, want: false},
		{name: "empty", output: "", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isTransientDockerPullError(tc.output)
			if got != tc.want {
				t.Fatalf("isTransientDockerPullError() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestRunDockerCommandRetriesTransientError(t *testing.T) {
	tempDir := t.TempDir()
	counterFile := filepath.Join(tempDir, "counter")
	scriptPath := filepath.Join(tempDir, "docker")

	script := `#!/usr/bin/env bash
set -euo pipefail
COUNTER_FILE="` + counterFile + `"
count=0
if [ -f "$COUNTER_FILE" ]; then
  count=$(cat "$COUNTER_FILE")
fi
count=$((count+1))
echo "$count" > "$COUNTER_FILE"
if [ "$count" -lt 3 ]; then
  echo 'docker: failed to do request: Head "https://registry-1.docker.io/v2/checkmarx/kics/manifests/latest": EOF' >&2
  exit 125
fi
echo "ok"
`
	if err := os.WriteFile(scriptPath, []byte(script), 0o700); err != nil {
		t.Fatalf("write fake docker: %v", err)
	}

	originalPath := os.Getenv("PATH")
	t.Setenv("PATH", tempDir+":"+originalPath)
	t.Cleanup(func() { _ = os.Setenv("PATH", originalPath) })

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	out, err := runDockerCommand(ctx, []string{"run", "--rm", "image"})
	if err != nil {
		t.Fatalf("runDockerCommand() error = %v, output: %s", err, string(out))
	}

	rawCount, err := os.ReadFile(counterFile)
	if err != nil {
		t.Fatalf("read counter: %v", err)
	}
	count, err := strconv.Atoi(strings.TrimSpace(string(rawCount)))
	if err != nil {
		t.Fatalf("parse counter: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 attempts, got %d", count)
	}
}
