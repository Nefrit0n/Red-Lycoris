package intel

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
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
	defaultBDUURL  = ""
)

type Service struct {
	nvd             *nvdClient
	epss            *epssClient
	kev             *kevClient
	bdu             *bduClient
	refreshInterval time.Duration
}

type Config struct {
	NVDAPIKey           string
	EPSSDisabled        bool
	KEVURL              string
	KEVMirrorURL        string
	BDUEnabled          bool
	BDUURL              string
	BDUMirrorURL        string
	BDUTimeout          time.Duration
	RefreshInterval     time.Duration
	ProviderConcurrency int
}

func NewService(cfg Config) *Service {
	client := &http.Client{Timeout: 20 * time.Second}
	bduTimeout := cfg.BDUTimeout
	if bduTimeout <= 0 {
		bduTimeout = 20 * time.Second
	}
	bduHTTPClient := &http.Client{Timeout: bduTimeout}
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
		bdu:             newBDUClient(bduHTTPClient, cfg.BDUEnabled, cfg.BDUURL, cfg.BDUMirrorURL, concurrency),
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

	if s.bdu != nil {
		bduPayload, bduRefs, bduFound, err := s.bdu.fetch(ctx, identifier)
		if err != nil {
			return record, false, err
		}
		if bduFound {
			record.BDUPayload = bduPayload
			references = append(references, bduRefs...)
		}
	}

	record.References = dedupeReferences(references)
	record.CVSSScore = cvssScore
	record.CVSSVersion = cvssVersion
	record.EPSSScore = epssScore
	record.EPSSPercentile = epssPercentile
	record.KEV = kev
	return record, false, nil
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

type bduClient struct {
	url       string
	mirrorURL string
	disabled  bool
	client    *http.Client
	sem       chan struct{}
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

func newBDUClient(client *http.Client, enabled bool, url, mirror string, concurrency int) *bduClient {
	if url == "" {
		url = defaultBDUURL
	}
	return &bduClient{
		url:       url,
		mirrorURL: mirror,
		disabled:  !enabled || url == "",
		client:    client,
		sem:       make(chan struct{}, concurrency),
	}
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

func (c *bduClient) fetch(ctx context.Context, identifier string) (json.RawMessage, []storage.IntelReference, bool, error) {
	if c == nil || c.disabled {
		return nil, nil, false, nil
	}
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	for _, queryKey := range []string{"cve", "cveId", "identifier"} {
		payload, err := fetchWithFallback(ctx, c.client, c.requestURL(identifier, queryKey), c.requestMirrorURL(identifier, queryKey))
		if err != nil {
			continue
		}
		normalized, refs, found := parseBDU(payload, identifier)
		if found {
			return normalized, refs, true, nil
		}
	}
	log.Printf("bdu fetch warning: no matching entry found for %s", identifier)
	return nil, nil, false, nil
}

func (c *bduClient) requestURL(identifier string, queryKey string) string {
	if strings.Contains(c.url, "{cve}") {
		return strings.ReplaceAll(c.url, "{cve}", identifier)
	}
	sep := "?"
	if strings.Contains(c.url, "?") {
		sep = "&"
	}
	return c.url + sep + queryKey + "=" + identifier
}

func (c *bduClient) requestMirrorURL(identifier string, queryKey string) string {
	if c.mirrorURL == "" {
		return ""
	}
	if strings.Contains(c.mirrorURL, "{cve}") {
		return strings.ReplaceAll(c.mirrorURL, "{cve}", identifier)
	}
	sep := "?"
	if strings.Contains(c.mirrorURL, "?") {
		sep = "&"
	}
	return c.mirrorURL + sep + queryKey + "=" + identifier
}

func parseBDU(payload []byte, identifier string) (json.RawMessage, []storage.IntelReference, bool) {
	var root any
	if err := json.Unmarshal(payload, &root); err != nil {
		return nil, nil, false
	}
	entry, ok := findBDUEntry(root, strings.ToUpper(identifier))
	if !ok {
		return nil, nil, false
	}
	normalized := normalizeBDUEntry(entry, strings.ToUpper(identifier))
	b, err := json.Marshal(normalized)
	if err != nil {
		return nil, nil, false
	}
	return b, collectBDUReferences(normalized), true
}

func findBDUEntry(root any, identifier string) (map[string]any, bool) {
	var walk func(any) (map[string]any, bool)
	walk = func(node any) (map[string]any, bool) {
		switch v := node.(type) {
		case map[string]any:
			if matchesBDUIdentifier(v, identifier) {
				return v, true
			}
			for _, nested := range v {
				if found, ok := walk(nested); ok {
					return found, true
				}
			}
		case []any:
			for _, item := range v {
				if found, ok := walk(item); ok {
					return found, true
				}
			}
		}
		return nil, false
	}
	return walk(root)
}

func matchesBDUIdentifier(entry map[string]any, identifier string) bool {
	for _, key := range []string{"cve", "cve_id", "cveId", "cveID", "CVE", "identifier", "vulnerability_id"} {
		if v, ok := entry[key].(string); ok && strings.EqualFold(strings.TrimSpace(v), identifier) {
			return true
		}
	}
	for _, extKey := range []string{"external_ids", "identifiers"} {
		if ext, ok := entry[extKey].(map[string]any); ok {
			for _, item := range ext {
				if containsIdentifier(item, identifier) {
					return true
				}
			}
		}
	}
	if aliases, ok := entry["aliases"]; ok {
		return containsIdentifier(aliases, identifier)
	}
	return false
}

func containsIdentifier(value any, identifier string) bool {
	switch vv := value.(type) {
	case string:
		return strings.EqualFold(strings.TrimSpace(vv), identifier)
	case []any:
		for _, item := range vv {
			if containsIdentifier(item, identifier) {
				return true
			}
		}
	case map[string]any:
		for _, item := range vv {
			if containsIdentifier(item, identifier) {
				return true
			}
		}
	}
	return false
}

func normalizeBDUEntry(entry map[string]any, identifier string) map[string]any {
	normalized := map[string]any{
		"identifier": identifier,
	}
	if description := firstString(entry, "description", "summary", "details"); description != "" {
		normalized["description"] = sanitizePlainText(description)
	}
	normalized["cvss"] = normalizeCVSS(entry)
	normalized["cwe"] = uniqueStrings(flattenStrings(firstAny(entry, "cwe", "cwes", "weaknesses")))
	normalized["affected_software"] = normalizeAffectedSoftware(firstAny(entry, "affected_software", "affected", "products", "software"))
	normalized["remediation_steps"] = uniqueStrings(flattenStrings(firstAny(entry, "remediation", "solution", "mitigation", "recommendations")))
	severity := sanitizePlainText(firstString(entry, "severity", "level", "threat_level"))
	if severity != "" {
		normalized["severity"] = severity
	}
	status := map[string]any{}
	if v := firstString(entry, "status", "state"); v != "" {
		status["value"] = sanitizePlainText(v)
	}
	if v := firstString(entry, "published", "published_at", "date_published"); v != "" {
		status["published_at"] = sanitizePlainText(v)
	}
	if v := firstString(entry, "updated", "modified", "updated_at", "date_updated"); v != "" {
		status["updated_at"] = sanitizePlainText(v)
	}
	normalized["status"] = status
	normalized["external_ids"] = normalizeExternalIDs(entry, identifier)
	normalized["references"] = normalizeReferences(firstAny(entry, "references", "links", "urls", "sources"))
	return normalized
}

func collectBDUReferences(normalized map[string]any) []storage.IntelReference {
	raw, ok := normalized["references"]
	if !ok {
		return nil
	}
	refs := make([]storage.IntelReference, 0)
	if list, ok := raw.([]map[string]string); ok {
		for _, ref := range list {
			url := strings.TrimSpace(ref["url"])
			if url == "" {
				continue
			}
			title := strings.TrimSpace(ref["title"])
			var titlePtr *string
			if title != "" {
				titlePtr = &title
			}
			refs = append(refs, storage.IntelReference{Title: titlePtr, URL: url})
		}
		return refs
	}
	if list, ok := raw.([]any); ok {
		for _, item := range list {
			if ref, ok := item.(map[string]any); ok {
				url := sanitizePlainText(firstString(ref, "url"))
				if url == "" {
					continue
				}
				title := sanitizePlainText(firstString(ref, "title"))
				var titlePtr *string
				if title != "" {
					titlePtr = &title
				}
				refs = append(refs, storage.IntelReference{Title: titlePtr, URL: url})
			}
		}
	}
	return refs
}

var htmlTagRegex = regexp.MustCompile(`<[^>]+>`)

func sanitizePlainText(value string) string {
	clean := htmlTagRegex.ReplaceAllString(value, "")
	clean = strings.ReplaceAll(clean, "\r\n", "\n")
	clean = strings.TrimSpace(clean)
	return clean
}

func firstString(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func firstAny(m map[string]any, keys ...string) any {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			return v
		}
	}
	return nil
}

func flattenStrings(value any) []string {
	result := make([]string, 0)
	var walk func(any)
	walk = func(v any) {
		switch vv := v.(type) {
		case string:
			if s := sanitizePlainText(vv); s != "" {
				result = append(result, s)
			}
		case []any:
			for _, item := range vv {
				walk(item)
			}
		case map[string]any:
			for _, key := range []string{"value", "name", "description", "id", "text"} {
				if nested, ok := vv[key]; ok {
					walk(nested)
				}
			}
		}
	}
	walk(value)
	return result
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeCVSS(entry map[string]any) map[string]any {
	cvss := map[string]any{}
	if raw := firstAny(entry, "cvss2", "cvss_v2"); raw != nil {
		cvss["v2"] = raw
	}
	if raw := firstAny(entry, "cvss3", "cvss_v3", "cvss"); raw != nil {
		cvss["v3"] = raw
	}
	if raw := firstAny(entry, "cvss4", "cvss_v4"); raw != nil {
		cvss["v4"] = raw
	}
	return cvss
}

func normalizeAffectedSoftware(value any) []map[string]string {
	rows := make([]map[string]string, 0)
	list, ok := value.([]any)
	if !ok {
		return rows
	}
	for _, item := range list {
		rec, ok := item.(map[string]any)
		if !ok {
			continue
		}
		row := map[string]string{
			"vendor":   sanitizePlainText(firstString(rec, "vendor", "vendor_project", "supplier")),
			"product":  sanitizePlainText(firstString(rec, "product", "name", "software")),
			"version":  sanitizePlainText(firstString(rec, "version", "affected_version", "versions")),
			"type":     sanitizePlainText(firstString(rec, "type", "category")),
			"platform": sanitizePlainText(firstString(rec, "platform", "os", "environment")),
		}
		rows = append(rows, row)
	}
	return rows
}

func normalizeExternalIDs(entry map[string]any, identifier string) map[string][]string {
	result := map[string][]string{"cve": []string{identifier}}
	for _, key := range []string{"external_ids", "identifiers"} {
		raw, ok := entry[key].(map[string]any)
		if !ok {
			continue
		}
		for k, value := range raw {
			normalizedKey := strings.ToLower(strings.TrimSpace(k))
			vals := uniqueStrings(flattenStrings(value))
			if len(vals) > 0 {
				result[normalizedKey] = vals
			}
		}
	}
	if aliases := uniqueStrings(flattenStrings(entry["aliases"])); len(aliases) > 0 {
		result["aliases"] = aliases
	}
	return result
}

func normalizeReferences(value any) []map[string]string {
	result := make([]map[string]string, 0)
	appendRef := func(url, title string) {
		url = sanitizePlainText(url)
		if url == "" {
			return
		}
		result = append(result, map[string]string{
			"url":   url,
			"title": sanitizePlainText(title),
		})
	}
	switch vv := value.(type) {
	case []any:
		for _, item := range vv {
			switch ref := item.(type) {
			case string:
				appendRef(ref, "BDU")
			case map[string]any:
				appendRef(firstString(ref, "url", "href", "link"), firstString(ref, "title", "name"))
			}
		}
	case map[string]any:
		appendRef(firstString(vv, "url", "href", "link"), firstString(vv, "title", "name"))
	case string:
		appendRef(vv, "BDU")
	}
	return result
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
