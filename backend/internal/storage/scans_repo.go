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

// scanColumns — фиксированный набор колонок для SELECT scans.
const scanColumns = `id, project_id, ci_pipeline_id, commit_sha, branch, ci_job_url,
	status, completion, started_at, completed_at, findings_imported, findings_updated,
	token_id, asset_hint`

func scanFromRow(row pgx.Row) (*domain.Scan, error) {
	var s domain.Scan
	if err := row.Scan(
		&s.ID, &s.ProjectID, &s.CIPipelineID, &s.CommitSHA, &s.Branch, &s.CIJobURL,
		&s.Status, &s.Completion, &s.StartedAt, &s.CompletedAt,
		&s.FindingsImported, &s.FindingsUpdated,
		&s.TokenID, &s.AssetHint,
	); err != nil {
		return nil, err
	}
	return &s, nil
}

func scanFromRows(rows pgx.Rows) (*domain.Scan, error) {
	var s domain.Scan
	if err := rows.Scan(
		&s.ID, &s.ProjectID, &s.CIPipelineID, &s.CommitSHA, &s.Branch, &s.CIJobURL,
		&s.Status, &s.Completion, &s.StartedAt, &s.CompletedAt,
		&s.FindingsImported, &s.FindingsUpdated,
		&s.TokenID, &s.AssetHint,
	); err != nil {
		return nil, err
	}
	return &s, nil
}

// UpsertByPipeline вставляет новый скан с заданным pipeline_id или находит
// существующий, если UNIQUE(project_id, ci_pipeline_id) уже занят.
// Возвращает скан и флаг created=true при первой вставке.
func (r *ScansRepo) UpsertByPipeline(ctx context.Context, tx pgx.Tx, scan *domain.Scan) (created bool, err error) {
	if scan.ID == uuid.Nil {
		scan.ID = uuid.New()
	}
	const q = `
INSERT INTO scans (id, project_id, ci_pipeline_id, commit_sha, branch, ci_job_url, status, token_id, asset_hint)
VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
ON CONFLICT (project_id, ci_pipeline_id) WHERE ci_pipeline_id IS NOT NULL
DO NOTHING`
	tag, err := tx.Exec(ctx, q,
		scan.ID, scan.ProjectID, scan.CIPipelineID,
		scan.CommitSHA, scan.Branch, scan.CIJobURL,
		scan.TokenID, scan.AssetHint,
	)
	if err != nil {
		return false, fmt.Errorf("storage.UpsertByPipeline insert: %w", err)
	}
	if tag.RowsAffected() == 1 {
		return true, nil
	}
	// Конфликт — найти существующий скан.
	const sel = `SELECT ` + scanColumns + ` FROM scans WHERE project_id=$1 AND ci_pipeline_id=$2`
	found, err := scanFromRow(tx.QueryRow(ctx, sel, scan.ProjectID, scan.CIPipelineID))
	if err != nil {
		return false, fmt.Errorf("storage.UpsertByPipeline select: %w", err)
	}
	*scan = *found
	return false, nil
}

// CreateSingle создаёт скан без pipeline_id (синтетический, ручная загрузка).
// Вызывающий должен сразу закрыть его после tool-run через CompleteScan.
func (r *ScansRepo) CreateSingle(ctx context.Context, tx pgx.Tx, scan *domain.Scan) error {
	if scan.ID == uuid.Nil {
		scan.ID = uuid.New()
	}
	const q = `
INSERT INTO scans (id, project_id, commit_sha, branch, ci_job_url, status, token_id, asset_hint)
VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)`
	_, err := tx.Exec(ctx, q,
		scan.ID, scan.ProjectID, scan.CommitSHA, scan.Branch, scan.CIJobURL,
		scan.TokenID, scan.AssetHint,
	)
	if err != nil {
		return fmt.Errorf("storage.CreateSingle: %w", err)
	}
	return nil
}

