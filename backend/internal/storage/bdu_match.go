package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

// BDUComponentMatch represents a row from the BDU-SBOM component name match query.
type BDUComponentMatch struct {
	ComponentID      uuid.UUID
	ComponentName    string
	ComponentVersion string

	BDUID              string
	BDUName            string
	BDUDescription     string
	Severity           string
	CVSSV2             string
	CVSSV3             string
	CVSSV4             string
	SoftwareName       string
	SoftwareVersion    string
	SoftwareType       string
	OSHardware         string
	ExploitExists      string
	CWEID              string
	CWEDescription     string
	Status             string
	VulnClass          string
	Vendor             string
	Remediation        string
	FixInfo            string
	SourceURLs         string
	OtherIDs           string
	OtherInfo          string
	IncidentInfo       string
	ExploitationMethod string
	FixMethod          string
	DetectionDate      string
	PublishedDate      string
	UpdatedDate        string
	VulnState          string
}

// ListBDUMatchesByName returns BDU vulnerabilities matched by software_name to SBOM component names.
// Version filtering is done in the caller (Go-level) because BDU version strings require complex parsing.
func ListBDUMatchesByName(ctx context.Context, db *sql.DB, sbomID uuid.UUID, search string) ([]BDUComponentMatch, error) {
	query := `
SELECT
    c.id AS component_id,
    c.name AS component_name,
    sco.version AS component_version,
    bv.bdu_id,
    bv.name,
    bv.description,
    bv.severity,
    bv.cvss_v2,
    bv.cvss_v3,
    bv.cvss_v4,
    bv.software_name,
    bv.software_version,
    bv.software_type,
    bv.os_hardware,
    bv.exploit_exists,
    bv.cwe_id,
    bv.cwe_description,
    bv.status,
    bv.vuln_class,
    bv.vendor,
    bv.remediation,
    bv.fix_info,
    bv.source_urls,
    bv.other_ids,
    bv.other_info,
    bv.incident_info,
    bv.exploitation_method,
    bv.fix_method,
    bv.detection_date,
    bv.published_date,
    bv.updated_date,
    bv.vuln_state
FROM sbom_component_occurrences sco
JOIN sca_components c ON c.id = sco.component_id
JOIN bdu_vulnerabilities bv
  ON md5(LOWER(bv.software_name)) = md5(LOWER(c.name))
 AND LOWER(bv.software_name) = LOWER(c.name)
WHERE sco.sbom_id = $1
`

	args := []interface{}{sbomID}

	if search != "" {
		query += ` AND (bv.bdu_id ILIKE $2 OR bv.name ILIKE $2 OR c.name ILIKE $2)`
		args = append(args, "%"+search+"%")
	}

	query += `
ORDER BY c.name, bv.bdu_id
LIMIT 10000`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []BDUComponentMatch
	for rows.Next() {
		var m BDUComponentMatch
		if err := rows.Scan(
			&m.ComponentID,
			&m.ComponentName,
			&m.ComponentVersion,
			&m.BDUID,
			&m.BDUName,
			&m.BDUDescription,
			&m.Severity,
			&m.CVSSV2,
			&m.CVSSV3,
			&m.CVSSV4,
			&m.SoftwareName,
			&m.SoftwareVersion,
			&m.SoftwareType,
			&m.OSHardware,
			&m.ExploitExists,
			&m.CWEID,
			&m.CWEDescription,
			&m.Status,
			&m.VulnClass,
			&m.Vendor,
			&m.Remediation,
			&m.FixInfo,
			&m.SourceURLs,
			&m.OtherIDs,
			&m.OtherInfo,
			&m.IncidentInfo,
			&m.ExploitationMethod,
			&m.FixMethod,
			&m.DetectionDate,
			&m.PublishedDate,
			&m.UpdatedDate,
			&m.VulnState,
		); err != nil {
			return nil, err
		}
		results = append(results, m)
	}
	return results, rows.Err()
}

// ListBDUComponentMatches returns BDU vulnerabilities matched via the bdu_components table
// (parsed from the "Компоненты" sheet). Fuzzy name matching: SBOM component name is checked
// against bdu_components.software_name using case-insensitive substring containment.
func ListBDUComponentMatches(ctx context.Context, db *sql.DB, sbomID uuid.UUID, search string) ([]BDUComponentMatch, error) {
	query := `
SELECT
    c.id AS component_id,
    c.name AS component_name,
    sco.version AS component_version,
    bv.bdu_id,
    bv.name,
    bv.description,
    bv.severity,
    bv.cvss_v2,
    bv.cvss_v3,
    bv.cvss_v4,
    bc.software_name,
    bc.software_version,
    bv.software_type,
    bv.os_hardware,
    bv.exploit_exists,
    bv.cwe_id,
    bv.cwe_description,
    bv.status,
    bv.vuln_class,
    bc.vendor,
    bv.remediation,
    bv.fix_info,
    bv.source_urls,
    bv.other_ids,
    bv.other_info,
    bv.incident_info,
    bv.exploitation_method,
    bv.fix_method,
    bv.detection_date,
    bv.published_date,
    bv.updated_date,
    bv.vuln_state
FROM sbom_component_occurrences sco
JOIN sca_components c ON c.id = sco.component_id
JOIN bdu_components bc ON (
    LOWER(bc.software_name) LIKE '%%' || LOWER(c.name) || '%%'
    OR LOWER(c.name) LIKE '%%' || LOWER(bc.software_name) || '%%'
)
JOIN bdu_vulnerabilities bv ON bc.bdu_id = bv.bdu_id
WHERE sco.sbom_id = $1
`

	args := []interface{}{sbomID}

	if search != "" {
		query += ` AND (bv.bdu_id ILIKE $2 OR bv.name ILIKE $2 OR c.name ILIKE $2)`
		args = append(args, "%"+search+"%")
	}

	query += `
ORDER BY c.name, bv.bdu_id
LIMIT 10000`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []BDUComponentMatch
	for rows.Next() {
		var m BDUComponentMatch
		if err := rows.Scan(
			&m.ComponentID,
			&m.ComponentName,
			&m.ComponentVersion,
			&m.BDUID,
			&m.BDUName,
			&m.BDUDescription,
			&m.Severity,
			&m.CVSSV2,
			&m.CVSSV3,
			&m.CVSSV4,
			&m.SoftwareName,
			&m.SoftwareVersion,
			&m.SoftwareType,
			&m.OSHardware,
			&m.ExploitExists,
			&m.CWEID,
			&m.CWEDescription,
			&m.Status,
			&m.VulnClass,
			&m.Vendor,
			&m.Remediation,
			&m.FixInfo,
			&m.SourceURLs,
			&m.OtherIDs,
			&m.OtherInfo,
			&m.IncidentInfo,
			&m.ExploitationMethod,
			&m.FixMethod,
			&m.DetectionDate,
			&m.PublishedDate,
			&m.UpdatedDate,
			&m.VulnState,
		); err != nil {
			return nil, err
		}
		results = append(results, m)
	}
	return results, rows.Err()
}
