package intel

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"red-lycoris/backend/internal/storage"
)

const (
	defaultNVDURL  = "https://services.nvd.nist.gov/rest/json/cves/2.0"
	defaultKEVURL  = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
	defaultEPSSURL = "https://api.first.org/data/v1/epss"
)

type Service struct {
	nvd             *nvdClient
	epss            *epssClient
	kev             *kevClient
	bduEnabled      bool
	db              *sql.DB
	refreshInterval time.Duration
}

type Config struct {
	NVDAPIKey           string
	EPSSDisabled        bool
	KEVURL              string
	KEVMirrorURL        string
	BDUEnabled          bool
	DB                  *sql.DB
	RefreshInterval     time.Duration
	ProviderConcurrency int
}

func NewService(cfg Config) *Service {
	client := &http.Client{Timeout: 20 * time.Second}
	concurrency := cfg.ProviderConcurrency
	if concurrency <= 0 {
		concurrency = 4
	}

	return &Service{
		nvd: &nvdClient{
			baseURL: defaultNVDURL,
			apiKey:  cfg.NVDAPIKey,
			client:  client,
			sem:     make(chan struct{}, concurrency),
		},
		epss: &epssClient{
			baseURL:  defaultEPSSURL,
			disabled: cfg.EPSSDisabled,
			client:   client,
			sem:      make(chan struct{}, concurrency),
		},
		kev:             newKEVClient(client, cfg.KEVURL, cfg.KEVMirrorURL, concurrency),
		bduEnabled:      cfg.BDUEnabled,
		db:              cfg.DB,
		refreshInterval: cfg.RefreshInterval,
	}
}

func (s *Service) ShouldRefresh(status *storage.VulnIntelStatus, now time.Time) bool {
	if status == nil {
		return true
	}
	if status.NextRetryAt.Valid && now.Before(status.NextRetryAt.Time) {
		return false
	}
	// Force re-enrichment when BDU is enabled but the record has no BDU data yet.
	if s.bduEnabled && !status.HasBDUPayload {
		return true
	}
	if status.LastRefreshedAt.Valid && s.refreshInterval > 0 {
		next := status.LastRefreshedAt.Time.Add(s.refreshInterval)
		return now.After(next)
	}
	return true
}

func (s *Service) Enrich(ctx context.Context, identifier string) (storage.VulnIntelRecord, bool, error) {
	record := storage.VulnIntelRecord{
		Identifier:    identifier,
		SourceVersion: "v1",
	}

	// CWE identifiers: only BDU FSTEC can be queried (NVD/EPSS/KEV require CVE).
	if IsCWE(identifier) {
		bduPayload, bduRefs := s.enrichBDULocal(ctx, identifier)
		if bduPayload != nil {
			record.BDUPayload = bduPayload
			record.References = dedupeReferences(bduRefs)
		}
		return record, false, nil
	}

	if !IsCVE(identifier) {
		return record, true, nil
	}

	var references []storage.IntelReference
	var cvssScore *float64
	var cvssVersion *string
	var epssScore *float64
	var epssPercentile *float64
	var kev bool

	nvdPayload, nvdRefs, score, version, err := s.nvd.fetch(ctx, identifier)
	if err != nil {
		return record, false, err
	}
	record.NVDPayload = nvdPayload
	references = append(references, nvdRefs...)
	cvssScore = score
	cvssVersion = version

	epssPayload, epssScoreValue, epssPercentileValue, err := s.epss.fetch(ctx, identifier)
	if err != nil {
		return record, false, err
	}
	record.EPSSPayload = epssPayload
	if epssScoreValue != nil {
		epssScore = epssScoreValue
	}
	if epssPercentileValue != nil {
		epssPercentile = epssPercentileValue
	}

	kevPayload, kevRefs, kevFound, err := s.kev.fetch(ctx, identifier)
	if err != nil {
		return record, false, err
	}
	if kevFound {
		kev = true
		record.KEVPayload = kevPayload
		references = append(references, kevRefs...)
	}

	// BDU: use only local database populated from vullist.xlsx.
	bduPayload, bduRefs := s.enrichBDULocal(ctx, identifier)
	if bduPayload != nil {
		record.BDUPayload = bduPayload
		references = append(references, bduRefs...)
	}

	record.References = dedupeReferences(references)
	record.CVSSScore = cvssScore
	record.CVSSVersion = cvssVersion
	record.EPSSScore = epssScore
	record.EPSSPercentile = epssPercentile
	record.KEV = kev
	return record, false, nil
}

