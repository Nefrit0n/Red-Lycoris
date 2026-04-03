package bdu

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
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
)

const bduURL = "https://bdu.fstec.ru/files/documents/vulxml.zip"

type BDUSyncer struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewSyncer(pool *pgxpool.Pool) *BDUSyncer {
	return &BDUSyncer{
		pool:   pool,
		client: &http.Client{Timeout: 5 * time.Minute},
	}
}

func (s *BDUSyncer) Name() string { return "bdu" }

func (s *BDUSyncer) Sync(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bduURL, nil)
	if err != nil {
		return fmt.Errorf("bdu.Sync: create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("bdu.Sync: download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bdu.Sync: unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("bdu.Sync: read body: %w", err)
	}

	xmlData, err := extractZIP(body)
	if err != nil {
		return fmt.Errorf("bdu.Sync: extract zip: %w", err)
	}

	records, skipped, err := parseXML(xmlData)
	if err != nil {
		return fmt.Errorf("bdu.Sync: parse xml: %w", err)
	}

	if skipped > 0 {
		slog.Warn("BDU sync: skipped entries due to parse errors", "skipped", skipped)
	}

	if err := s.upsert(ctx, records); err != nil {
		return fmt.Errorf("bdu.Sync: upsert: %w", err)
	}

	slog.Info("BDU sync: imported records", "count", len(records))
	return nil
}

