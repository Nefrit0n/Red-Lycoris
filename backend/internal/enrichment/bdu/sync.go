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
	transport.TLSClientConfig.MinVersion = tls.VersionTLS13
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
		if !ok || !strings.EqualFold(strings.TrimSpace(start.Name.Local), "vul") {
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
	Identifier  string `xml:"identifier"`
	Name        string `xml:"name"`
	Description string `xml:"description"`
	Severity    string `xml:"severity"`

	VulStatus       string `xml:"vul_status"`
	ExploitStatus   string `xml:"exploit_status"`
	FixStatus       string `xml:"fix_status"`
	VulClass        string `xml:"vul_class"`
	ExploitationWay string `xml:"exploitation_way"`
	MitigationWay   string `xml:"mitigation_way"`

	CVSS  xmlCVSSBlock `xml:"cvss"`
	CVSS3 xmlCVSSBlock `xml:"cvss3"`
	CVSS4 xmlCVSSBlock `xml:"cvss4"`

	Identifiers        []xmlIdentifierEntry `xml:"identifiers>identifier"`
	VulnerableSoftware []xmlSoftItem        `xml:"vulnerable_software>soft"`
	Environment        []xmlEnvItem         `xml:"environment>platform"`
	CWEs               []xmlCWEEntry        `xml:"cwes>cwe"`
	Solution           string               `xml:"solution"`
	Sources            []string             `xml:"sources>source"`
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
	Vendor    string   `xml:"vendor"`
	Name      string   `xml:"name"`
	Version   string   `xml:"version"`
	Types     []string `xml:"types>type"`
	Platforms []string `xml:"platforms>platform"`
}

type xmlEnvItem struct {
	Vendor string `xml:"vendor"`
	Name   string `xml:"name"`
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
	VulStatus        string
	ExploitStatus    string
	FixStatus        string
	VulClass         string
	ExploitationWay  string
	MitigationWay    string
	CVSSV2Score      *float32
	CVSSV2Vector     string
	CVSSV3Score      *float32
	CVSSV3Vector     string
	CVSSV4Score      *float32
	CVSSV4Vector     string
	CVEIDs           []string
	CWEIDs           []int32
	Vendor           string
	Product          string
	AffectedVersions string
	Software         []byte
	Environment      []byte
	Sources          []string
	Remediation      string
	PublishedAt      *time.Time
	ModifiedAt       *time.Time
	RawData          []byte
}

type SoftwareEntry struct {
	Vendor    string   `json:"vendor,omitempty"`
	Name      string   `json:"name,omitempty"`
	Version   string   `json:"version,omitempty"`
	Types     []string `json:"types,omitempty"`
	Platforms []string `json:"platforms,omitempty"`
}

type EnvironmentEntry struct {
	Vendor string `json:"vendor,omitempty"`
	Name   string `json:"name,omitempty"`
}

