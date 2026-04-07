package bdu

import (
	"archive/zip"
	"context"
	"crypto/tls"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
)

const (
	bduURL        = "https://bdu.fstec.ru/files/documents/vulxml.zip"
	syncBatchSize = 500
)

type BDUSyncer struct {
	pool   *pgxpool.Pool
	client *http.Client
	log    *slog.Logger
}

func NewSyncer(pool *pgxpool.Pool) *BDUSyncer {
	insecureSkipVerify := envBool("BDU_INSECURE_SKIP_VERIFY", true)

	transport := http.DefaultTransport.(*http.Transport).Clone()
	if transport.TLSClientConfig == nil {
		transport.TLSClientConfig = &tls.Config{}
	}
	transport.TLSClientConfig.InsecureSkipVerify = insecureSkipVerify

	client := &http.Client{
		Timeout:   30 * time.Minute,
		Transport: transport,
	}

	logger := slog.Default()
	if insecureSkipVerify {
		logger.Warn("BDU sync: TLS certificate verification is disabled; set BDU_INSECURE_SKIP_VERIFY=false to enable verification")
	}

	return &BDUSyncer{
		pool:   pool,
		client: client,
		log:    logger,
	}
}

func (s *BDUSyncer) Name() string { return "bdu" }

func (s *BDUSyncer) Sync(ctx context.Context) (err error) {
	startedAt := time.Now()
	s.log.Info("BDU sync: started", "url", bduURL)

	tmpFile, downloadedBytes, err := s.downloadZIPToTempFile(ctx)
	if err != nil {
		return fmt.Errorf("bdu.Sync: download zip: %w", err)
	}
	defer func() {
		name := tmpFile.Name()
		if closeErr := tmpFile.Close(); closeErr != nil {
			s.log.Warn("BDU sync: failed to close temp file", "path", name, "error", closeErr)
		}
		if removeErr := os.Remove(name); removeErr != nil && !os.IsNotExist(removeErr) {
			s.log.Warn("BDU sync: failed to remove temp file", "path", name, "error", removeErr)
		}
	}()

	s.log.Info("BDU sync: zip downloaded", "bytes", downloadedBytes, "path", tmpFile.Name())

	xmlReader, xmlEntryName, xmlUncompressedSize, err := openXMLFromZIP(tmpFile)
	if err != nil {
		return fmt.Errorf("bdu.Sync: open xml from zip: %w", err)
	}
	defer func() {
		if closeErr := xmlReader.Close(); closeErr != nil {
			s.log.Warn("BDU sync: failed to close xml reader", "entry", xmlEntryName, "error", closeErr)
		}
	}()

	s.log.Info(
		"BDU sync: xml entry opened",
		"entry", xmlEntryName,
		"uncompressed_size", xmlUncompressedSize,
	)

	imported, skipped, err := s.parseAndUpsert(ctx, xmlReader)
	if err != nil {
		return fmt.Errorf("bdu.Sync: parse and upsert: %w", err)
	}

	s.log.Info(
		"BDU sync: finished",
		"imported", imported,
		"skipped", skipped,
		"duration", time.Since(startedAt).String(),
	)

	return nil
}

func (s *BDUSyncer) downloadZIPToTempFile(ctx context.Context) (*os.File, int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, bduURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	s.log.Info("BDU sync: downloading zip")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyPreview, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, 0, fmt.Errorf(
			"unexpected status %d, body=%q",
			resp.StatusCode,
			strings.TrimSpace(string(bodyPreview)),
		)
	}

	tmpFile, err := os.CreateTemp("", "red-lycoris-bdu-*.zip")
	if err != nil {
		return nil, 0, fmt.Errorf("create temp file: %w", err)
	}

	written, err := io.Copy(tmpFile, resp.Body)
	if err != nil {
		name := tmpFile.Name()
		_ = tmpFile.Close()
		_ = os.Remove(name)
		return nil, 0, fmt.Errorf("copy response to temp file: %w", err)
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		name := tmpFile.Name()
		_ = tmpFile.Close()
		_ = os.Remove(name)
		return nil, 0, fmt.Errorf("rewind temp file: %w", err)
	}

	return tmpFile, written, nil
}

func openXMLFromZIP(file *os.File) (io.ReadCloser, string, uint64, error) {
	stat, err := file.Stat()
	if err != nil {
		return nil, "", 0, fmt.Errorf("stat zip file: %w", err)
	}

	zr, err := zip.NewReader(file, stat.Size())
	if err != nil {
		return nil, "", 0, fmt.Errorf("open zip reader: %w", err)
	}

	var selected *zip.File
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
			selected = f
			break
		}
	}

	if selected == nil {
		return nil, "", 0, fmt.Errorf("no XML file found in ZIP")
	}

	rc, err := selected.Open()
	if err != nil {
		return nil, "", 0, fmt.Errorf("open xml entry %q: %w", selected.Name, err)
	}

	return rc, selected.Name, selected.UncompressedSize64, nil
}

