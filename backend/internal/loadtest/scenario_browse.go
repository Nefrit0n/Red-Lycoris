package loadtest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type BrowseConfig struct {
	URL         string
	Token       string
	ProjectID   string
	Duration    time.Duration
	Concurrency int
	ReportPath  string
	Version     string
	Commit      string
}

type findingsListResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
	Meta struct {
		NextCursor string `json:"next_cursor"`
	} `json:"meta"`
}

func RunBrowse(ctx context.Context, cfg BrowseConfig) (ScenarioReport, error) {
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 1
	}
	if cfg.Duration <= 0 {
		cfg.Duration = 5 * time.Minute
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
				ids, nextCursor := doFindingsPage(ctx, client, collector, "", cfg.ProjectID)
				cursor := nextCursor
				for page := 0; page < 2 && cursor != "" && time.Now().Before(deadline); page++ {
					_, cursor = doFindingsPage(ctx, client, collector, cursor, cfg.ProjectID)
				}
				if len(ids) > 0 {
					idx, err := cryptoIntn(len(ids))
					if err != nil {
						collector.Record(callEvent{Endpoint: "GET /api/v1/findings", TS: time.Now(), Error: err.Error()})
						continue
					}
					id := ids[idx]
					doGetFinding(ctx, client, collector, id)
				}
			}
		}()
	}
	wg.Wait()

	report := collector.BuildReport("browse", started, time.Now(), cfg.Concurrency, cfg.Version, cfg.Commit)
	if cfg.ReportPath != "" {
		if err := WriteReport(cfg.ReportPath, report); err != nil {
			return report, err
		}
	}
	return report, nil
}

func doFindingsPage(ctx context.Context, client *HTTPClient, collector *Collector, cursor, projectID string) ([]string, string) {
	severityIdx, err := cryptoIntn(4)
	if err != nil {
		collector.Record(callEvent{Endpoint: "GET /api/v1/findings", TS: time.Now(), Error: err.Error()})
		return nil, ""
	}
	statusIdx, err := cryptoIntn(3)
	if err != nil {
		collector.Record(callEvent{Endpoint: "GET /api/v1/findings", TS: time.Now(), Error: err.Error()})
		return nil, ""
	}

	values := url.Values{}
	values.Set("limit", "50")
	values.Set("severity", fmt.Sprintf("%d", 1+severityIdx))
	values.Set("status", fmt.Sprintf("%d", statusIdx))
	if projectID != "" {
		values.Set("project_id", projectID)
	}
	if cursor != "" {
		values.Set("cursor", cursor)
	}
	path := "/api/v1/findings/?" + values.Encode()

	resp, started, elapsed, err := client.Do(ctx, http.MethodGet, path, nil)
	ev := callEvent{Endpoint: "GET /api/v1/findings", TS: started, DurationMS: elapsed.Milliseconds()}
	if err != nil {
		ev.Error = err.Error()
		collector.Record(ev)
		return nil, ""
	}
	defer resp.Body.Close()
	ev.Status = resp.StatusCode
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		ev.Error = string(b)
		collector.Record(ev)
		return nil, ""
	}
	var parsed findingsListResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		ev.Error = err.Error()
		collector.Record(ev)
		return nil, ""
	}
	collector.Record(ev)

	ids := make([]string, 0, len(parsed.Data))
	for _, item := range parsed.Data {
		if item.ID != "" {
			ids = append(ids, item.ID)
		}
	}
	return ids, parsed.Meta.NextCursor
}

func doGetFinding(ctx context.Context, client *HTTPClient, collector *Collector, id string) {
	path := "/api/v1/findings/" + url.PathEscape(id)
	resp, started, elapsed, err := client.Do(ctx, http.MethodGet, path, nil)
	ev := callEvent{Endpoint: "GET /api/v1/findings/{id}", TS: started, DurationMS: elapsed.Milliseconds()}
	if err != nil {
		ev.Error = err.Error()
		collector.Record(ev)
		return
	}
	defer resp.Body.Close()
	ev.Status = resp.StatusCode
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		ev.Error = string(b)
	}
	collector.Record(ev)
}
