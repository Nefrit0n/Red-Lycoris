package loadtest

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"sync"
	"time"
)

type EndpointReport struct {
	Name         string  `json:"name"`
	Count        int     `json:"count"`
	SuccessCount int     `json:"success_count"`
	ErrorCount   int     `json:"error_count"`
	P50MS        int64   `json:"p50_ms"`
	P90MS        int64   `json:"p90_ms"`
	P95MS        int64   `json:"p95_ms"`
	P99MS        int64   `json:"p99_ms"`
	RPS          float64 `json:"rps"`
	TTFBP50MS    int64   `json:"ttfb_p50_ms,omitempty"`
	TTFBP95MS    int64   `json:"ttfb_p95_ms,omitempty"`
	TTFBP99MS    int64   `json:"ttfb_p99_ms,omitempty"`
}

type ErrorSummary struct {
	Endpoint string `json:"endpoint"`
	Status   int    `json:"status,omitempty"`
	Error    string `json:"error"`
	Count    int    `json:"count"`
}

type ScenarioReport struct {
	Scenario        string           `json:"scenario"`
	StartedAt       time.Time        `json:"started_at"`
	FinishedAt      time.Time        `json:"finished_at"`
	DurationSeconds int64            `json:"duration_seconds"`
	Concurrency     int              `json:"concurrency"`
	Endpoints       []EndpointReport `json:"endpoints"`
	Errors          []ErrorSummary   `json:"errors,omitempty"`
	TargetVersion   string           `json:"target_version"`
	TargetCommit    string           `json:"target_commit"`
}

type callEvent struct {
	Endpoint   string
	TS         time.Time
	DurationMS int64
	Status     int
	Error      string
	TTFBMS     int64
	HasTTFB    bool
}

type endpointAgg struct {
	name       string
	durations  []int64
	ttfb       []int64
	count      int
	success    int
	errorCount int
}

type Collector struct {
	mu        sync.Mutex
	endpoints map[string]*endpointAgg
	errors    map[string]*ErrorSummary
}

func NewCollector() *Collector {
	return &Collector{
		endpoints: make(map[string]*endpointAgg),
		errors:    make(map[string]*ErrorSummary),
	}
}

func (c *Collector) Record(ev callEvent) {
	c.mu.Lock()
	defer c.mu.Unlock()

	agg, ok := c.endpoints[ev.Endpoint]
	if !ok {
		agg = &endpointAgg{name: ev.Endpoint}
		c.endpoints[ev.Endpoint] = agg
	}
	agg.count++
	agg.durations = append(agg.durations, ev.DurationMS)
	if ev.HasTTFB {
		agg.ttfb = append(agg.ttfb, ev.TTFBMS)
	}

	if ev.Error == "" && ev.Status >= 200 && ev.Status < 300 {
		agg.success++
		return
	}
	agg.errorCount++

	errKey := fmt.Sprintf("%s|%s|%d", ev.Endpoint, ev.Error, ev.Status)
	es, exists := c.errors[errKey]
	if !exists {
		es = &ErrorSummary{Endpoint: ev.Endpoint, Status: ev.Status, Error: ev.Error, Count: 0}
		if es.Error == "" {
			es.Error = "http_non_2xx"
		}
		c.errors[errKey] = es
	}
	es.Count++
}

func percentile(values []int64, p int) int64 {
	if len(values) == 0 {
		return 0
	}
	cp := make([]int64, len(values))
	copy(cp, values)
	sort.Slice(cp, func(i, j int) bool { return cp[i] < cp[j] })
	idx := (p*len(cp)+99)/100 - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(cp) {
		idx = len(cp) - 1
	}
	return cp[idx]
}

func (c *Collector) BuildReport(scenario string, started, finished time.Time, concurrency int, version, commit string) ScenarioReport {
	c.mu.Lock()
	defer c.mu.Unlock()

	dur := finished.Sub(started)
	if dur <= 0 {
		dur = time.Second
	}
	seconds := dur.Seconds()

	endpoints := make([]EndpointReport, 0, len(c.endpoints))
	for _, agg := range c.endpoints {
		rep := EndpointReport{
			Name:         agg.name,
			Count:        agg.count,
			SuccessCount: agg.success,
			ErrorCount:   agg.errorCount,
			P50MS:        percentile(agg.durations, 50),
			P90MS:        percentile(agg.durations, 90),
			P95MS:        percentile(agg.durations, 95),
			P99MS:        percentile(agg.durations, 99),
			RPS:          float64(agg.count) / seconds,
		}
		if len(agg.ttfb) > 0 {
			rep.TTFBP50MS = percentile(agg.ttfb, 50)
			rep.TTFBP95MS = percentile(agg.ttfb, 95)
			rep.TTFBP99MS = percentile(agg.ttfb, 99)
		}
		endpoints = append(endpoints, rep)
	}
	sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].Name < endpoints[j].Name })

	errs := make([]ErrorSummary, 0, len(c.errors))
	for _, e := range c.errors {
		errs = append(errs, *e)
	}
	sort.Slice(errs, func(i, j int) bool {
		if errs[i].Endpoint == errs[j].Endpoint {
			return errs[i].Error < errs[j].Error
		}
		return errs[i].Endpoint < errs[j].Endpoint
	})

	return ScenarioReport{
		Scenario:        scenario,
		StartedAt:       started.UTC(),
		FinishedAt:      finished.UTC(),
		DurationSeconds: int64(dur / time.Second),
		Concurrency:     concurrency,
		Endpoints:       endpoints,
		Errors:          errs,
		TargetVersion:   version,
		TargetCommit:    commit,
	}
}

func WriteReport(path string, report ScenarioReport) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(report)
}