func extractZIP(data []byte) ([]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	for _, f := range r.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
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

// ensureUTF8 конвертирует из windows-1251 в UTF-8 если нужно.
// Проверяет XML-декларацию на наличие encoding="windows-1251".
func ensureUTF8(data []byte) []byte {
	header := strings.ToLower(string(data[:min(256, len(data))]))
	if strings.Contains(header, "windows-1251") {
		reader := transform.NewReader(bytes.NewReader(data), charmap.Windows1251.NewDecoder())
		utf8Data, err := io.ReadAll(reader)
		if err != nil {
			slog.Warn("BDU: failed to decode windows-1251, using raw data", "error", err)
			return data
		}
		// Заменяем encoding-декларацию чтобы xml.Decoder не ругался
		utf8Data = bytes.Replace(utf8Data, []byte("windows-1251"), []byte("utf-8"), 1)
		utf8Data = bytes.Replace(utf8Data, []byte("Windows-1251"), []byte("utf-8"), 1)
		return utf8Data
	}
	return data
}

// --- XML structures для BDU ---

type bduExport struct {
	XMLName xml.Name `xml:"export"`
	Vulns   []xmlVul `xml:"vul"`
}

type xmlVul struct {
	Identifier  string         `xml:"identifier"`
	Name        string         `xml:"name"`
	Description string         `xml:"description"`
	Severity    string         `xml:"severity"`
	CVSS        xmlCVSS        `xml:"cvss"`
	Identifiers xmlIdentifiers `xml:"identifiers"`
	Software    xmlSoftware    `xml:"soft"`
	FixList     string         `xml:"fix_list"`
	PublishDate string         `xml:"date_publish"`
	ModifyDate  string         `xml:"date_modify"`
}

type xmlCVSS struct {
	Score  string `xml:"score"`
	Vector string `xml:"vector"`
}

type xmlIdentifiers struct {
	Entries []xmlIdentifierEntry `xml:"identifier"`
}

type xmlIdentifierEntry struct {
	Type string `xml:"type,attr"`
	Text string `xml:",chardata"`
}

type xmlSoftware struct {
	Items []xmlSoftItem `xml:"soft_item"`
}

type xmlSoftItem struct {
	Vendor  string `xml:"vendor"`
	Name    string `xml:"name"`
	Version string `xml:"version"`
}

// --- Parsed record ---

type bduRecord struct {
	BDUID            string
	Name             string
	Description      string
	Severity         string
	CVSSV3Score      *float32
	CVSSV3Vector     string
	CVEIDs           []string
	CWEIDs           []int32
	Vendor           string
	Product          string
	AffectedVersions string
	Remediation      string
	PublishedAt      *time.Time
	ModifiedAt       *time.Time
	RawData          []byte
}

func parseXML(data []byte) ([]bduRecord, int, error) {
	data = ensureUTF8(data)

	// Используем xml.Decoder для стримового парсинга — XML может быть большим
	decoder := xml.NewDecoder(bytes.NewReader(data))
	decoder.Strict = false
	// Обрабатываем не-UTF8 символы
	decoder.CharsetReader = func(charset string, input io.Reader) (io.Reader, error) {
		switch strings.ToLower(charset) {
		case "windows-1251":
			return transform.NewReader(input, charmap.Windows1251.NewDecoder()), nil
		default:
			return input, nil
		}
	}

	var export bduExport
	if err := decoder.Decode(&export); err != nil {
		return nil, 0, fmt.Errorf("unmarshal: %w", err)
	}

	records := make([]bduRecord, 0, len(export.Vulns))
	skipped := 0

	for i := range export.Vulns {
		rec, err := parseVul(&export.Vulns[i])
		if err != nil {
			slog.Debug("BDU: skipping entry", "index", i, "error", err)
			skipped++
			continue
		}
		records = append(records, rec)
	}

	return records, skipped, nil
}

func parseVul(v *xmlVul) (bduRecord, error) {
	if v.Identifier == "" {
		return bduRecord{}, fmt.Errorf("empty identifier")
	}

	rec := bduRecord{
		BDUID:       v.Identifier,
		Name:        v.Name,
		Description: v.Description,
		Severity:    v.Severity,
		CVSSV3Vector: v.CVSS.Vector,
		Remediation: strings.TrimSpace(v.FixList),
	}

	// CVSS score
	if v.CVSS.Score != "" {
		score, err := strconv.ParseFloat(strings.TrimSpace(v.CVSS.Score), 32)
		if err == nil {
			s := float32(score)
			rec.CVSSV3Score = &s
		}
	}

	// CVE and CWE IDs
	for _, ident := range v.Identifiers.Entries {
		text := strings.TrimSpace(ident.Text)
		switch strings.ToUpper(ident.Type) {
		case "CVE":
			if strings.HasPrefix(text, "CVE-") {
				rec.CVEIDs = append(rec.CVEIDs, text)
			}
		case "CWE":
			id := parseCWEID(text)
			if id > 0 {
				rec.CWEIDs = append(rec.CWEIDs, int32(id))
			}
		}
	}

	// Vendor / Product — берём первый software item
	if len(v.Software.Items) > 0 {
		item := v.Software.Items[0]
		rec.Vendor = strings.TrimSpace(item.Vendor)
		rec.Product = strings.TrimSpace(item.Name)
		// Собираем все версии из всех items
		var versions []string
		for _, si := range v.Software.Items {
			ver := strings.TrimSpace(si.Version)
			if ver != "" {
				versions = append(versions, ver)
			}
		}
		if len(versions) > 0 {
			rec.AffectedVersions = strings.Join(versions, ", ")
		}
	}

	// Даты
	rec.PublishedAt = parseBDUDate(v.PublishDate)
	rec.ModifiedAt = parseBDUDate(v.ModifyDate)

	// raw_data
	raw, _ := json.Marshal(v)
	rec.RawData = raw

	return rec, nil
}

func parseCWEID(s string) int {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "CWE-") {
		s = s[4:]
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func parseBDUDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	for _, layout := range []string{
		"02.01.2006",
		"2006-01-02",
		"2006-01-02T15:04:05",
	} {
		t, err := time.Parse(layout, s)
		if err == nil {
			return &t
		}
	}
	return nil
}

func (s *BDUSyncer) upsert(ctx context.Context, records []bduRecord) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		CREATE TEMP TABLE bdu_staging (
			bdu_id            TEXT NOT NULL,
			name              TEXT,
			description       TEXT,
			severity          TEXT,
			cvss_v3_score     REAL,
			cvss_v3_vector    TEXT,
			cve_ids           TEXT[],
			cwe_ids           INT[],
			vendor            TEXT,
			product           TEXT,
			affected_versions TEXT,
			remediation       TEXT,
			published_at      DATE,
			modified_at       DATE,
			raw_data          JSONB
		) ON COMMIT DROP
	`)
	if err != nil {
		return fmt.Errorf("create staging: %w", err)
	}

	rows := make([][]any, len(records))
	for i, rec := range records {
		rows[i] = []any{
			rec.BDUID,
			rec.Name,
			rec.Description,
			rec.Severity,
			rec.CVSSV3Score,
			rec.CVSSV3Vector,
			rec.CVEIDs,
			rec.CWEIDs,
			rec.Vendor,
			rec.Product,
			rec.AffectedVersions,
			rec.Remediation,
			rec.PublishedAt,
			rec.ModifiedAt,
			jsonbOrNull(rec.RawData),
		}
	}

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"bdu_staging"},
		[]string{"bdu_id", "name", "description", "severity", "cvss_v3_score",
			"cvss_v3_vector", "cve_ids", "cwe_ids", "vendor", "product",
			"affected_versions", "remediation", "published_at", "modified_at", "raw_data"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO bdu_fstec (bdu_id, name, description, severity, cvss_v3_score,
		                       cvss_v3_vector, cve_ids, cwe_ids, vendor, product,
		                       affected_versions, remediation, published_at, modified_at,
		                       raw_data, synced_at)
		SELECT bdu_id, name, description, severity, cvss_v3_score,
		       cvss_v3_vector, cve_ids, cwe_ids, vendor, product,
		       affected_versions, remediation, published_at, modified_at,
		       raw_data, now()
		FROM bdu_staging
		ON CONFLICT (bdu_id) DO UPDATE
		SET name              = EXCLUDED.name,
		    description       = EXCLUDED.description,
		    severity          = EXCLUDED.severity,
		    cvss_v3_score     = EXCLUDED.cvss_v3_score,
		    cvss_v3_vector    = EXCLUDED.cvss_v3_vector,
		    cve_ids           = EXCLUDED.cve_ids,
		    cwe_ids           = EXCLUDED.cwe_ids,
		    vendor            = EXCLUDED.vendor,
		    product           = EXCLUDED.product,
		    affected_versions = EXCLUDED.affected_versions,
		    remediation       = EXCLUDED.remediation,
		    published_at      = EXCLUDED.published_at,
		    modified_at       = EXCLUDED.modified_at,
		    raw_data          = EXCLUDED.raw_data,
		    synced_at         = now()
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
