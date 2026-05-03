package cwe

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const cweURL = "https://cwe.mitre.org/data/xml/cwec_latest.xml.zip"

type CWESyncer struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewSyncer(pool *pgxpool.Pool) *CWESyncer {
	return &CWESyncer{
		pool:   pool,
		client: &http.Client{Timeout: 5 * time.Minute},
	}
}

func (s *CWESyncer) Name() string { return "cwe" }

func (s *CWESyncer) Sync(ctx context.Context) error {
	body, err := s.downloadWithRetry(ctx, cweURL)
	if err != nil {
		return fmt.Errorf("cwe.Sync: download: %w", err)
	}

	xmlData, err := extractZIP(body)
	if err != nil {
		return fmt.Errorf("cwe.Sync: extract zip: %w", err)
	}

	records, err := parseXML(xmlData)
	if err != nil {
		return fmt.Errorf("cwe.Sync: parse xml: %w", err)
	}

	if len(records) == 0 {
		return fmt.Errorf("cwe.Sync: parsed zero records")
	}

	if err := s.upsert(ctx, records); err != nil {
		return fmt.Errorf("cwe.Sync: upsert: %w", err)
	}

	slog.Info("CWE sync: imported records", "count", len(records))
	return nil
}

func (s *CWESyncer) downloadWithRetry(ctx context.Context, url string) ([]byte, error) {
	const maxRetries = 4

	for attempt := 0; attempt < maxRetries; attempt++ {
		body, retryable, retryAfter, err := s.downloadOnce(ctx, url)
		if err == nil {
			return body, nil
		}

		if !retryable || attempt == maxRetries-1 {
			return nil, err
		}

		backoff := retryAfter
		if backoff <= 0 {
			backoff = defaultBackoff(attempt)
		}

		slog.Warn("CWE download failed, retrying",
			"url", url,
			"attempt", attempt+1,
			"backoff", backoff,
			"error", err,
		)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}
	}

	return nil, fmt.Errorf("unreachable")
}