func (s *BDUSyncer) parseAndUpsert(ctx context.Context, r io.Reader) (imported int, skipped int, err error) {
	decoder := xml.NewDecoder(r)
	decoder.Strict = false
	decoder.CharsetReader = xmlCharsetReader

	batch := make([]bduRecord, 0, syncBatchSize)

	s.log.Info("BDU sync: xml parsing started", "batch_size", syncBatchSize)

	flush := func() error {
		if len(batch) == 0 {
			return nil
		}

		if err := s.upsertBatch(ctx, batch); err != nil {
			return err
		}

		imported += len(batch)

		s.log.Info(
			"BDU sync: batch upserted",
			"batch_size", len(batch),
			"imported_total", imported,
			"skipped_total", skipped,
		)

		clear(batch)
		batch = batch[:0]
		return nil
	}

	for {
		select {
		case <-ctx.Done():
			return imported, skipped, ctx.Err()
		default:
		}

		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return imported, skipped, fmt.Errorf("read token: %w", err)
		}

		start, ok := tok.(xml.StartElement)
		if !ok || start.Name.Local != "vul" {
			continue
		}

		var v xmlVul
		if err := decoder.DecodeElement(&v, &start); err != nil {
			skipped++
			s.log.Warn("BDU sync: failed to decode <vul>", "skipped_total", skipped, "error", err)
			continue
		}

		rec, err := parseVul(&v)
		if err != nil {
			skipped++
			s.log.Debug("BDU sync: skipping invalid entry", "bdu_id", strings.TrimSpace(v.Identifier), "skipped_total", skipped, "error", err)
			continue
		}

		batch = append(batch, rec)

		if len(batch) >= syncBatchSize {
			if err := flush(); err != nil {
				return imported, skipped, fmt.Errorf("flush batch: %w", err)
			}
		}
	}

	if err := flush(); err != nil {
		return imported, skipped, fmt.Errorf("flush final batch: %w", err)
	}

	return imported, skipped, nil
}

func xmlCharsetReader(charset string, input io.Reader) (io.Reader, error) {
	switch strings.ToLower(strings.TrimSpace(charset)) {
	case "", "utf-8", "utf8":
		return input, nil
	case "windows-1251", "cp1251":
		return transform.NewReader(input, charmap.Windows1251.NewDecoder()), nil
	default:
		return input, nil
	}
}

// --- XML structures for BDU vulxml.xml ---

type xmlVul struct {
	Identifier         string               `xml:"identifier"`
	Name               string               `xml:"name"`
	Description        string               `xml:"description"`
	Severity           string               `xml:"severity"`
	CVSS               xmlCVSSBlock         `xml:"cvss"`
	CVSS3              xmlCVSSBlock         `xml:"cvss3"`
	Identifiers        []xmlIdentifierEntry `xml:"identifiers>identifier"`
	VulnerableSoftware []xmlSoftItem        `xml:"vulnerable_software>soft"`
	CWEs               []xmlCWEEntry        `xml:"cwes>cwe"`
	Solution           string               `xml:"solution"`
	PublicationDate    string               `xml:"publication_date"`
	LastUpdDate        string               `xml:"last_upd_date"`
}

type xmlCVSSBlock struct {
	Vector xmlCVSSVector `xml:"vector"`
}

type xmlCVSSVector struct {
	Score string `xml:"score,attr"`
	Text  string `xml:",chardata"`
}

type xmlIdentifierEntry struct {
	Type string `xml:"type,attr"`
	Text string `xml:",chardata"`
}

type xmlSoftItem struct {
	Vendor  string `xml:"vendor"`
	Name    string `xml:"name"`
	Version string `xml:"version"`
}