// CreateToolRun вставляет запись запуска инструмента (статус: success/failed).
func (r *ScansRepo) CreateToolRun(ctx context.Context, tx pgx.Tx, tr *domain.ScanToolRun) error {
	if tr.ID == uuid.Nil {
		tr.ID = uuid.New()
	}
	const q = `
INSERT INTO scan_tool_runs
    (id, scan_id, scanner, scanner_version, report_format, status, error,
     findings_imported, findings_updated, started_at, finished_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := tx.Exec(ctx, q,
		tr.ID, tr.ScanID, tr.Scanner, tr.ScannerVersion, tr.ReportFormat,
		tr.Status, tr.Error,
		tr.FindingsImported, tr.FindingsUpdated,
		tr.StartedAt, tr.FinishedAt,
	)
	if err != nil {
		return fmt.Errorf("storage.CreateToolRun: %w", err)
	}
	return nil
}

// IncrScanCounts добавляет к агрегатным счётчикам скана результаты tool-run.
func (r *ScansRepo) IncrScanCounts(ctx context.Context, tx pgx.Tx, scanID uuid.UUID, imported, updated int) error {
	const q = `
UPDATE scans
SET findings_imported = findings_imported + $2,
    findings_updated  = findings_updated  + $3
WHERE id = $1`
	_, err := tx.Exec(ctx, q, scanID, imported, updated)
	if err != nil {
		return fmt.Errorf("storage.IncrScanCounts: %w", err)
	}
	return nil
}

// LinkFinding привязывает finding к scan и tool_run.
func (r *ScansRepo) LinkFinding(ctx context.Context, tx pgx.Tx, findingID, scanID, toolRunID uuid.UUID, isNew bool) error {
	const q = `
INSERT INTO finding_scan_links (finding_id, scan_id, tool_run_id, is_new)
VALUES ($1, $2, $3, $4)
ON CONFLICT (finding_id, scan_id) DO NOTHING`
	_, err := tx.Exec(ctx, q, findingID, scanID, toolRunID, isNew)
	if err != nil {
		return fmt.Errorf("storage.LinkFinding: %w", err)
	}
	return nil
}

// CompleteScan переводит скан в статус completed (явное закрытие или авто).
// Идемпотентен: если скан уже closed — не изменяет.
func (r *ScansRepo) CompleteScan(ctx context.Context, tx pgx.Tx, scanID uuid.UUID, completion string) error {
	const q = `
UPDATE scans
SET status = 'completed', completion = $2, completed_at = now()
WHERE id = $1 AND status = 'open'`
	_, err := tx.Exec(ctx, q, scanID, completion)
	if err != nil {
		return fmt.Errorf("storage.CompleteScan: %w", err)
	}
	return nil
}

// CompletePipeline переводит скан в completed по (project_id, pipeline_id).
// Возвращает nil и пустой scan при отсутствии строки (NOT_FOUND обрабатывает хендлер).
func (r *ScansRepo) CompletePipeline(ctx context.Context, projectID uuid.UUID, pipelineID string) (*domain.Scan, error) {
	const q = `
UPDATE scans
SET status = 'completed', completion = 'explicit', completed_at = now()
WHERE project_id = $1 AND ci_pipeline_id = $2 AND status = 'open'
RETURNING ` + scanColumns
	s, err := scanFromRow(r.pool.QueryRow(ctx, q, projectID, pipelineID))
	if err != nil {
		return nil, fmt.Errorf("storage.CompletePipeline: %w", err)
	}
	return s, nil
}

// GetByPipeline возвращает скан по (project_id, pipeline_id).
func (r *ScansRepo) GetByPipeline(ctx context.Context, projectID uuid.UUID, pipelineID string) (*domain.Scan, error) {
	const q = `SELECT ` + scanColumns + ` FROM scans WHERE project_id=$1 AND ci_pipeline_id=$2`
	s, err := scanFromRow(r.pool.QueryRow(ctx, q, projectID, pipelineID))
	if err != nil {
		return nil, fmt.Errorf("storage.GetByPipeline: %w", err)
	}
	return s, nil
}

// CloseTimedOut закрывает open-сканы старше timeout как timed_out.
// Никогда не ставит completed — только timed_out.
func (r *ScansRepo) CloseTimedOut(ctx context.Context, timeout time.Duration) error {
	const q = `
UPDATE scans
SET status = 'timed_out', completion = 'timeout', completed_at = now()
WHERE status = 'open' AND started_at < now() - ($1 || ' seconds')::interval`
	_, err := r.pool.Exec(ctx, q, int64(timeout.Seconds()))
	if err != nil {
		return fmt.Errorf("storage.CloseTimedOut: %w", err)
	}
	return nil
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
	q := `SELECT ` + scanColumns + ` FROM scans WHERE ` +
		strings.Join(conds, " AND ") +
		` ORDER BY started_at DESC, id DESC LIMIT $` + fmt.Sprint(argN)
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", fmt.Errorf("storage.ListByProject: %w", err)
	}
	defer rows.Close()
	out := make([]domain.Scan, 0, 32)
	for rows.Next() {
		s, err := scanFromRows(rows)
		if err != nil {
			return nil, "", err
		}
		out = append(out, *s)
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
	const q = `SELECT ` + scanColumns + ` FROM scans WHERE id=$1`
	s, err := scanFromRow(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		return nil, fmt.Errorf("storage.Get: %w", err)
	}
	return s, nil
}

func (r *ScansRepo) ListToolRuns(ctx context.Context, scanID uuid.UUID) ([]domain.ScanToolRun, error) {
	const q = `
SELECT id, scan_id, scanner, scanner_version, report_format, status, error,
       findings_imported, findings_updated, started_at, finished_at
FROM scan_tool_runs
WHERE scan_id = $1
ORDER BY started_at ASC`
	rows, err := r.pool.Query(ctx, q, scanID)
	if err != nil {
		return nil, fmt.Errorf("storage.ListToolRuns: %w", err)
	}
	defer rows.Close()
	out := make([]domain.ScanToolRun, 0, 4)
	for rows.Next() {
		var tr domain.ScanToolRun
		if err := rows.Scan(
			&tr.ID, &tr.ScanID, &tr.Scanner, &tr.ScannerVersion, &tr.ReportFormat,
			&tr.Status, &tr.Error, &tr.FindingsImported, &tr.FindingsUpdated,
			&tr.StartedAt, &tr.FinishedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, tr)
	}
	return out, rows.Err()
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
		return nil, fmt.Errorf("storage.ListFindings: %w", err)
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
	q := `SELECT ` + scanColumns + `
FROM finding_scan_links l
JOIN scans s ON s.id = l.scan_id
WHERE l.finding_id = $1
ORDER BY s.started_at DESC
LIMIT $2`
	rows, err := r.pool.Query(ctx, q, findingID, limit)
	if err != nil {
		return nil, fmt.Errorf("storage.ListRecentForFinding: %w", err)
	}
	defer rows.Close()
	out := make([]domain.Scan, 0, limit)
	for rows.Next() {
		s, err := scanFromRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}
