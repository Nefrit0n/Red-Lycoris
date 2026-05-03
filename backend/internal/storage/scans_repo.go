package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type ScansRepo struct{ pool *pgxpool.Pool }

func NewScansRepo(pool *pgxpool.Pool) *ScansRepo { return &ScansRepo{pool: pool} }

type ScanListFilter struct {
	ProjectID uuid.UUID
	Branch    string
	Scanner   string
	Status    string
	Cursor    string
	Limit     int
}

type scanCursor struct {
	StartedAt time.Time `json:"started_at"`
	ID        uuid.UUID `json:"id"`
}

func encodeScanCursor(c scanCursor) string {
	b, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(b)
}
func decodeScanCursor(s string) (scanCursor, error) {
	var c scanCursor
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return c, err
	}
	err = json.Unmarshal(b, &c)
	return c, err
}

func (r *ScansRepo) Create(ctx context.Context, tx pgx.Tx, scan *domain.Scan) error {
	const q = `INSERT INTO scans (id, project_id, commit_sha, branch, scanner, scanner_version, ci_job_url, status, token_id, triggered_by_user_id, asset_hint, raw_report_size)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`
	if scan.ID == uuid.Nil {
		scan.ID = uuid.New()
	}
	_, err := tx.Exec(ctx, q, scan.ID, scan.ProjectID, scan.CommitSHA, scan.Branch, scan.Scanner, scan.ScannerVersion, scan.CIJobURL, scan.Status, scan.TokenID, scan.TriggeredByUser, scan.AssetHint, scan.RawReportSize)
	return err
}

func (r *ScansRepo) Complete(ctx context.Context, tx pgx.Tx, scanID uuid.UUID, status domain.ScanStatus, scanner string, imported, updated int) error {
	const q = `UPDATE scans SET finished_at = now(), status = $2, scanner = $3, findings_imported = $4, findings_updated = $5 WHERE id = $1`
	_, err := tx.Exec(ctx, q, scanID, status, scanner, imported, updated)
	return err
}

