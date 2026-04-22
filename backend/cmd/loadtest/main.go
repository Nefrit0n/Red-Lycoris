package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"time"

	"redlycoris/internal/loadtest"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	cmd := os.Args[1]
	ctx := context.Background()
	version := "0.1.0b"
	commit := gitCommit()

	var err error
	switch cmd {
	case "generate":
		err = runGenerate()
	case "seed":
		err = runSeed(ctx)
	case "browse":
		err = runBrowse(ctx, version, commit)
	case "dashboard":
		err = runDashboard(ctx, version, commit)
	case "export":
		err = runExport(ctx, version, commit)
	default:
		usage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "loadtest %s failed: %v\n", cmd, err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Println(`Usage:
  loadtest generate --output=testdata/fixtures/ --size=10000
  loadtest seed --url=http://localhost:8080 --token=<PAT> --project=<uuid> --file=testdata/fixtures/sarif_100k.json
  loadtest browse --url=... --token=... --duration=5m --concurrency=10 --report=report_browse.json [--project=<uuid>]
  loadtest dashboard --url=... --token=... --duration=2m --concurrency=5 --report=report_dashboard.json
  loadtest export --url=... --token=... --format=csv --report=report_export.json`)
}

func runGenerate() error {
	fs := flag.NewFlagSet("generate", flag.ContinueOnError)
	output := fs.String("output", "testdata/fixtures", "Output directory or full file path")
	size := fs.Int("size", 10000, "Number of SARIF findings to generate")
	seed := fs.Int64("seed", time.Now().UnixNano(), "Random seed")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}
	path, err := loadtest.GenerateSARIF(*output, *size, *seed)
	if err != nil {
		return err
	}
	fmt.Println("generated:", path)
	return nil
}

func runSeed(ctx context.Context) error {
	fs := flag.NewFlagSet("seed", flag.ContinueOnError)
	url := fs.String("url", "", "Base API URL (required)")
	token := fs.String("token", "", "PAT token (required)")
	project := fs.String("project", "", "Project UUID (required)")
	file := fs.String("file", "", "SARIF file path (required)")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}
	if *url == "" || *token == "" || *project == "" || *file == "" {
		return errors.New("url, token, project, file are required")
	}
	return loadtest.SeedSARIF(ctx, *url, *token, *project, *file)
}

func runBrowse(ctx context.Context, version, commit string) error {
	fs := flag.NewFlagSet("browse", flag.ContinueOnError)
	url := fs.String("url", "", "Base API URL (required)")
	token := fs.String("token", "", "PAT token (required)")
	project := fs.String("project", "", "Project UUID (optional)")
	duration := fs.Duration("duration", 5*time.Minute, "Scenario duration")
	concurrency := fs.Int("concurrency", 10, "Parallel workers")
	report := fs.String("report", "report_browse.json", "JSON report path")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}
	if *url == "" || *token == "" {
		return errors.New("url and token are required")
	}
	res, err := loadtest.RunBrowse(ctx, loadtest.BrowseConfig{
		URL:         *url,
		Token:       *token,
		ProjectID:   *project,
		Duration:    *duration,
		Concurrency: *concurrency,
		ReportPath:  *report,
		Version:     version,
		Commit:      commit,
	})
	if err != nil {
		return err
	}
	fmt.Printf("browse complete: endpoints=%d report=%s\n", len(res.Endpoints), *report)
	return nil
}

func runDashboard(ctx context.Context, version, commit string) error {
	fs := flag.NewFlagSet("dashboard", flag.ContinueOnError)
	url := fs.String("url", "", "Base API URL (required)")
	token := fs.String("token", "", "PAT token (required)")
	duration := fs.Duration("duration", 2*time.Minute, "Scenario duration")
	concurrency := fs.Int("concurrency", 5, "Parallel workers")
	report := fs.String("report", "report_dashboard.json", "JSON report path")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}
	if *url == "" || *token == "" {
		return errors.New("url and token are required")
	}
	res, err := loadtest.RunDashboard(ctx, loadtest.DashboardConfig{
		URL:         *url,
		Token:       *token,
		Duration:    *duration,
		Concurrency: *concurrency,
		ReportPath:  *report,
		Version:     version,
		Commit:      commit,
	})
	if err != nil {
		return err
	}
	fmt.Printf("dashboard complete: endpoints=%d report=%s\n", len(res.Endpoints), *report)
	return nil
}

func runExport(ctx context.Context, version, commit string) error {
	fs := flag.NewFlagSet("export", flag.ContinueOnError)
	url := fs.String("url", "", "Base API URL (required)")
	token := fs.String("token", "", "PAT token (required)")
	format := fs.String("format", "csv", "Export format: csv/json/xlsx/html")
	report := fs.String("report", "report_export.json", "JSON report path")
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}
	if *url == "" || *token == "" {
		return errors.New("url and token are required")
	}
	res, err := loadtest.RunExport(ctx, loadtest.ExportConfig{
		URL:        *url,
		Token:      *token,
		Format:     *format,
		ReportPath: *report,
		Version:    version,
		Commit:     commit,
	})
	if err != nil {
		return err
	}
	fmt.Printf("export complete: endpoints=%d report=%s\n", len(res.Endpoints), *report)
	return nil
}

func gitCommit() string {
	out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output()
	if err != nil {
		return "unknown"
	}
	return string(trimSpace(out))
}

func trimSpace(b []byte) []byte {
	for len(b) > 0 && (b[len(b)-1] == '\n' || b[len(b)-1] == '\r' || b[len(b)-1] == ' ' || b[len(b)-1] == '\t') {
		b = b[:len(b)-1]
	}
	for len(b) > 0 && (b[0] == ' ' || b[0] == '\t' || b[0] == '\n' || b[0] == '\r') {
		b = b[1:]
	}
	return b
}
