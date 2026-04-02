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

	"vulnscope/internal/domain"
)

type FindingsRepo struct {
	pool *pgxpool.Pool
}

func NewFindingsRepo(pool *pgxpool.Pool) *FindingsRepo {
	return &FindingsRepo{pool: pool}
}

// findingsCursor is the opaque cursor payload for keyset pagination.
type findingsCursor struct {
	FirstSeen time.Time `json:"first_seen"`
	ID        uuid.UUID `json:"id"`
}

func encodeCursor(c findingsCursor) string {
	b, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(b)
}

func decodeCursor(s string) (findingsCursor, error) {
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return findingsCursor{}, fmt.Errorf("storage.decodeCursor: base64: %w", err)
	}
	var c findingsCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return findingsCursor{}, fmt.Errorf("storage.decodeCursor: json: %w", err)
	}
	return c, nil
}

type FindingsFilter struct {
	ProjectID  uuid.UUID
	Severities []int
	Statuses   []int
	Query      string // full-text search
	CVE        string
	CWE        int
	Limit      int
	Cursor     string
	SortField  string // "first_seen", "last_seen", "severity", "priority_score"
	SortDir    string // "asc", "desc"
}

var allowedSortFields = map[string]string{
	"first_seen":     "f.first_seen",
	"last_seen":      "f.last_seen",
	"severity":       "f.severity",
	"priority_score": "fs.priority_score",
}

// Create inserts a finding or updates last_seen/times_seen on fingerprint conflict.
// Returns true if a new row was inserted, false if an existing row was updated.
func (r *FindingsRepo) Create(ctx context.Context, f *domain.Finding) (inserted bool, err error) {
	const q = `
		INSERT INTO findings (
			id, title, description, severity, confidence, status,
			file_path, line_start, line_end, component, component_version,
			cve_ids, cwe_ids, cpe_uri, fingerprint, first_seen, last_seen,
			times_seen, project_id, source_type
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20
		)
		ON CONFLICT (fingerprint) DO UPDATE SET
			last_seen  = EXCLUDED.last_seen,
			times_seen = findings.times_seen + 1
		RETURNING (xmax = 0) AS inserted`

	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	now := time.Now()
	if f.FirstSeen.IsZero() {
		f.FirstSeen = now
	}
	if f.LastSeen.IsZero() {
		f.LastSeen = now
	}
	if f.TimesSeen == 0 {
		f.TimesSeen = 1
	}

	err = r.pool.QueryRow(ctx, q,
		f.ID, f.Title, f.Description, f.Severity, f.Confidence, f.Status,
		f.FilePath, f.LineStart, f.LineEnd, f.Component, f.ComponentVersion,
		f.CVEIDs, f.CWEIDs, f.CPEURI, f.Fingerprint, f.FirstSeen, f.LastSeen,
		f.TimesSeen, f.ProjectID, f.SourceType,
	).Scan(&inserted)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.Create: %w", err)
	}
	return inserted, nil
}

var findingColumns = `
	f.id, f.title, f.description, f.severity, f.confidence, f.status,
	f.file_path, f.line_start, f.line_end, f.component, f.component_version,
	f.cve_ids, f.cwe_ids, f.cpe_uri, f.fingerprint, f.first_seen, f.last_seen,
	f.times_seen, f.project_id, f.source_type, fs.priority_score`

func scanFinding(row pgx.Row) (*domain.Finding, error) {
	var f domain.Finding
	err := row.Scan(
		&f.ID, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
		&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
		&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
		&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.PriorityScore,
	)
	if err != nil {
		return nil, err
	}
	if f.CVEIDs == nil {
		f.CVEIDs = []string{}
	}
	if f.CWEIDs == nil {
		f.CWEIDs = []int{}
	}
	return &f, nil
}

func (r *FindingsRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Finding, error) {
	q := `SELECT ` + findingColumns + `
		FROM findings f
		LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		WHERE f.id = $1`

	f, err := scanFinding(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.GetByID: %w", err)
	}
	return f, nil
}