type xmlCWEEntry struct {
	Identifier string `xml:"identifier"`
	Name       string `xml:"name"`
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

func parseVul(v *xmlVul) (bduRecord, error) {
	bduID := strings.TrimSpace(v.Identifier)
	if bduID == "" {
		return bduRecord{}, fmt.Errorf("empty identifier")
	}

	rec := bduRecord{
		BDUID:       bduID,
		Name:        strings.TrimSpace(v.Name),
		Description: strings.TrimSpace(v.Description),
		Severity:    strings.TrimSpace(v.Severity),
		Remediation: strings.TrimSpace(v.Solution),
	}

	score, vector := parseCVSS(v.CVSS3)
	if score == nil && strings.TrimSpace(vector) == "" {
		score, vector = parseCVSS(v.CVSS)
	}
	rec.CVSSV3Score = score
	rec.CVSSV3Vector = vector

	rec.CVEIDs = extractCVEIDs(v.Identifiers)
	rec.CWEIDs = extractCWEIDs(v.CWEs)
	rec.Vendor, rec.Product, rec.AffectedVersions = extractSoftware(v.VulnerableSoftware)
	rec.PublishedAt = parseBDUDate(v.PublicationDate)
	rec.ModifiedAt = parseBDUDate(v.LastUpdDate)

	raw, err := json.Marshal(v)
	if err != nil {
		slog.Warn("BDU sync: failed to marshal raw entry", "bdu_id", rec.BDUID, "error", err)
	} else {
		rec.RawData = raw
	}

	return rec, nil
}

func parseCVSS(block xmlCVSSBlock) (*float32, string) {
	vector := strings.TrimSpace(block.Vector.Text)
	scoreStr := strings.TrimSpace(block.Vector.Score)
	if scoreStr == "" {
		return nil, vector
	}

	score, err := strconv.ParseFloat(scoreStr, 32)
	if err != nil {
		return nil, vector
	}

	s := float32(score)
	return &s, vector
}

func extractCVEIDs(entries []xmlIdentifierEntry) []string {
	if len(entries) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(entries))
	out := make([]string, 0, len(entries))

	for _, ident := range entries {
		if !strings.EqualFold(strings.TrimSpace(ident.Type), "CVE") {
			continue
		}

		id := strings.ToUpper(strings.TrimSpace(ident.Text))
		if !strings.HasPrefix(id, "CVE-") {
			continue
		}

		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}

	if len(out) == 0 {
		return nil
	}
	return out
}

func extractCWEIDs(entries []xmlCWEEntry) []int32 {
	if len(entries) == 0 {
		return nil
	}

	seen := make(map[int32]struct{}, len(entries))
	out := make([]int32, 0, len(entries))

	for _, entry := range entries {
		id := parseCWEID(entry.Identifier)
		if id <= 0 {
			continue
		}

		cweID := int32(id)
		if _, exists := seen[cweID]; exists {
			continue
		}
		seen[cweID] = struct{}{}
		out = append(out, cweID)
	}

	if len(out) == 0 {
		return nil
	}
	return out
}

func extractSoftware(items []xmlSoftItem) (vendor string, product string, versions string) {
	if len(items) == 0 {
		return "", "", ""
	}

	versionSeen := make(map[string]struct{}, len(items))
	versionList := make([]string, 0, len(items))

	for _, item := range items {
		v := strings.TrimSpace(item.Vendor)
		n := strings.TrimSpace(item.Name)
		ver := strings.TrimSpace(item.Version)

		if vendor == "" && v != "" {
			vendor = v
		}
		if product == "" && n != "" {
			product = n
		}

		if ver == "" {
			continue
		}
		if _, exists := versionSeen[ver]; exists {
			continue
		}
		versionSeen[ver] = struct{}{}
		versionList = append(versionList, ver)
	}

	if len(versionList) > 0 {
		versions = strings.Join(versionList, ", ")
	}

	return vendor, product, versions
}

func parseCWEID(s string) int {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(strings.ToUpper(s), "CWE-") {
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
		time.RFC3339,
	} {
		t, err := time.Parse(layout, s)
		if err == nil {
			return &t
		}
	}

	return nil
}

func (s *BDUSyncer) upsertBatch(ctx context.Context, records []bduRecord) error {
	if len(records) == 0 {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

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

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"bdu_staging"},
		[]string{
			"bdu_id",
			"name",
			"description",
			"severity",
			"cvss_v3_score",
			"cvss_v3_vector",
			"cve_ids",
			"cwe_ids",
			"vendor",
			"product",
			"affected_versions",
			"remediation",
			"published_at",
			"modified_at",
			"raw_data",
		},
		pgx.CopyFromSlice(len(records), func(i int) ([]any, error) {
			rec := records[i]
			return []any{
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
				dateOnlyOrNil(rec.PublishedAt),
				dateOnlyOrNil(rec.ModifiedAt),
				jsonbOrNull(rec.RawData),
			}, nil
		}),
	)
	if err != nil {
		return fmt.Errorf("copy into staging: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO bdu_fstec (
			bdu_id,
			name,
			description,
			severity,
			cvss_v3_score,
			cvss_v3_vector,
			cve_ids,
			cwe_ids,
			vendor,
			product,
			affected_versions,
			remediation,
			published_at,
			modified_at,
			raw_data,
			synced_at
		)
		SELECT
			bdu_id,
			name,
			description,
			severity,
			cvss_v3_score,
			cvss_v3_vector,
			cve_ids,
			cwe_ids,
			vendor,
			product,
			affected_versions,
			remediation,
			published_at,
			modified_at,
			raw_data,
			now()
		FROM bdu_staging
		ON CONFLICT (bdu_id) DO UPDATE
		SET
			name              = EXCLUDED.name,
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

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	return nil
}

func dateOnlyOrNil(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.Format("2006-01-02")
}

func jsonbOrNull(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return json.RawMessage(data)
}

func envBool(key string, defaultValue bool) bool {
	raw, ok := os.LookupEnv(key)
	if !ok {
		return defaultValue
	}

	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return defaultValue
	}
}
