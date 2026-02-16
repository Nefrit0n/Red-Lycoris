package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

const (
	defaultRecentLimit        = 200
	maxRecentLimit            = 1000
	maxIdentifiersPerFinding  = 500
	maxIdentifierLen          = 128
	maxRefsPerDetail          = 200
	maxRefURLLen              = 2048
	maxLastErrorLen           = 2000
	maxReferencesPayloadBytes = 1 << 20 // 1MB safety cap
)

type IntelSummary struct {
	Identifiers     []string
	CVSSScore       *float64
	CVSSVersion     *string
	EPSSScore       *float64
	EPSSPercentile  *float64
	KEV             bool
	LastRefreshedAt *time.Time
}

type IntelDetail struct {
	Identifiers []string
	NVD         map[string]json.RawMessage
	EPSS        map[string]json.RawMessage
	KEV         map[string]json.RawMessage
	BDU         map[string]json.RawMessage
	References  []IntelReference
	UpdatedAt   *time.Time
}

type IntelReference struct {
	Title *string `json:"title,omitempty"`
	URL   string  `json:"url"`
}

type VulnIntelRecord struct {
	Identifier      string
	SourceVersion   string
	NVDPayload      json.RawMessage
	EPSSPayload     json.RawMessage
	KEVPayload      json.RawMessage
	BDUPayload      json.RawMessage
	References      []IntelReference
	CVSSScore       *float64
	CVSSVersion     *string
	EPSSScore       *float64
	EPSSPercentile  *float64
	KEV             bool
	FailCount       int
	LastRefreshedAt *time.Time
	NextRetryAt     *time.Time
	LastError       *string
}

type VulnIntelStatus struct {
	LastRefreshedAt sql.NullTime
	NextRetryAt     sql.NullTime
	FailCount       int
	HasBDUPayload   bool
}

// --- helpers

func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func sanitizeIdentifier(raw string) (string, bool) {
	s := strings.TrimSpace(raw)
	if s == "" || len(s) > maxIdentifierLen {
		return "", false
	}
	// быстрый отсев “мусора”: контрольные/пробельные внутри оставим как есть,
	// но хотя бы уберём совсем неадекватные кейсы
	return s, true
}