func parseVul(v *xmlVul) (bduRecord, error) {
	bduID := strings.TrimSpace(v.Identifier)
	if bduID == "" {
		return bduRecord{}, fmt.Errorf("empty identifier")
	}

	rec := bduRecord{
		BDUID:           bduID,
		Name:            strings.TrimSpace(v.Name),
		Description:     strings.TrimSpace(v.Description),
		Severity:        strings.TrimSpace(v.Severity),
		VulStatus:       strings.TrimSpace(v.VulStatus),
		ExploitStatus:   strings.TrimSpace(v.ExploitStatus),
		FixStatus:       strings.TrimSpace(v.FixStatus),
		VulClass:        strings.TrimSpace(v.VulClass),
		ExploitationWay: strings.TrimSpace(v.ExploitationWay),
		MitigationWay:   strings.TrimSpace(v.MitigationWay),
		Remediation:     strings.TrimSpace(v.Solution),
	}

	rec.CVSSV2Score, rec.CVSSV2Vector = parseCVSS(v.CVSS)
	rec.CVSSV3Score, rec.CVSSV3Vector = parseCVSS(v.CVSS3)
	rec.CVSSV4Score, rec.CVSSV4Vector = parseCVSS(v.CVSS4)

	rec.CVEIDs = extractCVEIDs(v.Identifiers)
	rec.CWEIDs = extractCWEIDs(v.CWEs)
	rec.Software, rec.Vendor, rec.Product, rec.AffectedVersions = buildSoftware(v.VulnerableSoftware)
	rec.Environment = buildEnvironment(v.Environment)
	rec.Sources = dedupNonEmpty(v.Sources)
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

func buildSoftware(items []xmlSoftItem) (jsonData []byte, vendor string, product string, versions string) {
	if len(items) == 0 {
		return nil, "", "", ""
	}

	entries := make([]SoftwareEntry, 0, len(items))
	versionSeen := make(map[string]struct{})
	versionList := make([]string, 0)

	for _, item := range items {
		entry := SoftwareEntry{
			Vendor:    strings.TrimSpace(item.Vendor),
			Name:      strings.TrimSpace(item.Name),
			Version:   strings.TrimSpace(item.Version),
			Types:     dedupNonEmpty(item.Types),
			Platforms: dedupNonEmpty(item.Platforms),
		}
		entries = append(entries, entry)

		if vendor == "" && entry.Vendor != "" {
			vendor = entry.Vendor
		}
		if product == "" && entry.Name != "" {
			product = entry.Name
		}

		if entry.Version == "" {
			continue
		}
		if _, exists := versionSeen[entry.Version]; exists {
			continue
		}
		versionSeen[entry.Version] = struct{}{}
		versionList = append(versionList, entry.Version)
	}

	if len(versionList) > 0 {
		versions = strings.Join(versionList, ", ")
	}

	data, err := json.Marshal(entries)
	if err != nil {
		data = nil
	}

	return data, vendor, product, versions
}

func buildEnvironment(items []xmlEnvItem) []byte {
	if len(items) == 0 {
		return nil
	}

	entries := make([]EnvironmentEntry, 0, len(items))
	for _, it := range items {
		vendor := strings.TrimSpace(it.Vendor)
		name := strings.TrimSpace(it.Name)
		if vendor == "" && name == "" {
			continue
		}
		entries = append(entries, EnvironmentEntry{Vendor: vendor, Name: name})
	}
	if len(entries) == 0 {
		return nil
	}

	data, err := json.Marshal(entries)
	if err != nil {
		return nil
	}
	return data
}

func dedupNonEmpty(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
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
			vul_status        TEXT,
			exploit_status    TEXT,
			fix_status        TEXT,
			vul_class         TEXT,
			exploitation_way  TEXT,
			mitigation_way    TEXT,
			cvss_v2_score     REAL,
			cvss_v2_vector    TEXT,
			cvss_v3_score     REAL,
			cvss_v3_vector    TEXT,
			cvss_v4_score     REAL,
			cvss_v4_vector    TEXT,
			cve_ids           TEXT[],
			cwe_ids           INT[],
			vendor            TEXT,
			product           TEXT,
			affected_versions TEXT,
			software          JSONB,
			environment       JSONB,
			sources           TEXT[],
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
			"vul_status",
			"exploit_status",
			"fix_status",
			"vul_class",
			"exploitation_way",
			"mitigation_way",
			"cvss_v2_score",
			"cvss_v2_vector",
			"cvss_v3_score",
			"cvss_v3_vector",
			"cvss_v4_score",
			"cvss_v4_vector",
			"cve_ids",
			"cwe_ids",
			"vendor",
			"product",
			"affected_versions",
			"software",
			"environment",
			"sources",
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
				rec.VulStatus,
				rec.ExploitStatus,
				rec.FixStatus,
				rec.VulClass,
				rec.ExploitationWay,
				rec.MitigationWay,
				rec.CVSSV2Score,
				rec.CVSSV2Vector,
				rec.CVSSV3Score,
				rec.CVSSV3Vector,
				rec.CVSSV4Score,
				rec.CVSSV4Vector,
				rec.CVEIDs,
				rec.CWEIDs,
				rec.Vendor,
				rec.Product,
				rec.AffectedVersions,
				jsonbOrNull(rec.Software),
				jsonbOrNull(rec.Environment),
				rec.Sources,
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
			vul_status,
			exploit_status,
			fix_status,
			vul_class,
			exploitation_way,
			mitigation_way,
			cvss_v2_score,
			cvss_v2_vector,
			cvss_v3_score,
			cvss_v3_vector,
			cvss_v4_score,
			cvss_v4_vector,
			cve_ids,
			cwe_ids,
			vendor,
			product,
			affected_versions,
			software,
			environment,
			sources,
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
			vul_status,
			exploit_status,
			fix_status,
			vul_class,
			exploitation_way,
			mitigation_way,
			cvss_v2_score,
			cvss_v2_vector,
			cvss_v3_score,
			cvss_v3_vector,
			cvss_v4_score,
			cvss_v4_vector,
			cve_ids,
			cwe_ids,
			vendor,
			product,
			affected_versions,
			software,
			environment,
			sources,
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
			vul_status        = EXCLUDED.vul_status,
			exploit_status    = EXCLUDED.exploit_status,
			fix_status        = EXCLUDED.fix_status,
			vul_class         = EXCLUDED.vul_class,
			exploitation_way  = EXCLUDED.exploitation_way,
			mitigation_way    = EXCLUDED.mitigation_way,
			cvss_v2_score     = EXCLUDED.cvss_v2_score,
			cvss_v2_vector    = EXCLUDED.cvss_v2_vector,
			cvss_v3_score     = EXCLUDED.cvss_v3_score,
			cvss_v3_vector    = EXCLUDED.cvss_v3_vector,
			cvss_v4_score     = EXCLUDED.cvss_v4_score,
			cvss_v4_vector    = EXCLUDED.cvss_v4_vector,
			cve_ids           = EXCLUDED.cve_ids,
			cwe_ids           = EXCLUDED.cwe_ids,
			vendor            = EXCLUDED.vendor,
			product           = EXCLUDED.product,
			affected_versions = EXCLUDED.affected_versions,
			software          = EXCLUDED.software,
			environment       = EXCLUDED.environment,
			sources           = EXCLUDED.sources,
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
