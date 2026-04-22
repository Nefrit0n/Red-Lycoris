package observability

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var defaultHistogramBuckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

type metric interface {
	writePrometheus(*strings.Builder)
}

type Registry struct {
	mu      sync.RWMutex
	metrics []metric
}

func NewRegistry() *Registry {
	return &Registry{}
}

func (r *Registry) register(m metric) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.metrics = append(r.metrics, m)
}

func (r *Registry) writePrometheusText() string {
	var b strings.Builder
	r.mu.RLock()
	metrics := append([]metric(nil), r.metrics...)
	r.mu.RUnlock()
	for _, m := range metrics {
		m.writePrometheus(&b)
	}
	return b.String()
}

type labelSet struct {
	values []string
}

func labelsKey(names []string, labels map[string]string) string {
	if len(names) == 0 {
		return ""
	}
	parts := make([]string, len(names))
	for i, name := range names {
		parts[i] = labels[name]
	}
	return strings.Join(parts, "\xff")
}

func decodeLabels(names []string, key string) labelSet {
	if len(names) == 0 {
		return labelSet{}
	}
	return labelSet{values: strings.Split(key, "\xff")}
}

func formatLabels(names []string, set labelSet) string {
	if len(names) == 0 {
		return ""
	}
	pairs := make([]string, 0, len(names))
	for i := range names {
		v := ""
		if i < len(set.values) {
			v = set.values[i]
		}
		pairs = append(pairs, fmt.Sprintf("%s=\"%s\"", names[i], escapeLabel(v)))
	}
	return "{" + strings.Join(pairs, ",") + "}"
}

func escapeLabel(v string) string {
	replacer := strings.NewReplacer(`\\`, `\\\\`, "\n", `\n`, `"`, `\"`)
	return replacer.Replace(v)
}

type counterEntry struct {
	value atomic.Uint64
}

type CounterVec struct {
	name       string
	help       string
	labelNames []string
	mu         sync.RWMutex
	entries    map[string]*counterEntry
}

func NewCounterVec(name, help string, labelNames ...string) *CounterVec {
	return &CounterVec{name: name, help: help, labelNames: labelNames, entries: make(map[string]*counterEntry)}
}

func (c *CounterVec) Inc(labels map[string]string) {
	c.Add(labels, 1)
}

func (c *CounterVec) Add(labels map[string]string, delta uint64) {
	key := labelsKey(c.labelNames, labels)
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		c.mu.Lock()
		entry, ok = c.entries[key]
		if !ok {
			entry = &counterEntry{}
			c.entries[key] = entry
		}
		c.mu.Unlock()
	}
	entry.value.Add(delta)
}

func (c *CounterVec) writePrometheus(b *strings.Builder) {
	b.WriteString("# HELP ")
	b.WriteString(c.name)
	b.WriteByte(' ')
	b.WriteString(c.help)
	b.WriteByte('\n')
	b.WriteString("# TYPE ")
	b.WriteString(c.name)
	b.WriteString(" counter\n")

	c.mu.RLock()
	keys := make([]string, 0, len(c.entries))
	for key := range c.entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entry := c.entries[key]
		value := entry.value.Load()
		b.WriteString(c.name)
		b.WriteString(formatLabels(c.labelNames, decodeLabels(c.labelNames, key)))
		b.WriteByte(' ')
		b.WriteString(strconv.FormatUint(value, 10))
		b.WriteByte('\n')
	}
	c.mu.RUnlock()
}

type gaugeEntry struct {
	bits atomic.Uint64
}

type GaugeVec struct {
	name       string
	help       string
	labelNames []string
	mu         sync.RWMutex
	entries    map[string]*gaugeEntry
}

func NewGaugeVec(name, help string, labelNames ...string) *GaugeVec {
	return &GaugeVec{name: name, help: help, labelNames: labelNames, entries: make(map[string]*gaugeEntry)}
}

func (g *GaugeVec) Set(labels map[string]string, v float64) {
	key := labelsKey(g.labelNames, labels)
	g.mu.RLock()
	entry, ok := g.entries[key]
	g.mu.RUnlock()
	if !ok {
		g.mu.Lock()
		entry, ok = g.entries[key]
		if !ok {
			entry = &gaugeEntry{}
			g.entries[key] = entry
		}
		g.mu.Unlock()
	}
	entry.bits.Store(math.Float64bits(v))
}

