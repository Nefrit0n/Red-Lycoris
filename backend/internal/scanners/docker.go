// Package scanners provides utilities for running security scanners
// in Docker containers.
package scanners

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// RunnerConfig contains configuration for running scanners
type RunnerConfig struct {
	ContainerNetwork string
	SemgrepImage     string
	TrivyImage       string
	Timeout          time.Duration
}

// RunSemgrep runs Semgrep scanner in a Docker container.
func RunSemgrep(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) error {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		"docker",
		"run",
		"--rm",
		"--network", cfg.ContainerNetwork,
		"-v", fmt.Sprintf("%s:/src:ro", workspace),
		"-v", fmt.Sprintf("%s:/out", filepath.Dir(outputPath)),
		cfg.SemgrepImage,
		"semgrep",
		"--config=auto",
		"--json",
		"--output", "/out/"+filepath.Base(outputPath),
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("semgrep failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}

// RunTrivy runs Trivy scanner in a Docker container.
func RunTrivy(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) error {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		"docker",
		"run",
		"--rm",
		"--network", cfg.ContainerNetwork,
		"-v", fmt.Sprintf("%s:/src:ro", workspace),
		"-v", fmt.Sprintf("%s:/out", filepath.Dir(outputPath)),
		cfg.TrivyImage,
		"fs",
		"--scanners", "vuln,secret,misconfig",
		"--format", "json",
		"--output", "/out/"+filepath.Base(outputPath),
		"--exit-code", "0",
		"--skip-db-update",
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("trivy failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return nil
}
