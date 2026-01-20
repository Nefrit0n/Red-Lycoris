package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
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
	References      []IntelReference
	CVSSScore       *float64
	CVSSVersion     *string
	EPSSScore       *float64
	EPSSPercentile  *float64
	KEV             bool
	LastRefreshedAt *time.Time
	NextRetryAt     *time.Time
	LastError       *string
}

type VulnIntelStatus struct {
	LastRefreshedAt sql.NullTime
	NextRetryAt     sql.NullTime
}

func UpsertFindingIdentifiers(ctx context.Context, db *sql.DB, findingID uuid.UUID, identifiers []string) error {
	if len(identifiers) == 0 {
		return nil
	}
	query := `
		INSERT INTO finding_vuln_identifiers (finding_id, identifier)
		VALUES ($1, $2)
		ON CONFLICT (finding_id, identifier) DO NOTHING`
	for _, identifier := range identifiers {
		if _, err := db.ExecContext(ctx, query, findingID, identifier); err != nil {
			return err
		}
	}
	return nil
}

func ListRecentIdentifiers(ctx context.Context, db *sql.DB, productID *uuid.UUID, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 200
	}
	query := `
		SELECT fvi.identifier
		FROM finding_vuln_identifiers fvi
		JOIN findings f ON f.id = fvi.finding_id
		WHERE f.deleted_at IS NULL`
	args := []interface{}{}
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

	var identifiers []string
	for rows.Next() {
		var identifier string
		if err := rows.Scan(&identifier); err != nil {
			return nil, err
		}
		identifiers = append(identifiers, identifier)
	}
	return identifiers, rows.Err()
}

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
		WHERE fvi.finding_id = ANY($1)
		GROUP BY fvi.finding_id`

	rows, err := db.QueryContext(ctx, query, findingIDs)
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
			&identifiers,
			&cvssScore,
			&cvssVersion,
			&epssScore,
			&epssPercentile,
			&kev,
			&lastRefreshedAt,
		); err != nil {
			return nil, err
		}
		summary := IntelSummary{
			Identifiers: identifiers,
			KEV:         kev,
		}
		if cvssScore.Valid {
			value := cvssScore.Float64
			summary.CVSSScore = &value
		}
		if cvssVersion.Valid {
			value := cvssVersion.String
			summary.CVSSVersion = &value
		}
		if epssScore.Valid {
			value := epssScore.Float64
			summary.EPSSScore = &value
		}
		if epssPercentile.Valid {
			value := epssPercentile.Float64
			summary.EPSSPercentile = &value
		}
		if lastRefreshedAt.Valid {
			value := lastRefreshedAt.Time
			summary.LastRefreshedAt = &value
		}
		results[findingID] = summary
	}
	return results, rows.Err()
}

func GetIntelDetail(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*IntelDetail, error) {
	query := `
		SELECT
			fvi.identifier,
			vi.nvd_payload,
			vi.epss_payload,
			vi.kev_payload,
			vi.references,
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
	}
	referenceMap := map[string]IntelReference{}
	var latestUpdated time.Time
	for rows.Next() {
		var identifier string
		var nvdPayload []byte
		var epssPayload []byte
		var kevPayload []byte
		var referencesPayload []byte
		var updatedAt sql.NullTime
		if err := rows.Scan(
			&identifier,
			&nvdPayload,
			&epssPayload,
			&kevPayload,
			&referencesPayload,
			&updatedAt,
		); err != nil {
			return nil, err
		}
		detail.Identifiers = append(detail.Identifiers, identifier)
		if len(nvdPayload) > 0 {
			detail.NVD[identifier] = json.RawMessage(nvdPayload)
		}
		if len(epssPayload) > 0 {
			detail.EPSS[identifier] = json.RawMessage(epssPayload)
		}
		if len(kevPayload) > 0 {
			detail.KEV[identifier] = json.RawMessage(kevPayload)
		}
		if len(referencesPayload) > 0 {
			var refs []IntelReference
			if err := json.Unmarshal(referencesPayload, &refs); err == nil {
				for _, ref := range refs {
					referenceMap[ref.URL] = ref
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
		value := latestUpdated
		detail.UpdatedAt = &value
	}
	for _, ref := range referenceMap {
		detail.References = append(detail.References, ref)
	}
	return detail, rows.Err()
}

func GetVulnIntelStatus(ctx context.Context, db *sql.DB, identifier string) (*VulnIntelStatus, error) {
	query := `
		SELECT last_refreshed_at, next_retry_at
		FROM vuln_intel
		WHERE identifier = $1`
	var status VulnIntelStatus
	err := db.QueryRowContext(ctx, query, identifier).Scan(&status.LastRefreshedAt, &status.NextRetryAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &status, nil
}

func UpsertVulnIntel(ctx context.Context, db *sql.DB, record VulnIntelRecord) error {
	referencesJSON, err := json.Marshal(record.References)
	if err != nil {
		return err
	}
	query := `
		INSERT INTO vuln_intel (
			identifier, source_version, nvd_payload, epss_payload, kev_payload, references,
			cvss_score, cvss_version, epss_score, epss_percentile, kev,
			last_refreshed_at, next_retry_at, last_error, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, NOW()
		)
		ON CONFLICT (identifier, source_version)
		DO UPDATE SET
			nvd_payload = EXCLUDED.nvd_payload,
			epss_payload = EXCLUDED.epss_payload,
			kev_payload = EXCLUDED.kev_payload,
			references = EXCLUDED.references,
			cvss_score = EXCLUDED.cvss_score,
			cvss_version = EXCLUDED.cvss_version,
			epss_score = EXCLUDED.epss_score,
			epss_percentile = EXCLUDED.epss_percentile,
			kev = EXCLUDED.kev,
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
		nullRawMessage(referencesJSON),
		nullFloatPtr(record.CVSSScore),
		nullStringPtr(record.CVSSVersion),
		nullFloatPtr(record.EPSSScore),
		nullFloatPtr(record.EPSSPercentile),
		record.KEV,
		nullTimePtr(record.LastRefreshedAt),
		nullTimePtr(record.NextRetryAt),
		nullStringPtr(record.LastError),
	)
	return err
}

func UpdateVulnIntelError(ctx context.Context, db *sql.DB, identifier string, sourceVersion string, lastError string, nextRetryAt time.Time) error {
	query := `
		INSERT INTO vuln_intel (identifier, source_version, last_error, next_retry_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (identifier, source_version)
		DO UPDATE SET
			last_error = EXCLUDED.last_error,
			next_retry_at = EXCLUDED.next_retry_at,
			updated_at = NOW()`
	_, err := db.ExecContext(ctx, query, identifier, sourceVersion, lastError, nextRetryAt)
	return err
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