func (r *ScansRepo) Fail(ctx context.Context, scanID uuid.UUID) error {
	const q = `UPDATE scans SET finished_at = now(), status = 'failed', findings_imported = 0, findings_updated = 0 WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, scanID)
	return err
}

func (r *ScansRepo) LinkFinding(ctx context.Context, tx pgx.Tx, findingID, scanID uuid.UUID, isNew bool) error {
	const q = `INSERT INTO finding_scan_links (finding_id, scan_id, is_new) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`
	_, err := tx.Exec(ctx, q, findingID, scanID, isNew)
	return err
}

func (r *ScansRepo) ListByProject(ctx context.Context, f ScanListFilter) ([]domain.Scan, string, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	conds := []string{"project_id = $1"}
	args := []any{f.ProjectID}
	argN := 2
	if strings.TrimSpace(f.Branch) != "" {
		conds = append(conds, fmt.Sprintf("branch=$%d", argN))
		args = append(args, f.Branch)
		argN++
	}
	if strings.TrimSpace(f.Scanner) != "" {
		conds = append(conds, fmt.Sprintf("scanner=$%d", argN))
		args = append(args, f.Scanner)
		argN++
	}
	if strings.TrimSpace(f.Status) != "" {
		conds = append(conds, fmt.Sprintf("status=$%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if strings.TrimSpace(f.Cursor) != "" {
		c, err := decodeScanCursor(f.Cursor)
		if err == nil {
			conds = append(conds, fmt.Sprintf("(started_at,id) < ($%d,$%d)", argN, argN+1))
			args = append(args, c.StartedAt, c.ID)
			argN += 2
		}
	}
	args = append(args, f.Limit+1)
	q := `SELECT id, project_id, commit_sha, branch, scanner, scanner_version, ci_job_url, started_at, finished_at, findings_imported, findings_updated, status, token_id, triggered_by_user_id, asset_hint, raw_report_size
FROM scans WHERE ` + strings.Join(conds, " AND ") + ` ORDER BY started_at DESC, id DESC LIMIT $` + fmt.Sprint(argN)
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	out := make([]domain.Scan, 0, f.Limit)
	for rows.Next() {
		var s domain.Scan
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.CommitSHA, &s.Branch, &s.Scanner, &s.ScannerVersion, &s.CIJobURL, &s.StartedAt, &s.FinishedAt, &s.FindingsImported, &s.FindingsUpdated, &s.Status, &s.TokenID, &s.TriggeredByUser, &s.AssetHint, &s.RawReportSize); err != nil {
			return nil, "", err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	next := ""
	if len(out) > f.Limit {
		last := out[f.Limit-1]
		next = encodeScanCursor(scanCursor{StartedAt: last.StartedAt, ID: last.ID})
		out = out[:f.Limit]
	}
	return out, next, nil
}

func (r *ScansRepo) Get(ctx context.Context, id uuid.UUID) (*domain.Scan, error) {
	const q = `SELECT id, project_id, commit_sha, branch, scanner, scanner_version, ci_job_url, started_at, finished_at, findings_imported, findings_updated, status, token_id, triggered_by_user_id, asset_hint, raw_report_size FROM scans WHERE id=$1`
	var s domain.Scan
	if err := r.pool.QueryRow(ctx, q, id).Scan(&s.ID, &s.ProjectID, &s.CommitSHA, &s.Branch, &s.Scanner, &s.ScannerVersion, &s.CIJobURL, &s.StartedAt, &s.FinishedAt, &s.FindingsImported, &s.FindingsUpdated, &s.Status, &s.TokenID, &s.TriggeredByUser, &s.AssetHint, &s.RawReportSize); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *ScansRepo) ListFindings(ctx context.Context, scanID uuid.UUID, limit int) ([]domain.ScanFinding, error) {
	if limit <= 0 || limit > 200 {
		limit = 200
	}
	q := `SELECT ` + findingColumns + `, l.is_new
FROM finding_scan_links l
JOIN findings f ON f.id = l.finding_id
LEFT JOIN finding_scores fs ON fs.finding_id = f.id
WHERE l.scan_id = $1
ORDER BY f.severity DESC, f.id
LIMIT $2`
	rows, err := r.pool.Query(ctx, q, scanID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.ScanFinding, 0, limit)
	for rows.Next() {
		var sf domain.ScanFinding
		var kind int16
		if err := rows.Scan(
			&sf.ID, &kind, &sf.Title, &sf.Description, &sf.Severity, &sf.Confidence, &sf.Status,
			&sf.FilePath, &sf.LineStart, &sf.LineEnd, &sf.Component, &sf.ComponentVersion,
			&sf.CVEIDs, &sf.CWEIDs, &sf.CPEURI, &sf.Fingerprint, &sf.FirstSeen, &sf.LastSeen,
			&sf.TimesSeen, &sf.ProjectID, &sf.SourceType, &sf.FixedVersion, &sf.PackageEcosystem,
			&sf.Purl, &sf.CodeSnippet, &sf.CodeFlow, &sf.URL, &sf.HTTPMethod, &sf.HTTPParam,
			&sf.HTTPEvidence, &sf.IacResource, &sf.IacProvider, &sf.SecretKind, &sf.CommitSHA,
			&sf.RuleID, &sf.RuleName, &sf.PriorityScore,
			&sf.ClosureReasonID, &sf.ClosureNote, &sf.ClosedAt, &sf.ClosedBy, &sf.AssignedTo,
			&sf.IsNew,
		); err != nil {
			return nil, err
		}
		sf.Kind = domain.FindingKind(kind)
		out = append(out, sf)
	}
	return out, rows.Err()
}

func (r *ScansRepo) ListRecentForFinding(ctx context.Context, findingID uuid.UUID, limit int) ([]domain.Scan, error) {
	if limit <= 0 || limit > 50 {
		limit = 5
	}
	q := `SELECT s.id, s.project_id, s.commit_sha, s.branch, s.scanner, s.scanner_version, s.ci_job_url, s.started_at, s.finished_at, s.findings_imported, s.findings_updated, s.status, s.token_id, s.triggered_by_user_id, s.asset_hint, s.raw_report_size
FROM finding_scan_links l
JOIN scans s ON s.id = l.scan_id
WHERE l.finding_id = $1
ORDER BY s.started_at DESC
LIMIT $2`
	rows, err := r.pool.Query(ctx, q, findingID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.Scan, 0, limit)
	for rows.Next() {
		var s domain.Scan
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.CommitSHA, &s.Branch, &s.Scanner, &s.ScannerVersion, &s.CIJobURL, &s.StartedAt, &s.FinishedAt, &s.FindingsImported, &s.FindingsUpdated, &s.Status, &s.TokenID, &s.TriggeredByUser, &s.AssetHint, &s.RawReportSize); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