func (r *FindingsRepo) List(ctx context.Context, filter FindingsFilter) ([]domain.Finding, string, int, error) {
	// Resolve sort column; default to first_seen DESC
	sortCol := "f.first_seen"
	if col, ok := allowedSortFields[filter.SortField]; ok {
		sortCol = col
	}
	sortDir := "DESC"
	if strings.EqualFold(filter.SortDir, "asc") {
		sortDir = "ASC"
	}

	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	// Build WHERE clauses and args dynamically
	var conditions []string
	var args []any
	argN := 1

	if filter.ProjectID != uuid.Nil {
		conditions = append(conditions, fmt.Sprintf("f.project_id = $%d", argN))
		args = append(args, filter.ProjectID)
		argN++
	}
	if len(filter.Severities) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.severity = ANY($%d)", argN))
		args = append(args, filter.Severities)
		argN++
	}
	if len(filter.Statuses) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.status = ANY($%d)", argN))
		args = append(args, filter.Statuses)
		argN++
	}
	if filter.Query != "" {
		conditions = append(conditions, fmt.Sprintf("f.search_vector @@ plainto_tsquery('english', $%d)", argN))
		args = append(args, filter.Query)
		argN++
	}
	if filter.CVE != "" {
		conditions = append(conditions, fmt.Sprintf("f.cve_ids @> ARRAY[$%d]::text[]", argN))
		args = append(args, filter.CVE)
		argN++
	}
	if filter.CWE > 0 {
		conditions = append(conditions, fmt.Sprintf("f.cwe_ids @> ARRAY[$%d]::int[]", argN))
		args = append(args, filter.CWE)
		argN++
	}

	// Cursor-based keyset pagination
	if filter.Cursor != "" {
		cur, err := decodeCursor(filter.Cursor)
		if err != nil {
			return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: %w", err)
		}
		if sortDir == "DESC" {
			conditions = append(conditions, fmt.Sprintf(
				"(f.first_seen, f.id) < ($%d, $%d)", argN, argN+1))
		} else {
			conditions = append(conditions, fmt.Sprintf(
				"(f.first_seen, f.id) > ($%d, $%d)", argN, argN+1))
		}
		args = append(args, cur.FirstSeen, cur.ID)
		argN += 2
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total matching (without cursor/limit)
	countWhere := ""
	if filter.Cursor != "" && len(conditions) > 2 {
		// Count query uses all conditions except the cursor condition
		countConds := conditions[:len(conditions)-1]
		countWhere = "WHERE " + strings.Join(countConds, " AND ")
	} else if filter.Cursor != "" && len(conditions) == 1 {
		// Only cursor condition — no other filters
		countWhere = ""
	} else {
		countWhere = where
	}

	// For count query, we don't need the cursor args
	countArgs := args
	if filter.Cursor != "" {
		countArgs = args[:len(args)-2]
	}

	countQ := `SELECT count(*) FROM findings f ` + countWhere
	var total int
	if err := r.pool.QueryRow(ctx, countQ, countArgs...).Scan(&total); err != nil {
		return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: count: %w", err)
	}

	// Main query with join for priority_score
	needsScoreJoin := sortCol == "fs.priority_score"
	joinClause := "LEFT JOIN finding_scores fs ON fs.finding_id = f.id"

	q := fmt.Sprintf(`SELECT %s FROM findings f %s %s ORDER BY %s %s, f.id %s LIMIT $%d`,
		findingColumns, joinClause, where, sortCol, sortDir, sortDir, argN)
	args = append(args, limit)

	_ = needsScoreJoin // join is always present for priority_score column

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: query: %w", err)
	}
	defer rows.Close()

	var findings []domain.Finding
	for rows.Next() {
		var f domain.Finding
		err := rows.Scan(
			&f.ID, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
			&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
			&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
			&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.PriorityScore,
		)
		if err != nil {
			return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: scan: %w", err)
		}
		if f.CVEIDs == nil {
			f.CVEIDs = []string{}
		}
		if f.CWEIDs == nil {
			f.CWEIDs = []int{}
		}
		findings = append(findings, f)
	}
	if err := rows.Err(); err != nil {
		return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: rows: %w", err)
	}

	var nextCursor string
	if len(findings) == limit {
		last := findings[len(findings)-1]
		nextCursor = encodeCursor(findingsCursor{
			FirstSeen: last.FirstSeen,
			ID:        last.ID,
		})
	}

	return findings, nextCursor, total, nil
}

func (r *FindingsRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status int) error {
	const q = `UPDATE findings SET status = $1 WHERE id = $2`
	tag, err := r.pool.Exec(ctx, q, status, id)
	if err != nil {
		return fmt.Errorf("storage.FindingsRepo.UpdateStatus: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.FindingsRepo.UpdateStatus: finding %s not found", id)
	}
	return nil
}

func (r *FindingsRepo) BulkUpdateStatus(ctx context.Context, ids []uuid.UUID, status int) error {
	const q = `UPDATE findings SET status = $1 WHERE id = ANY($2)`
	_, err := r.pool.Exec(ctx, q, status, ids)
	if err != nil {
		return fmt.Errorf("storage.FindingsRepo.BulkUpdateStatus: %w", err)
	}
	return nil
}

func (r *FindingsRepo) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM findings WHERE id = $1`
	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("storage.FindingsRepo.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("storage.FindingsRepo.Delete: finding %s not found", id)
	}
	return nil
}

func (r *FindingsRepo) CountByProject(ctx context.Context, projectID uuid.UUID) (map[string]int, error) {
	const q = `
		SELECT severity, count(*)
		FROM findings
		WHERE project_id = $1
		GROUP BY severity`

	rows, err := r.pool.Query(ctx, q, projectID)
	if err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.CountByProject: %w", err)
	}
	defer rows.Close()

	severityNames := map[int]string{
		0: "info",
		1: "low",
		2: "medium",
		3: "high",
		4: "critical",
	}

	counts := make(map[string]int)
	for rows.Next() {
		var sev, cnt int
		if err := rows.Scan(&sev, &cnt); err != nil {
			return nil, fmt.Errorf("storage.FindingsRepo.CountByProject: scan: %w", err)
		}
		name := severityNames[sev]
		if name == "" {
			name = fmt.Sprintf("unknown_%d", sev)
		}
		counts[name] = cnt
	}
	return counts, rows.Err()
}
