package scanners

import (
	"context"
	"os"
	"os/exec"
	"testing"
	"time"
)

func TestRunSemgrepWithoutDocker(t *testing.T) {
	if _, err := exec.LookPath("docker"); err == nil {
		t.Skip("docker available; skipping external command test")
	}
	originalPath := os.Getenv("PATH")
	t.Setenv("PATH", "")
	t.Cleanup(func() { _ = os.Setenv("PATH", originalPath) })

	err := RunSemgrep(context.Background(), RunnerConfig{Timeout: 1 * time.Second}, "/tmp", "/tmp/out.json")
	if err == nil {
		t.Fatal("expected error when docker is unavailable")
	}
}

func TestRunTrivyWithoutDocker(t *testing.T) {
	if _, err := exec.LookPath("docker"); err == nil {
		t.Skip("docker available; skipping external command test")
	}
	originalPath := os.Getenv("PATH")
	t.Setenv("PATH", "")
	t.Cleanup(func() { _ = os.Setenv("PATH", originalPath) })

	err := RunTrivy(context.Background(), RunnerConfig{Timeout: 1 * time.Second}, "/tmp", "/tmp/out.json")
	if err == nil {
		t.Fatal("expected error when docker is unavailable")
	}
}
