package loadtest

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptrace"
	"time"
)

type ExportConfig struct {
	URL        string
	Token      string
	Format     string
	ReportPath string
	Version    string
	Commit     string
}

func RunExport(ctx context.Context, cfg ExportConfig) (ScenarioReport, error) {
	if cfg.Format == "" {
		cfg.Format = "csv"
	}

	client := NewHTTPClient(cfg.URL, cfg.Token)
	collector := NewCollector()
	started := time.Now()
	path := "/api/v1/findings/export." + cfg.Format

	resp, st, total, ttfb, err := doExportWithTTFB(ctx, client, http.MethodPost, path)
	if err == nil && resp != nil && resp.StatusCode == http.StatusMethodNotAllowed {
		if _, copyErr := io.Copy(io.Discard, resp.Body); copyErr != nil {
			slog.Warn("loadtest export discard response failed", "error", copyErr)
		}
		if closeErr := resp.Body.Close(); closeErr != nil {
			slog.Warn("loadtest export close response failed", "error", closeErr)
		}
		resp, st, total, ttfb, err = doExportWithTTFB(ctx, client, http.MethodGet, path)
	}

	ev := callEvent{Endpoint: "EXPORT /api/v1/findings/export." + cfg.Format, TS: st, DurationMS: total.Milliseconds()}
	if err != nil {
		ev.Error = err.Error()
		collector.Record(ev)
	} else {
		ev.Status = resp.StatusCode
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			ev.Error = string(b)
		} else {
			ev.HasTTFB = true
			ev.TTFBMS = ttfb.Milliseconds()
		}
		if _, copyErr := io.Copy(io.Discard, resp.Body); copyErr != nil {
			slog.Warn("loadtest export discard response failed", "error", copyErr)
		}
		if closeErr := resp.Body.Close(); closeErr != nil {
			slog.Warn("loadtest export close response failed", "error", closeErr)
		}
		collector.Record(ev)
	}

	report := collector.BuildReport("export", started, time.Now(), 1, cfg.Version, cfg.Commit)
	if cfg.ReportPath != "" {
		if err := WriteReport(cfg.ReportPath, report); err != nil {
			return report, err
		}
	}
	return report, nil
}

func doExportWithTTFB(ctx context.Context, c *HTTPClient, method, path string) (*http.Response, time.Time, time.Duration, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, nil)
	if err != nil {
		return nil, time.Time{}, 0, 0, err
	}
	req.Header.Set("Accept", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	started := time.Now()
	var ttfb time.Duration
	trace := &httptrace.ClientTrace{
		GotFirstResponseByte: func() {
			ttfb = time.Since(started)
		},
	}
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, started, time.Since(started), 0, err
	}
	return resp, started, time.Since(started), ttfb, nil
}