func (s *CWESyncer) downloadOnce(ctx context.Context, url string) ([]byte, bool, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, false, 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Accept", "application/zip, application/octet-stream, */*")
	req.Header.Set("User-Agent", "redlycoris/1.0")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, true, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, true, 0, fmt.Errorf("read body: %w", readErr)
	}

	switch resp.StatusCode {
	case http.StatusOK:
		return body, false, 0, nil
	case http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return nil, true, parseRetryAfter(resp.Header.Get("Retry-After")), fmt.Errorf(
			"transient status %d, body=%q",
			resp.StatusCode,
			bodyPreview(body, 512),
		)
	default:
		return nil, false, 0, fmt.Errorf(
			"unexpected status %d, body=%q",
			resp.StatusCode,
			bodyPreview(body, 512),
		)
	}
}

func defaultBackoff(attempt int) time.Duration {
	steps := []time.Duration{
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		16 * time.Second,
	}
	if attempt < len(steps) {
		return steps[attempt]
	}
	return 16 * time.Second
}

func parseRetryAfter(value string) time.Duration {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}

	if seconds, err := strconv.Atoi(value); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}

	if t, err := http.ParseTime(value); err == nil {
		d := time.Until(t)
		if d > 0 {
			return d
		}
	}

	return 0
}

func bodyPreview(body []byte, limit int) string {
	if len(body) == 0 {
		return ""
	}
	if len(body) > limit {
		return string(body[:limit])
	}
	return string(body)
}

func extractZIP(data []byte) ([]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	for _, f := range r.File {
		if !strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("open %s: %w", f.Name, err)
		}
		data, err := io.ReadAll(rc)
		_ = rc.Close()
		return data, err
	}
	return nil, fmt.Errorf("no XML file found in ZIP")
}

// --- XML structures для CWE ---

type weaknessCatalog struct {
	XMLName    xml.Name      `xml:"Weakness_Catalog"`
	Weaknesses []xmlWeakness `xml:"Weaknesses>Weakness"`
}

type xmlWeakness struct {
	ID                   string               `xml:"ID,attr"`
	Name                 string               `xml:"Name,attr"`
	Abstraction          string               `xml:"Abstraction,attr"`
	Description          string               `xml:"Description"`
	ExtendedDescription  xmlStructuredText    `xml:"Extended_Description"`
	RelatedWeaknesses    []xmlRelatedWeakness `xml:"Related_Weaknesses>Related_Weakness"`
	LikelihoodOfExploit  string               `xml:"Likelihood_Of_Exploit"`
	CommonConsequences   []xmlConsequence     `xml:"Common_Consequences>Consequence"`
	PotentialMitigations []xmlMitigation      `xml:"Potential_Mitigations>Mitigation"`
}

type xmlStructuredText struct {
	Content string `xml:",innerxml"`
}

type xmlRelatedWeakness struct {
	Nature string `xml:"Nature,attr"`
	CWEID  string `xml:"CWE_ID,attr"`
}

type xmlConsequence struct {
	Scope  []string `xml:"Scope"`
	Impact []string `xml:"Impact"`
	Note   string   `xml:"Note"`
}

type xmlMitigation struct {
	Phase       []string `xml:"Phase"`
	Description string   `xml:"Description"`
}

// --- Parsed record ---

type cweRecord struct {
	ID           int32
	Name         string
	Description  string
	ExtendedDesc string
	ParentIDs    []int32
	Category     string
	Likelihood   string
	Impact       string
	Mitigations  []byte // JSON
}

func parseXML(data []byte) ([]cweRecord, error) {
	var catalog weaknessCatalog
	if err := xml.Unmarshal(data, &catalog); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	records := make([]cweRecord, 0, len(catalog.Weaknesses))
	for _, w := range catalog.Weaknesses {
		id, ok := parsePositiveInt32(strings.TrimSpace(w.ID))
		if !ok {
			continue
		}

		rec := cweRecord{
			ID:           id,
			Name:         strings.TrimSpace(w.Name),
			Description:  strings.TrimSpace(w.Description),
			ExtendedDesc: extractXMLText(w.ExtendedDescription.Content),
			Category:     strings.TrimSpace(w.Abstraction),
			Likelihood:   strings.TrimSpace(w.LikelihoodOfExploit),
		}

		parentSeen := make(map[int32]struct{})
		for _, rel := range w.RelatedWeaknesses {
			if !strings.EqualFold(strings.TrimSpace(rel.Nature), "ChildOf") {
				continue
			}

			parentID, ok := parsePositiveInt32(strings.TrimSpace(rel.CWEID))
			if !ok {
				continue
			}

			if _, ok := parentSeen[parentID]; ok {
				continue
			}
			parentSeen[parentID] = struct{}{}
			rec.ParentIDs = append(rec.ParentIDs, parentID)
		}

		impacts := collectImpacts(w.CommonConsequences)
		if len(impacts) > 0 {
			rec.Impact = strings.Join(impacts, ", ")
		}

		if len(w.PotentialMitigations) > 0 {
			mits := make([]map[string]any, 0, len(w.PotentialMitigations))
			for _, m := range w.PotentialMitigations {
				description := strings.TrimSpace(m.Description)
				if description == "" {
					continue
				}

				phases := make([]string, 0, len(m.Phase))
				seenPhase := make(map[string]struct{})
				for _, p := range m.Phase {
					p = strings.TrimSpace(p)
					if p == "" {
						continue
					}
					if _, exists := seenPhase[p]; exists {
						continue
					}
					seenPhase[p] = struct{}{}
					phases = append(phases, p)
				}

				mits = append(mits, map[string]any{
					"phases":      phases,
					"description": description,
				})
			}

			if len(mits) > 0 {
				rec.Mitigations, _ = json.Marshal(mits)
			}
		}

		records = append(records, rec)
	}

	return records, nil
}

func parsePositiveInt32(raw string) (int32, bool) {
	v, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || v <= 0 {
		return 0, false
	}
	return int32(v), true
}

func collectImpacts(consequences []xmlConsequence) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0)

	for _, c := range consequences {
		for _, imp := range c.Impact {
			imp = strings.TrimSpace(imp)
			if imp == "" {
				continue
			}
			if _, ok := seen[imp]; ok {
				continue
			}
			seen[imp] = struct{}{}
			out = append(out, imp)
		}
	}

	return out
}

// extractXMLText аккуратно достаёт текст из XML/HTML-фрагмента.
func extractXMLText(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}

	decoder := xml.NewDecoder(strings.NewReader("<root>" + s + "</root>"))
	var b strings.Builder

	for {
		tok, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return strings.TrimSpace(stripXMLTagsFallback(s))
		}

		switch t := tok.(type) {
		case xml.CharData:
			text := strings.TrimSpace(string(t))
			if text == "" {
				continue
			}
			if b.Len() > 0 {
				b.WriteString(" ")
			}
			b.WriteString(text)
		}
	}

	return normalizeWhitespace(b.String())
}

// Fallback на случай кривого innerxml.
func stripXMLTagsFallback(s string) string {
	var b strings.Builder
	inTag := false

	for _, r := range s {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			b.WriteRune(r)
		}
	}

	return normalizeWhitespace(b.String())
}

func normalizeWhitespace(s string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
}

func (s *CWESyncer) upsert(ctx context.Context, records []cweRecord) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE cwe_staging (
			cwe_id        INT NOT NULL,
			name          TEXT,
			description   TEXT,
			extended_desc TEXT,
			parent_ids    INT[],
			category      TEXT,
			likelihood    TEXT,
			impact        TEXT,
			mitigations   JSONB
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.ID,
			rec.Name,
			rec.Description,
			rec.ExtendedDesc,
			rec.ParentIDs,
			rec.Category,
			rec.Likelihood,
			rec.Impact,
			jsonbOrNull(rec.Mitigations),
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"cwe_staging"},
		[]string{
			"cwe_id",
			"name",
			"description",
			"extended_desc",
			"parent_ids",
			"category",
			"likelihood",
			"impact",
			"mitigations",
		},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO cwe_catalog (
			cwe_id,
			name,
			description,
			extended_desc,
			parent_ids,
			category,
			likelihood,
			impact,
			mitigations,
			synced_at
		)
		SELECT
			cwe_id,
			name,
			description,
			extended_desc,
			parent_ids,
			category,
			likelihood,
			impact,
			mitigations,
			now()
		FROM cwe_staging
		ON CONFLICT (cwe_id) DO UPDATE
		SET name          = EXCLUDED.name,
		    description   = EXCLUDED.description,
		    extended_desc = EXCLUDED.extended_desc,
		    parent_ids    = EXCLUDED.parent_ids,
		    category      = EXCLUDED.category,
		    likelihood    = EXCLUDED.likelihood,
		    impact        = EXCLUDED.impact,
		    mitigations   = EXCLUDED.mitigations,
		    synced_at     = now()
	`)
	if err != nil {
		return fmt.Errorf("upsert from staging: %w", err)
	}

	return tx.Commit(ctx)
}

func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}