func (g *GaugeVec) writePrometheus(b *strings.Builder) {
	b.WriteString("# HELP ")
	b.WriteString(g.name)
	b.WriteByte(' ')
	b.WriteString(g.help)
	b.WriteByte('\n')
	b.WriteString("# TYPE ")
	b.WriteString(g.name)
	b.WriteString(" gauge\n")

	g.mu.RLock()
	keys := make([]string, 0, len(g.entries))
	for key := range g.entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entry := g.entries[key]
		value := math.Float64frombits(entry.bits.Load())
		b.WriteString(g.name)
		b.WriteString(formatLabels(g.labelNames, decodeLabels(g.labelNames, key)))
		b.WriteByte(' ')
		b.WriteString(strconv.FormatFloat(value, 'g', -1, 64))
		b.WriteByte('\n')
	}
	g.mu.RUnlock()
}

type histogramEntry struct {
	sumBits atomic.Uint64
	count   atomic.Uint64
	buckets []atomic.Uint64
}

type HistogramVec struct {
	name       string
	help       string
	labelNames []string
	buckets    []float64
	mu         sync.RWMutex
	entries    map[string]*histogramEntry
}

func NewHistogramVec(name, help string, buckets []float64, labelNames ...string) *HistogramVec {
	copied := append([]float64(nil), buckets...)
	sort.Float64s(copied)
	return &HistogramVec{name: name, help: help, labelNames: labelNames, buckets: copied, entries: make(map[string]*histogramEntry)}
}

func (h *HistogramVec) Observe(labels map[string]string, v float64) {
	key := labelsKey(h.labelNames, labels)
	h.mu.RLock()
	entry, ok := h.entries[key]
	h.mu.RUnlock()
	if !ok {
		h.mu.Lock()
		entry, ok = h.entries[key]
		if !ok {
			entry = &histogramEntry{buckets: make([]atomic.Uint64, len(h.buckets)+1)}
			h.entries[key] = entry
		}
		h.mu.Unlock()
	}

	addFloat64(&entry.sumBits, v)
	entry.count.Add(1)
	bucketIdx := len(h.buckets)
	for i, bound := range h.buckets {
		if v <= bound {
			bucketIdx = i
			break
		}
	}
	entry.buckets[bucketIdx].Add(1)
}

func addFloat64(bits *atomic.Uint64, delta float64) {
	for {
		oldBits := bits.Load()
		newVal := math.Float64frombits(oldBits) + delta
		if bits.CompareAndSwap(oldBits, math.Float64bits(newVal)) {
			return
		}
	}
}

func (h *HistogramVec) writePrometheus(b *strings.Builder) {
	b.WriteString("# HELP ")
	b.WriteString(h.name)
	b.WriteByte(' ')
	b.WriteString(h.help)
	b.WriteByte('\n')
	b.WriteString("# TYPE ")
	b.WriteString(h.name)
	b.WriteString(" histogram\n")

	h.mu.RLock()
	keys := make([]string, 0, len(h.entries))
	for key := range h.entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		entry := h.entries[key]
		ls := decodeLabels(h.labelNames, key)
		cumulative := uint64(0)
		for i, bound := range h.buckets {
			cumulative += entry.buckets[i].Load()
			b.WriteString(h.name)
			b.WriteString("_bucket")
			b.WriteString(formatLabels(append(h.labelNames, "le"), labelSet{values: append(append([]string(nil), ls.values...), strconv.FormatFloat(bound, 'g', -1, 64))}))
			b.WriteByte(' ')
			b.WriteString(strconv.FormatUint(cumulative, 10))
			b.WriteByte('\n')
		}
		cumulative += entry.buckets[len(h.buckets)].Load()
		b.WriteString(h.name)
		b.WriteString("_bucket")
		b.WriteString(formatLabels(append(h.labelNames, "le"), labelSet{values: append(append([]string(nil), ls.values...), "+Inf")}))
		b.WriteByte(' ')
		b.WriteString(strconv.FormatUint(cumulative, 10))
		b.WriteByte('\n')

		b.WriteString(h.name)
		b.WriteString("_sum")
		b.WriteString(formatLabels(h.labelNames, ls))
		b.WriteByte(' ')
		b.WriteString(strconv.FormatFloat(math.Float64frombits(entry.sumBits.Load()), 'g', -1, 64))
		b.WriteByte('\n')

		b.WriteString(h.name)
		b.WriteString("_count")
		b.WriteString(formatLabels(h.labelNames, ls))
		b.WriteByte(' ')
		b.WriteString(strconv.FormatUint(entry.count.Load(), 10))
		b.WriteByte('\n')
	}
	h.mu.RUnlock()
}

