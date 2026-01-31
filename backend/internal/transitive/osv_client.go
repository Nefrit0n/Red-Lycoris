package transitive

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrOsvUnreachable = errors.New("osv unreachable")

const defaultOsvBaseURL = "https://api.osv.dev"

type OsvOptions struct {
	BaseURL     string
	Timeout     time.Duration
	MaxRetries  int
	Concurrency int
	BatchSize   int
}

type OsvClient struct {
	baseURL     string
	client      *http.Client
	maxRetries  int
	concurrency int
	batchSize   int

	mu        sync.Mutex
	vulnCache map[string]osvVulnDetail
}

type OsvComponent struct {
	ComponentID uuid.UUID
	Purl        string
	Version     string
}

type ComponentVuln struct {
	ComponentID  uuid.UUID
	Identifier   string
	Severity     string
	CvssScore    *float64
	EpssScore    *float64
	FixedVersion *string
	Source       string
}

func NewOsvClient(opts OsvOptions) *OsvClient {
	if opts.BaseURL == "" {
		opts.BaseURL = defaultOsvBaseURL
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 15 * time.Second
	}
	if opts.MaxRetries <= 0 {
		opts.MaxRetries = 2
	}
	if opts.Concurrency <= 0 {
		opts.Concurrency = 8
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = 100
	}

	return &OsvClient{
		baseURL:     strings.TrimRight(opts.BaseURL, "/"),
		client:      &http.Client{Timeout: opts.Timeout},
		maxRetries:  opts.MaxRetries,
		concurrency: opts.Concurrency,
		batchSize:   opts.BatchSize,
		vulnCache:   make(map[string]osvVulnDetail),
	}
}

type osvQueryBatchRequest struct {
	Queries []osvQuery `json:"queries"`
}

type osvQuery struct {
	Package osvPackage `json:"package"`
	Version string     `json:"version,omitempty"`
}

type osvPackage struct {
	Purl string `json:"purl"`
}

type osvQueryBatchResponse struct {
	Results []osvQueryResult `json:"results"`
}

type osvQueryResult struct {
	Vulns []osvVuln `json:"vulns"`
}

type osvVuln struct {
	ID               string              `json:"id"`
	Aliases          []string            `json:"aliases"`
	Severity         []osvSeverity       `json:"severity"`
	DatabaseSpecific osvDatabaseSpecific `json:"database_specific"`
}

type osvSeverity struct {
	Type  string `json:"type"`
	Score string `json:"score"`
}

type osvDatabaseSpecific struct {
	Severity string `json:"severity"`
}

type osvVulnDetail struct {
	ID               string              `json:"id"`
	Aliases          []string            `json:"aliases"`
	Severity         []osvSeverity       `json:"severity"`
	DatabaseSpecific osvDatabaseSpecific `json:"database_specific"`
}

func (c *OsvClient) QueryComponents(ctx context.Context, components []OsvComponent) ([]ComponentVuln, error) {
	if len(components) == 0 {
		return nil, nil
	}

	results := make([]ComponentVuln, 0)
	for start := 0; start < len(components); start += c.batchSize {
		end := start + c.batchSize
		if end > len(components) {
			end = len(components)
		}

		batch := components[start:end]
		queries := make([]osvQuery, 0, len(batch))
		for _, comp := range batch {
			version := comp.Version
			if purlHasVersion(comp.Purl) {
				version = ""
			}
			queries = append(queries, osvQuery{
				Package: osvPackage{Purl: comp.Purl},
				Version: version,
			})
		}

		batchResp, err := c.queryBatch(ctx, queries)
		if err != nil {
			return nil, err
		}
		if len(batchResp.Results) != len(batch) {
			return nil, fmt.Errorf("unexpected osv response size")
		}

		vulnIDs := make(map[string]struct{})
		for _, res := range batchResp.Results {
			for _, vuln := range res.Vulns {
				if vuln.ID != "" {
					vulnIDs[vuln.ID] = struct{}{}
				}
			}
		}

		if err := c.ensureVulnDetails(ctx, vulnIDs); err != nil {
			return nil, err
		}

		for idx, res := range batchResp.Results {
			component := batch[idx]
			for _, vuln := range res.Vulns {
				detail := c.getCachedVuln(vuln.ID)
				identifier := pickIdentifier(vuln.ID, vuln.Aliases, detail.Aliases)
				severity, cvss := deriveSeverity(vuln, detail)
				results = append(results, ComponentVuln{
					ComponentID:  component.ComponentID,
					Identifier:   identifier,
					Severity:     severity,
					CvssScore:    cvss,
					EpssScore:    nil,
					FixedVersion: nil,
					Source:       "osv",
				})
			}
		}
	}

	return results, nil
}

func purlHasVersion(purl string) bool {
	if purl == "" {
		return false
	}

	trimmed := purl
	if queryIndex := strings.Index(trimmed, "?"); queryIndex != -1 {
		trimmed = trimmed[:queryIndex]
	}

	return strings.Contains(trimmed, "@")
}

