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
	OpenGrepBinary   string
	OpenGrepImage    string
	TrivyImage       string
	CheckovImage     string
	KICSImage        string
	GitleaksImage    string
	GrypeImage       string
	Timeout          time.Duration
}

// RunOpenGrep runs OpenGrep (Semgrep-compatible fork) in a Docker container.
// Output format is identical to Semgrep JSON, so the same parser can be used.
func RunOpenGrep(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	if binary := resolveOpenGrepBinary(cfg.OpenGrepBinary); binary != "" {
		if output, err := runOpenGrepBinary(ctx, binary, workspace, outputPath); err == nil {
			return output, nil
		}
	}

	if cfg.OpenGrepImage == "" {
		return "", fmt.Errorf("opengrep binary not found and ANALYSIS_OPENGREP_IMAGE is not set")
	}

	cmd := exec.CommandContext(
		ctx,
		"docker",
		"run",
		"--rm",
		"--network", cfg.ContainerNetwork,
		"-v", fmt.Sprintf("%s:/src:ro", workspace),
		"-v", fmt.Sprintf("%s:/out", filepath.Dir(outputPath)),
		cfg.OpenGrepImage,
		"opengrep",
		"--config=auto",
		"--json",
		"--output", "/out/"+filepath.Base(outputPath),
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("opengrep failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func resolveOpenGrepBinary(configuredPath string) string {
	if configuredPath != "" {
		if resolved, err := exec.LookPath(configuredPath); err == nil {
			return resolved
		}
	}
	if resolved, err := exec.LookPath("opengrep"); err == nil {
		return resolved
	}
	return ""
}

func runOpenGrepBinary(ctx context.Context, binary string, workspace string, outputPath string) (string, error) {
	cmd := exec.CommandContext(
		ctx,
		binary,
		"--config=auto",
		"--json",
		"--output", outputPath,
		workspace,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("opengrep failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// RunTrivy runs Trivy scanner in a Docker container.
func RunTrivy(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
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
		"/src",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("trivy failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// RunCheckov runs Checkov IaC scanner in a Docker container.
func RunCheckov(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
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
		cfg.CheckovImage,
		"--directory", "/src",
		"--output", "sarif",
		"--output-file-path", "/out",
		"--soft-fail",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("checkov failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	// Checkov writes results.sarif — rename to expected output path
	sarifPath := filepath.Join(filepath.Dir(outputPath), "results_sarif.sarif")
	if err := renameIfExists(sarifPath, outputPath); err != nil {
		return string(output), fmt.Errorf("checkov output rename: %v", err)
	}
	return string(output), nil
}

// RunKICS runs KICS IaC scanner in a Docker container.
func RunKICS(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
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
		cfg.KICSImage,
		"scan",
		"--path", "/src",
		"--output-path", "/out",
		"--output-name", "result",
		"--report-formats", "sarif",
		"--no-progress",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// KICS exits non-zero when findings are present — only fail on actual errors
		if !strings.Contains(string(output), "Files scanned") {
			return string(output), fmt.Errorf("kics failed: %v (%s)", err, strings.TrimSpace(string(output)))
		}
	}
	sarifPath := filepath.Join(filepath.Dir(outputPath), "result.sarif")
	if err := renameIfExists(sarifPath, outputPath); err != nil {
		return string(output), fmt.Errorf("kics output rename: %v", err)
	}
	return string(output), nil
}

// RunGitleaks runs Gitleaks secret scanner in a Docker container.
func RunGitleaks(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
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
		cfg.GitleaksImage,
		"detect",
		"--source", "/src",
		"--report-format", "json",
		"--report-path", "/out/"+filepath.Base(outputPath),
		"--no-git",
		"--exit-code", "0",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("gitleaks failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// RunGrype runs Grype SCA vulnerability scanner in a Docker container.
func RunGrype(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
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
		cfg.GrypeImage,
		"dir:/src",
		"--output", "json",
		"--file", "/out/"+filepath.Base(outputPath),
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("grype failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// renameIfExists renames src to dst if src exists, otherwise is a no-op.
func renameIfExists(src, dst string) error {
	if src == dst {
		return nil
	}
	// Use os.Rename via exec to avoid importing os here (already imported via exec)
	// Actually we need os — but it's fine for this helper.
	return osRename(src, dst)
}
