// Package scanners provides utilities for running security scanners
// in Docker containers.
package scanners

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"regexp"
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

var dockerRefPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.:/@-]*$`)

const dockerTransientRetryAttempts = 3

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

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.OpenGrepImage,
		"opengrep",
		"--config=auto",
		"--json",
		"--output", "/out/"+filepath.Base(outputPath),
		"/src",
	)
	if err != nil {
		return "", err
	}
	output, err := runDockerCommand(ctx, args)
	if err != nil {
		return string(output), fmt.Errorf("opengrep failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	if err := ensureOutputFile(outputPath, "opengrep", string(output)); err != nil {
		return string(output), err
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

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.TrivyImage,
		"fs",
		"--scanners", "vuln,secret,misconfig",
		"--format", "json",
		"--output", "/out/"+filepath.Base(outputPath),
		"--exit-code", "0",
		"/src",
	)
	if err != nil {
		return "", err
	}
	output, err := runDockerCommand(ctx, args)
	if err != nil {
		return string(output), fmt.Errorf("trivy failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	if err := ensureOutputFile(outputPath, "trivy", string(output)); err != nil {
		return string(output), err
	}
	return string(output), nil
}

// RunCheckov runs Checkov IaC scanner in a Docker container.
func RunCheckov(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.CheckovImage,
		"--directory", "/src",
		"--output", "sarif",
		"--output-file-path", "/out",
		"--soft-fail",
	)
	if err != nil {
		return "", err
	}
	output, err := runDockerCommand(ctx, args)
	if err != nil {
		return string(output), fmt.Errorf("checkov failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	// Checkov writes results.sarif (some versions use results_sarif.sarif) — rename to expected output path
	outputDir := filepath.Dir(outputPath)
	sarifPath := filepath.Join(outputDir, "results_sarif.sarif")
	if err := renameIfExists(sarifPath, outputPath); err != nil {
		return string(output), fmt.Errorf("checkov output rename: %v", err)
	}
	sarifPath = filepath.Join(outputDir, "results.sarif")
	if err := renameIfExists(sarifPath, outputPath); err != nil {
		return string(output), fmt.Errorf("checkov output rename: %v", err)
	}
	if err := ensureOutputFile(outputPath, "checkov", string(output)); err != nil {
		return string(output), err
	}
	return string(output), nil
}

// RunKICS runs KICS IaC scanner in a Docker container.
//
// The command uses --ignore-on-exit results so KICS returns exit code 0
// even when findings are present. Real engine errors (docker pull failure,
// invalid arguments, timeout) still produce non-zero exit codes.
//
// Output is JSON format at a predictable path (/out/result.json).
func RunKICS(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	start := time.Now()

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.KICSImage,
		"scan",
		"--path", "/src",
		"--output-path", "/out",
		"--output-name", "result",
		"--report-formats", "json",
		"--ignore-on-exit", "results",
		"--no-progress",
	)
	if err != nil {
		return "", err
	}

	log.Printf("[kics] starting scan image=%s workspace=%s output_dir=%s",
		cfg.KICSImage, workspace, filepath.Dir(outputPath))

	output, err := runDockerCommand(ctx, args)
	duration := time.Since(start)
	exitCode := exitCodeFromError(err)

	log.Printf("[kics] finished duration=%s exit_code=%d output_bytes=%d",
		duration.Round(time.Millisecond), exitCode, len(output))

	if err != nil {
		// With --ignore-on-exit results, non-zero means a real engine error.
		// Safety net: also accept findings-related exit codes (20-60) from
		// older KICS versions that may not support --ignore-on-exit.
		if result := ClassifyKICSExitCode(exitCode); !result.Success {
			return string(output), fmt.Errorf("kics engine error (exit %d): %s",
				exitCode, strings.TrimSpace(string(output)))
		}
		log.Printf("[kics] non-zero exit %d classified as findings (not engine error)", exitCode)
	}

	// KICS writes result.json to /out/ which maps to outputDir
	jsonPath := filepath.Join(filepath.Dir(outputPath), "result.json")
	if err := renameIfExists(jsonPath, outputPath); err != nil {
		return string(output), fmt.Errorf("kics output rename: %v", err)
	}
	if err := ensureOutputFile(outputPath, "kics", string(output)); err != nil {
		return string(output), err
	}
	return string(output), nil
}

// RunGitleaks runs Gitleaks secret scanner in a Docker container.
func RunGitleaks(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.GitleaksImage,
		"detect",
		"--source", "/src",
		"--report-format", "json",
		"--report-path", "/out/"+filepath.Base(outputPath),
		"--no-git",
		"--exit-code", "0",
	)
	if err != nil {
		return "", err
	}
	output, err := runDockerCommand(ctx, args)
	if err != nil {
		return string(output), fmt.Errorf("gitleaks failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	if err := ensureOutputFile(outputPath, "gitleaks", string(output)); err != nil {
		return string(output), err
	}
	return string(output), nil
}

// RunGrype runs Grype SCA vulnerability scanner in a Docker container.
func RunGrype(ctx context.Context, cfg RunnerConfig, workspace string, outputPath string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, cfg.Timeout)
	defer cancel()

	args, err := dockerRunArgs(cfg, workspace, outputPath, cfg.GrypeImage,
		"dir:/src",
		"--output", "json",
		"--file", "/out/"+filepath.Base(outputPath),
	)
	if err != nil {
		return "", err
	}
	output, err := runDockerCommand(ctx, args)
	if err != nil {
		return string(output), fmt.Errorf("grype failed: %v (%s)", err, strings.TrimSpace(string(output)))
	}
	if err := ensureOutputFile(outputPath, "grype", string(output)); err != nil {
		return string(output), err
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

func dockerRunArgs(cfg RunnerConfig, workspace string, outputPath string, image string, extraArgs ...string) ([]string, error) {
	if image == "" {
		return nil, fmt.Errorf("docker image is required")
	}
	if !dockerRefPattern.MatchString(image) {
		return nil, fmt.Errorf("invalid docker image reference: %s", image)
	}
	if cfg.ContainerNetwork != "" && !dockerRefPattern.MatchString(cfg.ContainerNetwork) {
		return nil, fmt.Errorf("invalid docker network name: %s", cfg.ContainerNetwork)
	}
	if strings.ContainsRune(workspace, '\x00') || strings.ContainsRune(outputPath, '\x00') {
		return nil, fmt.Errorf("invalid path: contains null byte")
	}
	absWorkspace, err := filepath.Abs(workspace)
	if err != nil {
		return nil, fmt.Errorf("resolve workspace path: %w", err)
	}
	outputDir := filepath.Dir(outputPath)
	absOutputDir, err := filepath.Abs(outputDir)
	if err != nil {
		return nil, fmt.Errorf("resolve output path: %w", err)
	}
	args := []string{"run", "--rm"}
	if cfg.ContainerNetwork != "" {
		args = append(args, "--network", cfg.ContainerNetwork)
	}
	args = append(args,
		"-v", fmt.Sprintf("%s:/src:ro", absWorkspace),
		"-v", fmt.Sprintf("%s:/out", absOutputDir),
		image,
	)
	args = append(args, extraArgs...)
	return args, nil
}

func runDockerCommand(ctx context.Context, args []string) ([]byte, error) {
	var lastOutput []byte
	var lastErr error

	for attempt := 1; attempt <= dockerTransientRetryAttempts; attempt++ {
		if ctx.Err() != nil {
			if lastErr != nil {
				return lastOutput, lastErr
			}
			return nil, ctx.Err()
		}

		// #nosec G204 -- arguments are validated in dockerRunArgs.
		cmd := exec.CommandContext(ctx, "docker", args...)
		output, err := cmd.CombinedOutput()
		if err == nil {
			return output, nil
		}

		lastOutput = output
		lastErr = err
		if !isTransientDockerPullError(string(output)) || attempt == dockerTransientRetryAttempts {
			return output, err
		}

		select {
		case <-ctx.Done():
			return output, err
		case <-time.After(time.Duration(attempt) * time.Second):
		}
	}

	return lastOutput, lastErr
}

func isTransientDockerPullError(output string) bool {
	if output == "" {
		return false
	}
	lower := strings.ToLower(output)

	if !strings.Contains(lower, "docker.io") && !strings.Contains(lower, "registry-") {
		return false
	}

	transientMarkers := []string{
		"eof",
		"tls handshake timeout",
		"i/o timeout",
		"connection reset by peer",
		"temporary failure in name resolution",
	}

	for _, marker := range transientMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}

	return false
}