// enrichBDULocal queries the local bdu_vulnerabilities table for the identifier.
func (s *Service) enrichBDULocal(ctx context.Context, identifier string) (json.RawMessage, []storage.IntelReference) {
	if s.db == nil || !s.bduEnabled {
		return nil, nil
	}

	vulns, err := storage.GetBDUByIdentifiers(ctx, s.db, []string{identifier})
	if err != nil {
		log.Printf("bdu local lookup error for %s: %v", identifier, err)
		return nil, nil
	}
	if len(vulns) == 0 {
		return nil, nil
	}

	log.Printf("bdu local: found %d records for %s", len(vulns), identifier)

	if len(vulns) == 1 {
		payload, err := json.Marshal(vulns[0])
		if err != nil {
			return nil, nil
		}
		title := "BDU"
		refs := []storage.IntelReference{{Title: &title, URL: "https://bdu.fstec.ru/vul/" + strings.TrimPrefix(vulns[0].BDUID, "BDU:")}}
		return payload, refs
	}

	// Multiple results (common for CWE).
	payload, err := json.Marshal(vulns)
	if err != nil {
		return nil, nil
	}
	var refs []storage.IntelReference
	title := "BDU"
	for _, v := range vulns {
		refs = append(refs, storage.IntelReference{Title: &title, URL: "https://bdu.fstec.ru/vul/" + strings.TrimPrefix(v.BDUID, "BDU:")})
	}
	return payload, refs
}

func dedupeReferences(refs []storage.IntelReference) []storage.IntelReference {
	if len(refs) == 0 {
		return nil
	}
	seen := map[string]storage.IntelReference{}
	for _, ref := range refs {
		if ref.URL == "" {
			continue
		}
		seen[ref.URL] = ref
	}
	result := make([]storage.IntelReference, 0, len(seen))
	for _, ref := range seen {
		result = append(result, ref)
	}
	return result
}

type nvdClient struct {
	baseURL string
	apiKey  string
	client  *http.Client
	sem     chan struct{}
}

type epssClient struct {
	baseURL  string
	disabled bool
	client   *http.Client
	sem      chan struct{}
}

type kevClient struct {
	url       string
	mirrorURL string
	client    *http.Client
	sem       chan struct{}
	mu        sync.Mutex
	cache     *kevCache
}

type kevCache struct {
	fetchedAt time.Time
	entries   map[string]json.RawMessage
}

func newKEVClient(client *http.Client, url, mirror string, concurrency int) *kevClient {
	if url == "" {
		url = defaultKEVURL
	}
	return &kevClient{
		url:       url,
		mirrorURL: mirror,
		client:    client,
		sem:       make(chan struct{}, concurrency),
	}
}

func (c *nvdClient) fetch(ctx context.Context, identifier string) (json.RawMessage, []storage.IntelReference, *float64, *string, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"?cveId="+identifier, nil)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("apiKey", c.apiKey)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return nil, nil, nil, nil, fmt.Errorf("nvd error: %s", resp.Status)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, nil, nil, nil, fmt.Errorf("nvd error: %s", resp.Status)
	}

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	cvssScore, cvssVersion, references := parseNVD(payload)
	return payload, references, cvssScore, cvssVersion, nil
}

func (c *epssClient) fetch(ctx context.Context, identifier string) (json.RawMessage, *float64, *float64, error) {
	if c.disabled {
		return nil, nil, nil, nil
	}
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"?cve="+identifier, nil)
	if err != nil {
		return nil, nil, nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return nil, nil, nil, fmt.Errorf("epss error: %s", resp.Status)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, nil, nil, fmt.Errorf("epss error: %s", resp.Status)
	}

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, nil, err
	}
	score, percentile := parseEPSS(payload)
	return payload, score, percentile, nil
}

func (c *kevClient) fetch(ctx context.Context, identifier string) (json.RawMessage, []storage.IntelReference, bool, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	entries, err := c.load(ctx)
	if err != nil {
		log.Printf("kev fetch warning: %v", err)
		return nil, nil, false, nil
	}
	entry, ok := entries[identifier]
	if !ok {
		return nil, nil, false, nil
	}
	references := []storage.IntelReference{
		{
			Title: ptrString("CISA KEV"),
			URL:   c.url,
		},
	}
	return entry, references, true, nil
}