func isSafeHTTPURL(raw string) bool {
	if raw == "" || len(raw) > maxRefURLLen {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	if u.Host == "" {
		return false
	}
	return true
}

func truncateString(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func uuidStrings(ids []uuid.UUID) []string {
	out := make([]string, len(ids))
	for i := range ids {
		out[i] = ids[i].String()
	}
	return out
}

// --- data ops

// FIX: batch insert + лимиты (защита от DoS по базе)
func UpsertFindingIdentifiers(ctx context.Context, db *sql.DB, findingID uuid.UUID, identifiers []string) error {
	if len(identifiers) == 0 {
		return nil
	}

	// sanitize + dedup + clamp
	uniq := make(map[string]struct{}, len(identifiers))
	clean := make([]string, 0, len(identifiers))
	for _, id := range identifiers {
		if s, ok := sanitizeIdentifier(id); ok {
			if _, exists := uniq[s]; !exists {
				uniq[s] = struct{}{}
				clean = append(clean, s)
			}
		}
		if len(clean) >= maxIdentifiersPerFinding {
			break
		}
	}
	if len(clean) == 0 {
		return nil
	}

	// one roundtrip instead of N
	query := `
		INSERT INTO finding_vuln_identifiers (finding_id, identifier)
		SELECT $1, x
		FROM UNNEST($2::text[]) AS x
		ON CONFLICT (finding_id, identifier) DO NOTHING
	`
	_, err := db.ExecContext(ctx, query, findingID, pq.Array(clean))
	return err
}

func ListRecentIdentifiers(ctx context.Context, db *sql.DB, productID *uuid.UUID, limit int) ([]string, error) {
	if limit <= 0 {
		limit = defaultRecentLimit
	}
	limit = clampInt(limit, 1, maxRecentLimit)

	query := `
		SELECT fvi.identifier
		FROM finding_vuln_identifiers fvi
		JOIN findings f ON f.id = fvi.finding_id
		WHERE f.deleted_at IS NULL`
	args := []any{}

	if productID != nil {
		query += " AND f.product_id = $1"
		args = append(args, *productID)
		query += " GROUP BY fvi.identifier ORDER BY MAX(fvi.created_at) DESC LIMIT $2"
		args = append(args, limit)
	} else {
		query += " GROUP BY fvi.identifier ORDER BY MAX(fvi.created_at) DESC LIMIT $1"
		args = append(args, limit)
	}

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	identifiers := make([]string, 0, limit)
	for rows.Next() {
		var identifier string
		if err := rows.Scan(&identifier); err != nil {
			return nil, err
		}
		identifiers = append(identifiers, identifier)
	}
	return identifiers, rows.Err()
}

// FIX: pq.Array + явный каст uuid[] + pq.Array(&slice) при Scan. :contentReference[oaicite:2]{index=2}
func GetIntelSummaries(ctx context.Context, db *sql.DB, findingIDs []uuid.UUID) (map[uuid.UUID]IntelSummary, error) {
	if len(findingIDs) == 0 {
		return map[uuid.UUID]IntelSummary{}, nil
	}

	query := `
		SELECT
			fvi.finding_id,
			ARRAY_AGG(DISTINCT fvi.identifier) AS identifiers,
			MAX(vi.cvss_score) AS cvss_score,
			(ARRAY_AGG(vi.cvss_version ORDER BY vi.cvss_score DESC NULLS LAST))[1] AS cvss_version,
			MAX(vi.epss_score) AS epss_score,
			MAX(vi.epss_percentile) AS epss_percentile,
			COALESCE(BOOL_OR(vi.kev), FALSE) AS kev,
			MAX(vi.last_refreshed_at) AS last_refreshed_at
		FROM finding_vuln_identifiers fvi
		LEFT JOIN vuln_intel vi ON vi.identifier = fvi.identifier
		WHERE fvi.finding_id = ANY($1::uuid[])
		GROUP BY fvi.finding_id`

	rows, err := db.QueryContext(ctx, query, pq.Array(uuidStrings(findingIDs)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := map[uuid.UUID]IntelSummary{}
	for rows.Next() {
		var findingID uuid.UUID
		var identifiers []string
		var cvssScore sql.NullFloat64
		var cvssVersion sql.NullString
		var epssScore sql.NullFloat64
		var epssPercentile sql.NullFloat64
		var kev bool
		var lastRefreshedAt sql.NullTime

		if err := rows.Scan(
			&findingID,
			pq.Array(&identifiers),
			&cvssScore,
			&cvssVersion,
			&epssScore,
			&epssPercentile,
			&kev,
			&lastRefreshedAt,
		); err != nil {
			return nil, err
		}

		summary := IntelSummary{Identifiers: identifiers, KEV: kev}
		if cvssScore.Valid {
			v := cvssScore.Float64
			summary.CVSSScore = &v
		}
		if cvssVersion.Valid {
			v := cvssVersion.String
			summary.CVSSVersion = &v
		}
		if epssScore.Valid {
			v := epssScore.Float64
			summary.EPSSScore = &v
		}
		if epssPercentile.Valid {
			v := epssPercentile.Float64
			summary.EPSSPercentile = &v
		}
		if lastRefreshedAt.Valid {
			v := lastRefreshedAt.Time
			summary.LastRefreshedAt = &v
		}

		results[findingID] = summary
	}
	return results, rows.Err()
}

// FIX: references -> references_payload (избавляемся от keyword/несоответствия схемы) :contentReference[oaicite:3]{index=3}
// FIX: лимиты на references payload + фильтрация URL + cap по количеству
func GetIntelDetail(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*IntelDetail, error) {
	query := `
		SELECT
			fvi.identifier,
			vi.nvd_payload,
			vi.epss_payload,
			vi.kev_payload,
			vi.bdu_payload,
			vi.references_payload,
			vi.updated_at
		FROM finding_vuln_identifiers fvi
		LEFT JOIN vuln_intel vi ON vi.identifier = fvi.identifier
		WHERE fvi.finding_id = $1`

	rows, err := db.QueryContext(ctx, query, findingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	detail := &IntelDetail{
		NVD:  map[string]json.RawMessage{},
		EPSS: map[string]json.RawMessage{},
		KEV:  map[string]json.RawMessage{},
		BDU:  map[string]json.RawMessage{},
	}
	seenID := map[string]struct{}{}
	referenceMap := map[string]IntelReference{}
	var latestUpdated time.Time

	for rows.Next() {
		var identifier string
		var nvdPayload []byte
		var epssPayload []byte
		var kevPayload []byte
		var bduPayload []byte
		var referencesPayload []byte
		var updatedAt sql.NullTime

		if err := rows.Scan(
			&identifier,
			&nvdPayload,
			&epssPayload,
			&kevPayload,
			&bduPayload,
			&referencesPayload,
			&updatedAt,
		); err != nil {
			return nil, err
		}

		if _, ok := seenID[identifier]; !ok {
			seenID[identifier] = struct{}{}
			detail.Identifiers = append(detail.Identifiers, identifier)
		}

		if len(nvdPayload) > 0 {
			detail.NVD[identifier] = json.RawMessage(nvdPayload)
		}
		if len(epssPayload) > 0 {
			detail.EPSS[identifier] = json.RawMessage(epssPayload)
		}
		if len(kevPayload) > 0 {
			detail.KEV[identifier] = json.RawMessage(kevPayload)
		}
		if len(bduPayload) > 0 {
			// CWE search stores an array of BDU entries; expand each into
			// its own map key so the frontend renders them individually.
			if expanded := expandBDUArrayPayload(bduPayload); len(expanded) > 0 {
				for k, v := range expanded {
					detail.BDU[k] = v
				}
			} else {
				detail.BDU[identifier] = json.RawMessage(bduPayload)
			}
		}

		// safety: не парсим гигантский мусор
		if len(referencesPayload) > 0 && len(referencesPayload) <= maxReferencesPayloadBytes {
			var refs []IntelReference
			if err := json.Unmarshal(referencesPayload, &refs); err == nil {
				for _, ref := range refs {
					if len(referenceMap) >= maxRefsPerDetail {
						break
					}
					if isSafeHTTPURL(ref.URL) {
						referenceMap[ref.URL] = ref
					}
				}
			}
		}

		if updatedAt.Valid && updatedAt.Time.After(latestUpdated) {
			latestUpdated = updatedAt.Time
		}
	}

	if len(detail.Identifiers) == 0 {
		return nil, nil
	}
	if !latestUpdated.IsZero() {
		v := latestUpdated
		detail.UpdatedAt = &v
	}

	// stable output (чтобы фронт/тесты не “плясали”)
	urls := make([]string, 0, len(referenceMap))
	for u := range referenceMap {
		urls = append(urls, u)
	}
	sort.Strings(urls)
	for _, u := range urls {
		detail.References = append(detail.References, referenceMap[u])
	}

	return detail, rows.Err()
}

func GetVulnIntelStatus(ctx context.Context, db *sql.DB, identifier string) (*VulnIntelStatus, error) {
	query := `
		SELECT last_refreshed_at, next_retry_at, fail_count, (bdu_payload IS NOT NULL) AS has_bdu
		FROM vuln_intel
		WHERE identifier = $1`
	var status VulnIntelStatus
	err := db.QueryRowContext(ctx, query, identifier).Scan(&status.LastRefreshedAt, &status.NextRetryAt, &status.FailCount, &status.HasBDUPayload)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &status, nil
}

// FIX: references -> references_payload (и не используем keyword) :contentReference[oaicite:4]{index=4}
// FIX: кап по ошибке + чистка ссылок (scheme)
func UpsertVulnIntel(ctx context.Context, db *sql.DB, record VulnIntelRecord) error {
	// harden references
	cleanRefs := make([]IntelReference, 0, len(record.References))
	seen := map[string]struct{}{}
	for _, r := range record.References {
		if len(cleanRefs) >= maxRefsPerDetail {
			break
		}
		if !isSafeHTTPURL(r.URL) {
			continue
		}
		if _, ok := seen[r.URL]; ok {
			continue
		}
		seen[r.URL] = struct{}{}
		cleanRefs = append(cleanRefs, r)
	}

	referencesJSON, err := json.Marshal(cleanRefs)
	if err != nil {
		return err
	}

	var lastErr *string
	if record.LastError != nil {
		v := truncateString(*record.LastError, maxLastErrorLen)
		lastErr = &v
	}

	query := `
		INSERT INTO vuln_intel (
			identifier, source_version, nvd_payload, epss_payload, kev_payload, bdu_payload, references_payload,
			cvss_score, cvss_version, epss_score, epss_percentile, kev,
			fail_count, last_refreshed_at, next_retry_at, last_error, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15, $16, NOW()
		)
		ON CONFLICT (identifier, source_version)
		DO UPDATE SET
			nvd_payload = EXCLUDED.nvd_payload,
			epss_payload = EXCLUDED.epss_payload,
			kev_payload = EXCLUDED.kev_payload,
			bdu_payload = EXCLUDED.bdu_payload,
			references_payload = EXCLUDED.references_payload,
			cvss_score = EXCLUDED.cvss_score,
			cvss_version = EXCLUDED.cvss_version,
			epss_score = EXCLUDED.epss_score,
			epss_percentile = EXCLUDED.epss_percentile,
			kev = EXCLUDED.kev,
			fail_count = EXCLUDED.fail_count,
			last_refreshed_at = EXCLUDED.last_refreshed_at,
			next_retry_at = EXCLUDED.next_retry_at,
			last_error = EXCLUDED.last_error,
			updated_at = NOW()`

	_, err = db.ExecContext(ctx, query,
		record.Identifier,
		record.SourceVersion,
		nullRawMessage(record.NVDPayload),
		nullRawMessage(record.EPSSPayload),
		nullRawMessage(record.KEVPayload),
		nullRawMessage(record.BDUPayload),
		nullRawMessage(referencesJSON),
		nullFloatPtr(record.CVSSScore),
		anyStringPtr(record.CVSSVersion),
		nullFloatPtr(record.EPSSScore),
		nullFloatPtr(record.EPSSPercentile),
		record.KEV,
		record.FailCount,
		nullTimePtr(record.LastRefreshedAt),
		nullTimePtr(record.NextRetryAt),
		anyStringPtr(lastErr),
	)
	return err
}

func UpdateVulnIntelError(ctx context.Context, db *sql.DB, identifier string, sourceVersion string, lastError string, nextRetryAt time.Time, failCount int) error {
	lastError = truncateString(lastError, maxLastErrorLen)
	query := `
		INSERT INTO vuln_intel (identifier, source_version, last_error, next_retry_at, fail_count, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (identifier, source_version)
		DO UPDATE SET
			last_error = EXCLUDED.last_error,
			next_retry_at = EXCLUDED.next_retry_at,
			fail_count = EXCLUDED.fail_count,
			updated_at = NOW()`
	_, err := db.ExecContext(ctx, query, identifier, sourceVersion, lastError, nextRetryAt, failCount)
	return err
}

// expandBDUArrayPayload checks whether the BDU payload is a JSON array
// (produced by CWE-based BDU search). If so, it returns individual entries
// keyed by their "identifier" field (e.g. "BDU:2023-04393"). For single-
// object payloads (CVE-based search) it returns nil so the caller uses
// the original payload as-is.
func expandBDUArrayPayload(payload []byte) map[string]json.RawMessage {
	if len(payload) == 0 || payload[0] != '[' {
		return nil
	}
	var entries []json.RawMessage
	if err := json.Unmarshal(payload, &entries); err != nil || len(entries) == 0 {
		return nil
	}
	result := make(map[string]json.RawMessage, len(entries))
	for i, entry := range entries {
		var doc struct {
			Identifier string `json:"identifier"`
		}
		key := ""
		if json.Unmarshal(entry, &doc) == nil && doc.Identifier != "" {
			key = doc.Identifier
		}
		if key == "" {
			key = fmt.Sprintf("BDU#%03d", i)
		}
		result[key] = entry
	}
	return result
}

func nullRawMessage(payload []byte) any {
	if len(payload) == 0 {
		return nil
	}
	return payload
}

func nullFloatPtr(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullTimePtr(value *time.Time) any {
	if value == nil {
		return nil
	}
	return *value
}