func (c *OsvClient) queryBatch(ctx context.Context, queries []osvQuery) (*osvQueryBatchResponse, error) {
	payload, err := json.Marshal(osvQueryBatchRequest{Queries: queries})
	if err != nil {
		return nil, fmt.Errorf("marshal osv query failed: %w", err)
	}

	resp, err := c.doRequest(ctx, http.MethodPost, "/v1/querybatch", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("osv query failed: %s", strings.TrimSpace(string(body)))
	}

	var batchResp osvQueryBatchResponse
	if err := json.NewDecoder(resp.Body).Decode(&batchResp); err != nil {
		return nil, fmt.Errorf("decode osv query failed: %w", err)
	}

	return &batchResp, nil
}

func (c *OsvClient) ensureVulnDetails(ctx context.Context, ids map[string]struct{}) error {
	missing := make([]string, 0)
	for id := range ids {
		if id == "" {
			continue
		}
		if !c.hasCachedVuln(id) {
			missing = append(missing, id)
		}
	}
	if len(missing) == 0 {
		return nil
	}

	sem := make(chan struct{}, c.concurrency)
	errCh := make(chan error, len(missing))
	var wg sync.WaitGroup

	for _, id := range missing {
		wg.Add(1)
		go func(vulnID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			detail, err := c.fetchVuln(ctx, vulnID)
			if err != nil {
				errCh <- err
				return
			}
			c.setCachedVuln(vulnID, detail)
		}(id)
	}

	wg.Wait()
	close(errCh)
	for err := range errCh {
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *OsvClient) fetchVuln(ctx context.Context, id string) (osvVulnDetail, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/v1/vulns/"+id, nil)
	if err != nil {
		return osvVulnDetail{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return osvVulnDetail{ID: id}, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return osvVulnDetail{}, fmt.Errorf("osv vuln fetch failed: %s", strings.TrimSpace(string(body)))
	}

	var detail osvVulnDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return osvVulnDetail{}, fmt.Errorf("decode osv vuln failed: %w", err)
	}
	return detail, nil
}

func (c *OsvClient) doRequest(ctx context.Context, method string, path string, body []byte) (*http.Response, error) {
	url := c.baseURL + path
	var lastErr error

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		var bodyReader io.Reader
		if body != nil {
			bodyReader = bytes.NewReader(body)
		}
		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req)
		if err == nil {
			if resp.StatusCode < 500 && resp.StatusCode != http.StatusTooManyRequests {
				return resp, nil
			}
			_ = resp.Body.Close()
			lastErr = fmt.Errorf("osv server error: %s", resp.Status)
		} else {
			lastErr = err
		}

		if attempt < c.maxRetries {
			sleep := time.Duration(250*(attempt+1)) * time.Millisecond
			timer := time.NewTimer(sleep)
			select {
			case <-ctx.Done():
				timer.Stop()
				return nil, ctx.Err()
			case <-timer.C:
			}
		}
	}

	if lastErr != nil {
		return nil, wrapOsvError(lastErr)
	}
	return nil, ErrOsvUnreachable
}

func wrapOsvError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %v", ErrOsvUnreachable, err)
}

func (c *OsvClient) hasCachedVuln(id string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.vulnCache[id]
	return ok
}

func (c *OsvClient) getCachedVuln(id string) osvVulnDetail {
	c.mu.Lock()
	defer c.mu.Unlock()
	if v, ok := c.vulnCache[id]; ok {
		return v
	}
	return osvVulnDetail{ID: id}
}

func (c *OsvClient) setCachedVuln(id string, detail osvVulnDetail) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.vulnCache[id] = detail
}

func pickIdentifier(defaultID string, aliases ...[]string) string {
	for _, list := range aliases {
		for _, alias := range list {
			if strings.HasPrefix(strings.ToUpper(alias), "CVE-") {
				return alias
			}
		}
	}
	return defaultID
}

func deriveSeverity(vuln osvVuln, detail osvVulnDetail) (string, *float64) {
	severity := normalizeSeverity(detail.DatabaseSpecific.Severity)
	if severity == "" {
		severity = normalizeSeverity(vuln.DatabaseSpecific.Severity)
	}

	cvss := parseCvssScore(vuln.Severity)
	if cvss == nil {
		cvss = parseCvssScore(detail.Severity)
	}

	if severity == "" && cvss != nil {
		severity = severityFromCvss(*cvss)
	}
	if severity == "" {
		severity = "low"
	}
	return severity, cvss
}

func normalizeSeverity(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	switch value {
	case "critical", "high", "medium", "low":
		return value
	default:
		return ""
	}
}

func parseCvssScore(values []osvSeverity) *float64 {
	var maxScore *float64
	for _, entry := range values {
		if entry.Score == "" {
			continue
		}
		score, err := strconv.ParseFloat(entry.Score, 64)
		if err != nil {
			continue
		}
		if maxScore == nil || score > *maxScore {
			maxScore = &score
		}
	}
	return maxScore
}

func severityFromCvss(score float64) string {
	switch {
	case score >= 9.0:
		return "critical"
	case score >= 7.0:
		return "high"
	case score >= 4.0:
		return "medium"
	default:
		return "low"
	}
}
