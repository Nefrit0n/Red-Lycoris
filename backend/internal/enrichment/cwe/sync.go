package cwe

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
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
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cweURL, nil)
	if err != nil {
		return fmt.Errorf("cwe.Sync: create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("cwe.Sync: download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("cwe.Sync: unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("cwe.Sync: read body: %w", err)
	}

	xmlData, err := extractZIP(body)
	if err != nil {
		return fmt.Errorf("cwe.Sync: extract zip: %w", err)
	}

	records, err := parseXML(xmlData)
	if err != nil {
		return fmt.Errorf("cwe.Sync: parse xml: %w", err)
	}

	if err := s.upsert(ctx, records); err != nil {
		return fmt.Errorf("cwe.Sync: upsert: %w", err)
	}

	slog.Info("CWE sync: imported records", "count", len(records))
	return nil
}

func extractZIP(data []byte) ([]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	for _, f := range r.File {
		if strings.HasSuffix(f.Name, ".xml") {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("open %s: %w", f.Name, err)
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}
	return nil, fmt.Errorf("no XML file found in ZIP")
}

// --- XML structures для CWE ---

type weaknessCatalog struct {
	XMLName    xml.Name   `xml:"Weakness_Catalog"`
	Weaknesses []xmlWeakness `xml:"Weaknesses>Weakness"`
}

type xmlWeakness struct {
	ID                   string                `xml:"ID,attr"`
	Name                 string                `xml:"Name,attr"`
	Abstraction          string                `xml:"Abstraction,attr"`
	Description          string                `xml:"Description"`
	ExtendedDescription  xmlStructuredText     `xml:"Extended_Description"`
	RelatedWeaknesses    []xmlRelatedWeakness  `xml:"Related_Weaknesses>Related_Weakness"`
	LikelihoodOfExploit  string                `xml:"Likelihood_Of_Exploit"`
	CommonConsequences   []xmlConsequence      `xml:"Common_Consequences>Consequence"`
	PotentialMitigations []xmlMitigation       `xml:"Potential_Mitigations>Mitigation"`
}

type xmlStructuredText struct {
	Content string `xml:",innerxml"`
}

type xmlRelatedWeakness struct {
	Nature  string `xml:"Nature,attr"`
	CWEID   string `xml:"CWE_ID,attr"`
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
		id, err := strconv.Atoi(w.ID)
		if err != nil {
			continue
		}

		rec := cweRecord{
			ID:           int32(id),
			Name:         w.Name,
			Description:  stripXMLTags(w.Description),
			ExtendedDesc: stripXMLTags(w.ExtendedDescription.Content),
			Category:     w.Abstraction,
			Likelihood:   w.LikelihoodOfExploit,
		}

		// parent_ids из ChildOf-связей (дедупликация — один CWE может быть ChildOf одного родителя в разных views)
		parentSeen := make(map[int32]struct{})
		for _, rel := range w.RelatedWeaknesses {
			if rel.Nature == "ChildOf" {
				pid, err := strconv.Atoi(rel.CWEID)
				if err == nil {
					p := int32(pid)
					if _, ok := parentSeen[p]; !ok {
						parentSeen[p] = struct{}{}
						rec.ParentIDs = append(rec.ParentIDs, p)
					}
				}
			}
		}

		// impact — объединяем уникальные значения из всех Consequence
		impacts := collectImpacts(w.CommonConsequences)
		if len(impacts) > 0 {
			rec.Impact = strings.Join(impacts, ", ")
		}

		// mitigations → JSONB
		if len(w.PotentialMitigations) > 0 {
			mits := make([]map[string]any, 0, len(w.PotentialMitigations))
			for _, m := range w.PotentialMitigations {
				mits = append(mits, map[string]any{
					"phases":      m.Phase,
					"description": stripXMLTags(m.Description),
				})
			}
			rec.Mitigations, _ = json.Marshal(mits)
		}

		records = append(records, rec)
	}

	return records, nil
}

func collectImpacts(consequences []xmlConsequence) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, c := range consequences {
		for _, imp := range c.Impact {
			if _, ok := seen[imp]; !ok {
				seen[imp] = struct{}{}
				out = append(out, imp)
			}
		}
	}
	return out
}

// stripXMLTags убирает вложенные XML/HTML-теги из текста.
func stripXMLTags(s string) string {
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
	return strings.TrimSpace(b.String())
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
		[]string{"cwe_id", "name", "description", "extended_desc",
			"parent_ids", "category", "likelihood", "impact", "mitigations"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO cwe_catalog (cwe_id, name, description, extended_desc,
		                         parent_ids, category, likelihood, impact, mitigations, synced_at)
		SELECT cwe_id, name, description, extended_desc,
		       parent_ids, category, likelihood, impact, mitigations, now()
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
