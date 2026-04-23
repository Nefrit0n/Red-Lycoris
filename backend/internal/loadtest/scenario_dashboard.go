package loadtest

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type DashboardConfig struct {
	URL         string
	Token       string
	Duration    time.Duration
	Concurrency int
	ReportPath  string
	Version     string
	Commit      string
}

func RunDashboard(ctx context.Context, cfg DashboardConfig) (ScenarioReport, error) {
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 1
	}
	if cfg.Duration <= 0 {
		cfg.Duration = 2 * time.Minute
	}
	client := NewHTTPClient(cfg.URL, cfg.Token)
	collector := NewCollector()
	started := time.Now()
	deadline := started.Add(cfg.Duration)

	var wg sync.WaitGroup
	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for time.Now().Before(deadline) {
				resp, st, elapsed, err := client.Do(ctx, http.MethodGet, "/api/v1/dashboard/stats", nil)
				ev := callEvent{Endpoint: "GET /api/v1/dashboard/stats", TS: st, DurationMS: elapsed.Milliseconds()}
				if err != nil {
					ev.Error = err.Error()
					collector.Record(ev)
					continue
				}
				ev.Status = resp.StatusCode
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					b, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
					ev.Error = string(b)
				}
				if _, copyErr := io.Copy(io.Discard, resp.Body); copyErr != nil {
					slog.Warn("loadtest dashboard discard response failed", "error", copyErr)
				}
				if closeErr := resp.Body.Close(); closeErr != nil {
					slog.Warn("loadtest dashboard close response failed", "error", closeErr)
				}
				collector.Record(ev)
			}
		}()
	}
	wg.Wait()

	report := collector.BuildReport("dashboard", started, time.Now(), cfg.Concurrency, cfg.Version, cfg.Commit)
	if cfg.ReportPath != "" {
		if err := WriteReport(cfg.ReportPath, report); err != nil {
			return report, err
		}
	}
	return report, nil
}