func (c *kevClient) load(ctx context.Context) (map[string]json.RawMessage, error) {
	c.mu.Lock()
	if c.cache != nil && time.Since(c.cache.fetchedAt) < 6*time.Hour {
		entries := c.cache.entries
		c.mu.Unlock()
		return entries, nil
	}
	c.mu.Unlock()

	payload, err := fetchWithFallback(ctx, c.client, c.url, c.mirrorURL)
	if err != nil {
		return nil, err
	}

	entries, err := parseKEV(payload)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.cache = &kevCache{fetchedAt: time.Now(), entries: entries}
	c.mu.Unlock()

	return entries, nil
}

func fetchWithFallback(ctx context.Context, client *http.Client, url, mirror string) ([]byte, error) {
	payload, status, err := fetchURL(ctx, client, url)
	if err == nil && status == http.StatusOK {
		return payload, nil
	}
	if mirror == "" {
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("kev error: %s", http.StatusText(status))
	}
	log.Printf("kev primary url failed: %v (status %d), trying mirror", err, status)
	payload, status, err = fetchURL(ctx, client, mirror)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("kev mirror error: %s", http.StatusText(status))
	}
	return payload, nil
}

func fetchURL(ctx context.Context, client *http.Client, url string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	payload, err := io.ReadAll(resp.Body)
	return payload, resp.StatusCode, err
}

func parseNVD(payload []byte) (*float64, *string, []storage.IntelReference) {
	var resp struct {
		Vulnerabilities []struct {
			CVE struct {
				ID         string `json:"id"`
				References []struct {
					URL  string `json:"url"`
					Name string `json:"name"`
				} `json:"references"`
				Metrics map[string][]struct {
					CVSSData struct {
						BaseScore float64 `json:"baseScore"`
						Version   string  `json:"version"`
					} `json:"cvssData"`
				} `json:"metrics"`
			} `json:"cve"`
		} `json:"vulnerabilities"`
	}
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, nil, nil
	}
	var (
		score   *float64
		version *string
	)
	references := []storage.IntelReference{}
	for _, vuln := range resp.Vulnerabilities {
		for _, ref := range vuln.CVE.References {
			if ref.URL == "" {
				continue
			}
			title := strings.TrimSpace(ref.Name)
			var titlePtr *string
			if title != "" {
				titlePtr = &title
			}
			references = append(references, storage.IntelReference{
				Title: titlePtr,
				URL:   ref.URL,
			})
		}
		bestScore, bestVersion := pickCVSS(vuln.CVE.Metrics)
		if bestScore != nil {
			score = bestScore
			version = bestVersion
			break
		}
	}
	return score, version, references
}

func pickCVSS(metrics map[string][]struct {
	CVSSData struct {
		BaseScore float64 `json:"baseScore"`
		Version   string  `json:"version"`
	} `json:"cvssData"`
}) (*float64, *string) {
	best := -1.0
	var bestVersion string
	for _, entries := range metrics {
		for _, metric := range entries {
			score := metric.CVSSData.BaseScore
			if score > best {
				best = score
				bestVersion = metric.CVSSData.Version
			}
		}
	}
	if best < 0 {
		return nil, nil
	}
	return &best, &bestVersion
}

func parseEPSS(payload []byte) (*float64, *float64) {
	var resp struct {
		Data []struct {
			Score      string `json:"epss"`
			Percentile string `json:"percentile"`
		} `json:"data"`
	}
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, nil
	}
	if len(resp.Data) == 0 {
		return nil, nil
	}
	score := parseFloat(resp.Data[0].Score)
	percentile := parseFloat(resp.Data[0].Percentile)
	return score, percentile
}

func parseKEV(payload []byte) (map[string]json.RawMessage, error) {
	var resp struct {
		Vulnerabilities []json.RawMessage `json:"vulnerabilities"`
	}
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, err
	}
	entries := map[string]json.RawMessage{}
	for _, entry := range resp.Vulnerabilities {
		var item struct {
			CVEID string `json:"cveID"`
		}
		if err := json.Unmarshal(entry, &item); err != nil {
			continue
		}
		if item.CVEID == "" {
			continue
		}
		entries[strings.ToUpper(item.CVEID)] = entry
	}
	return entries, nil
}

func parseFloat(raw string) *float64 {
	if raw == "" {
		return nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil
	}
	return &value
}

func ptrString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