type Observability struct {
	registry *Registry

	HTTPRequestsTotal          *CounterVec
	HTTPRequestDurationSeconds *HistogramVec
	EnrichmentStreamLag        *GaugeVec
	EnrichmentLastSyncAge      *GaugeVec
	ImportFindingsTotal        *CounterVec
	DBPoolConnections          *GaugeVec
	BuildInfo                  *GaugeVec
}

func New(version, commit, date string) *Observability {
	reg := NewRegistry()
	obs := &Observability{
		registry:                   reg,
		HTTPRequestsTotal:          NewCounterVec("redlycoris_http_requests_total", "Total HTTP requests.", "route", "method", "status"),
		HTTPRequestDurationSeconds: NewHistogramVec("redlycoris_http_request_duration_seconds", "HTTP request duration in seconds.", defaultHistogramBuckets, "route", "method"),
		EnrichmentStreamLag:        NewGaugeVec("redlycoris_enrichment_stream_lag", "Redis enrichment stream lag by source.", "source"),
		EnrichmentLastSyncAge:      NewGaugeVec("redlycoris_enrichment_last_sync_age_seconds", "Age in seconds since last successful enrichment sync.", "source"),
		ImportFindingsTotal:        NewCounterVec("redlycoris_import_findings_total", "Total processed imported findings by format/outcome.", "format", "outcome"),
		DBPoolConnections:          NewGaugeVec("redlycoris_db_pool_connections", "Database pool connections by state.", "state"),
		BuildInfo:                  NewGaugeVec("redlycoris_build_info", "Build metadata info metric with constant value 1.", "version", "commit", "date"),
	}

	reg.register(obs.HTTPRequestsTotal)
	reg.register(obs.HTTPRequestDurationSeconds)
	reg.register(obs.EnrichmentStreamLag)
	reg.register(obs.EnrichmentLastSyncAge)
	reg.register(obs.ImportFindingsTotal)
	reg.register(obs.DBPoolConnections)
	reg.register(obs.BuildInfo)

	obs.BuildInfo.Set(map[string]string{"version": version, "commit": commit, "date": date}, 1)
	return obs
}

func (o *Observability) Metrics() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(o.registry.writePrometheusText()))
	})
}

func (o *Observability) RecordHTTPRequest(route, method string, status int, duration time.Duration) {
	labels := map[string]string{
		"route":  route,
		"method": method,
		"status": strconv.Itoa(status),
	}
	o.HTTPRequestsTotal.Inc(labels)
	o.HTTPRequestDurationSeconds.Observe(map[string]string{"route": route, "method": method}, duration.Seconds())
}

func (o *Observability) StartDBPoolMetrics(ctxDone <-chan struct{}, pool *pgxpool.Pool, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		o.collectDBPool(pool)
		for {
			select {
			case <-ctxDone:
				return
			case <-ticker.C:
				o.collectDBPool(pool)
			}
		}
	}()
}

func (o *Observability) collectDBPool(pool *pgxpool.Pool) {
	stats := pool.Stat()
	o.DBPoolConnections.Set(map[string]string{"state": "acquired"}, float64(stats.AcquiredConns()))
	o.DBPoolConnections.Set(map[string]string{"state": "idle"}, float64(stats.IdleConns()))
	o.DBPoolConnections.Set(map[string]string{"state": "total"}, float64(stats.TotalConns()))
}
