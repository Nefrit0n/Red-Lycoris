package storage

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

// BDUVulnerability represents a row from the local bdu_vulnerabilities table.
type BDUVulnerability struct {
	BDUID              string `json:"bdu_id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Vendor             string `json:"vendor"`
	SoftwareName       string `json:"software_name"`
	SoftwareVersion    string `json:"software_version"`
	SoftwareType       string `json:"software_type"`
	OSHardware         string `json:"os_hardware"`
	VulnClass          string `json:"vuln_class"`
	DetectionDate      string `json:"detection_date"`
	CVSSV2             string `json:"cvss_v2"`
	CVSSV3             string `json:"cvss_v3"`
	CVSSV4             string `json:"cvss_v4"`
	Severity           string `json:"severity"`
	Remediation        string `json:"remediation"`
	Status             string `json:"status"`
	ExploitExists      string `json:"exploit_exists"`
	FixInfo            string `json:"fix_info"`
	SourceURLs         string `json:"source_urls"`
	OtherIDs           string `json:"other_ids"`
	OtherInfo          string `json:"other_info"`
	IncidentInfo       string `json:"incident_info"`
	ExploitationMethod string `json:"exploitation_method"`
	FixMethod          string `json:"fix_method"`
	PublishedDate      string `json:"published_date"`
	UpdatedDate        string `json:"updated_date"`
	Consequences       string `json:"consequences"`
	VulnState          string `json:"vuln_state"`
	CWEDescription     string `json:"cwe_description"`
	CWEID              string `json:"cwe_id"`
}

type BDUIdentifierMapping struct {
	Identifier string
	BDUID      string
}

// BDUSyncStatus represents the singleton sync status row.
type BDUSyncStatus struct {
	LastSyncedAt      *time.Time `json:"last_synced_at"`
	RecordCount       int        `json:"record_count"`
	SyncIntervalHours int        `json:"sync_interval_hours"`
	LastError         *string    `json:"last_error"`
	IsSyncing         bool       `json:"is_syncing"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// GetBDUByIdentifiers looks up BDU vulnerabilities matching the given
// identifiers (CVE/CWE) through the bdu_identifier_map table.
func GetBDUByIdentifiers(ctx context.Context, db *sql.DB, identifiers []string) ([]BDUVulnerability, error) {
	if len(identifiers) == 0 {
		return nil, nil
	}

	query := `
		SELECT DISTINCT
			bv.bdu_id, bv.name, bv.description, bv.vendor,
			bv.software_name, bv.software_version, bv.software_type, bv.os_hardware,
			bv.vuln_class, bv.detection_date,
			bv.cvss_v2, bv.cvss_v3, bv.cvss_v4, bv.severity,
			bv.remediation, bv.status, bv.exploit_exists, bv.fix_info,
			bv.source_urls, bv.other_ids, bv.other_info, bv.incident_info,
			bv.exploitation_method, bv.fix_method, bv.published_date, bv.updated_date,
			bv.consequences, bv.vuln_state, bv.cwe_description, bv.cwe_id
		FROM bdu_identifier_map bim
		JOIN bdu_vulnerabilities bv ON bv.bdu_id = bim.bdu_id
		WHERE bim.identifier = ANY($1::text[])
		ORDER BY bv.bdu_id
		LIMIT 50`

	rows, err := db.QueryContext(ctx, query, pq.Array(identifiers))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []BDUVulnerability
	for rows.Next() {
		var v BDUVulnerability
		if err := rows.Scan(
			&v.BDUID, &v.Name, &v.Description, &v.Vendor,
			&v.SoftwareName, &v.SoftwareVersion, &v.SoftwareType, &v.OSHardware,
			&v.VulnClass, &v.DetectionDate,
			&v.CVSSV2, &v.CVSSV3, &v.CVSSV4, &v.Severity,
			&v.Remediation, &v.Status, &v.ExploitExists, &v.FixInfo,
			&v.SourceURLs, &v.OtherIDs, &v.OtherInfo, &v.IncidentInfo,
			&v.ExploitationMethod, &v.FixMethod, &v.PublishedDate, &v.UpdatedDate,
			&v.Consequences, &v.VulnState, &v.CWEDescription, &v.CWEID,
		); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

// GetBDUSyncStatus returns the current BDU sync status.
func GetBDUSyncStatus(ctx context.Context, db *sql.DB) (*BDUSyncStatus, error) {
	query := `
		SELECT last_synced_at, record_count, sync_interval_hours,
		       last_error, is_syncing, updated_at
		FROM bdu_sync_status WHERE id = 1`

	var s BDUSyncStatus
	var lastSynced sql.NullTime
	var lastErr sql.NullString

	err := db.QueryRowContext(ctx, query).Scan(
		&lastSynced, &s.RecordCount, &s.SyncIntervalHours,
		&lastErr, &s.IsSyncing, &s.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if lastSynced.Valid {
		s.LastSyncedAt = &lastSynced.Time
	}
	if lastErr.Valid {
		s.LastError = &lastErr.String
	}
	return &s, nil
}

// UpdateBDUSyncInterval sets the sync interval in hours.
func UpdateBDUSyncInterval(ctx context.Context, db *sql.DB, hours int) error {
	_, err := db.ExecContext(ctx,
		"UPDATE bdu_sync_status SET sync_interval_hours = $1, updated_at = NOW() WHERE id = 1",
		hours,
	)
	return err
}

func MarkBDUSyncStarted(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx,
		"UPDATE bdu_sync_status SET is_syncing = TRUE, last_error = NULL, updated_at = NOW() WHERE id = 1",
	)
	return err
}

func MarkBDUSyncFailed(ctx context.Context, db *sql.DB, errText string) error {
	errText = strings.TrimSpace(errText)
	if errText == "" {
		errText = "unknown bdu sync error"
	}
	_, err := db.ExecContext(ctx,
		"UPDATE bdu_sync_status SET is_syncing = FALSE, last_error = $1, updated_at = NOW() WHERE id = 1",
		errText,
	)
	return err
}

func ReplaceBDUDataset(ctx context.Context, db *sql.DB, vulns []BDUVulnerability, mappings []BDUIdentifierMapping, syncedAt time.Time) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, "DELETE FROM bdu_identifier_map"); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM bdu_vulnerabilities"); err != nil {
		return err
	}

	vulnStmt, err := tx.PrepareContext(ctx, `
		INSERT INTO bdu_vulnerabilities (
			bdu_id, name, description, vendor, software_name, software_version,
			software_type, os_hardware, vuln_class, detection_date,
			cvss_v2, cvss_v3, cvss_v4, severity, remediation, status,
			exploit_exists, fix_info, source_urls, other_ids, other_info,
			incident_info, exploitation_method, fix_method, published_date,
			updated_date, consequences, vuln_state, cwe_description, cwe_id, synced_at
		) VALUES (
			$1,$2,$3,$4,$5,$6,
			$7,$8,$9,$10,
			$11,$12,$13,$14,$15,$16,
			$17,$18,$19,$20,$21,
			$22,$23,$24,$25,
			$26,$27,$28,$29,$30,$31
		)`)
	if err != nil {
		return err
	}
	defer vulnStmt.Close()

	for _, v := range vulns {
		if strings.TrimSpace(v.BDUID) == "" {
			continue
		}
		if _, err := vulnStmt.ExecContext(ctx,
			v.BDUID, v.Name, v.Description, v.Vendor, v.SoftwareName, v.SoftwareVersion,
			v.SoftwareType, v.OSHardware, v.VulnClass, v.DetectionDate,
			v.CVSSV2, v.CVSSV3, v.CVSSV4, v.Severity, v.Remediation, v.Status,
			v.ExploitExists, v.FixInfo, v.SourceURLs, v.OtherIDs, v.OtherInfo,
			v.IncidentInfo, v.ExploitationMethod, v.FixMethod, v.PublishedDate,
			v.UpdatedDate, v.Consequences, v.VulnState, v.CWEDescription, v.CWEID, syncedAt,
		); err != nil {
			return fmt.Errorf("insert bdu vulnerability %s: %w", v.BDUID, err)
		}
	}

	mapStmt, err := tx.PrepareContext(ctx, `
		INSERT INTO bdu_identifier_map (identifier, bdu_id)
		VALUES ($1, $2)
		ON CONFLICT (identifier, bdu_id) DO NOTHING`)
	if err != nil {
		return err
	}
	defer mapStmt.Close()

	for _, m := range mappings {
		if strings.TrimSpace(m.Identifier) == "" || strings.TrimSpace(m.BDUID) == "" {
			continue
		}
		if _, err := mapStmt.ExecContext(ctx, m.Identifier, m.BDUID); err != nil {
			return fmt.Errorf("insert bdu identifier mapping %s->%s: %w", m.Identifier, m.BDUID, err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE bdu_sync_status
		SET is_syncing = FALSE,
			last_error = NULL,
			last_synced_at = $1,
			record_count = $2,
			updated_at = NOW()
		WHERE id = 1`, syncedAt, len(vulns)); err != nil {
		return err
	}

	return tx.Commit()
}
