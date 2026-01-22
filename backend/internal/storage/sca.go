package storage

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type ScaFindingDetail struct {
	FindingID        uuid.UUID
	ComponentID      uuid.UUID
	ComponentName    string
	Ecosystem        sql.NullString
	Purl             sql.NullString
	InstalledVersion string
	FixedVersion     sql.NullString
	VulnerabilityID  string
	PrimaryURL       sql.NullString
	RawSeverity      sql.NullString
}

func UpsertScaComponentTx(ctx context.Context, tx *sql.Tx, name string, ecosystem *string, purl *string) (uuid.UUID, error) {
	if purl != nil && *purl != "" {
		var existingID uuid.UUID
		err := tx.QueryRowContext(
			ctx,
			`SELECT id FROM sca_components WHERE purl = $1 LIMIT 1`,
			*purl,
		).Scan(&existingID)
		if err == nil {
			return existingID, nil
		}
		if err != sql.ErrNoRows {
			return uuid.UUID{}, err
		}
	}

	var existingID uuid.UUID
	err := tx.QueryRowContext(
		ctx,
		`SELECT id
		 FROM sca_components
		 WHERE name = $1
		   AND ecosystem IS NOT DISTINCT FROM $2
		   AND purl IS NULL
		 LIMIT 1`,
		name,
		ecosystem,
	).Scan(&existingID)
	if err == nil {
		return existingID, nil
	}
	if err != sql.ErrNoRows {
		return uuid.UUID{}, err
	}

	id := uuid.New()
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO sca_components (id, purl, ecosystem, name)
		 VALUES ($1, $2, $3, $4)`,
		id,
		nullStringPtr(purl),
		nullStringPtr(ecosystem),
		name,
	)
	if err != nil {
		return uuid.UUID{}, err
	}
	return id, nil
}

func CreateScaFindingTx(ctx context.Context, tx *sql.Tx, detail ScaFindingDetail) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO sca_findings (finding_id, component_id, installed_version, fixed_version, vulnerability_id, primary_url, raw_severity)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (finding_id) DO UPDATE
		 SET component_id = EXCLUDED.component_id,
		     installed_version = EXCLUDED.installed_version,
		     fixed_version = EXCLUDED.fixed_version,
		     vulnerability_id = EXCLUDED.vulnerability_id,
		     primary_url = EXCLUDED.primary_url,
		     raw_severity = EXCLUDED.raw_severity`,
		detail.FindingID,
		detail.ComponentID,
		detail.InstalledVersion,
		nullableString(detail.FixedVersion),
		detail.VulnerabilityID,
		nullableString(detail.PrimaryURL),
		nullableString(detail.RawSeverity),
	)
	return err
}

func GetScaFindingDetail(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*ScaFindingDetail, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT sf.finding_id, c.id, c.name, c.ecosystem, c.purl,
		        sf.installed_version, sf.fixed_version, sf.vulnerability_id, sf.primary_url, sf.raw_severity
		 FROM sca_findings sf
		 JOIN sca_components c ON c.id = sf.component_id
		 WHERE sf.finding_id = $1`,
		findingID,
	)

	var detail ScaFindingDetail
	if err := row.Scan(
		&detail.FindingID,
		&detail.ComponentID,
		&detail.ComponentName,
		&detail.Ecosystem,
		&detail.Purl,
		&detail.InstalledVersion,
		&detail.FixedVersion,
		&detail.VulnerabilityID,
		&detail.PrimaryURL,
		&detail.RawSeverity,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &detail, nil
}

func nullableString(value sql.NullString) *string {
	if value.Valid {
		return &value.String
	}
	return nil
}
