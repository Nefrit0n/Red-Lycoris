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
	ProjectID         uuid.UUID
	Severities        []int
	Statuses          []int
	Kinds             []domain.FindingKind
	HasCVE            *bool
	HasFix            *bool
	PackageEcosystems []string
	IacProviders      []string
	SecretKinds       []string
	Components        []string
	Query             string // full-text search
	CVE               string
	CWE               int
	Limit             int
	Cursor            string
	SortField         string // "first_seen", "last_seen", "severity", "priority_score"
	SortDir           string // "asc", "desc"
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
			times_seen, project_id, source_type, finding_kind,
			fixed_version, package_ecosystem, purl, code_snippet, code_flow,
			url, http_method, http_param, http_evidence, iac_resource,
			iac_provider, secret_kind, commit_sha, rule_id, rule_name
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21,
			$22, $23, $24, $25, $26,
			$27, $28, $29, $30, $31,
			$32, $33, $34, $35, $36
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
		f.TimesSeen, f.ProjectID, f.SourceType, int16(f.Kind),
		f.FixedVersion, f.PackageEcosystem, f.Purl, f.CodeSnippet, f.CodeFlow,
		f.URL, f.HttpMethod, f.HttpParam, f.HttpEvidence, f.IacResource,
		f.IacProvider, f.SecretKind, f.CommitSHA, f.RuleID, f.RuleName,
	).Scan(&inserted)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.Create: %w", err)
	}
	return inserted, nil
}

var findingColumns = `
	f.id, f.finding_kind, f.title, f.description, f.severity, f.confidence, f.status,
	f.file_path, f.line_start, f.line_end, f.component, f.component_version,
	f.cve_ids, f.cwe_ids, f.cpe_uri, f.fingerprint, f.first_seen, f.last_seen,
	f.times_seen, f.project_id, f.source_type, f.fixed_version, f.package_ecosystem,
	f.purl, f.code_snippet, f.code_flow, f.url, f.http_method, f.http_param,
	f.http_evidence, f.iac_resource, f.iac_provider, f.secret_kind, f.commit_sha,
	f.rule_id, f.rule_name, fs.priority_score`

func scanFinding(row pgx.Row) (*domain.Finding, error) {
	var f domain.Finding
	var kind int16
	err := row.Scan(
		&f.ID, &kind, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
		&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
		&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
		&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.FixedVersion, &f.PackageEcosystem,
		&f.Purl, &f.CodeSnippet, &f.CodeFlow, &f.URL, &f.HttpMethod, &f.HttpParam,
		&f.HttpEvidence, &f.IacResource, &f.IacProvider, &f.SecretKind, &f.CommitSHA,
		&f.RuleID, &f.RuleName, &f.PriorityScore,
	)
	if err != nil {
		return nil, err
	}
	f.Kind = domain.FindingKind(kind)
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
	if len(filter.Kinds) > 0 {
		kinds := make([]int16, 0, len(filter.Kinds))
		for _, k := range filter.Kinds {
			kinds = append(kinds, int16(k))
		}
		conditions = append(conditions, fmt.Sprintf("f.finding_kind = ANY($%d)", argN))
		args = append(args, kinds)
		argN++
	}
	if filter.HasCVE != nil && *filter.HasCVE {
		conditions = append(conditions, "array_length(f.cve_ids, 1) > 0")
	}
	if filter.HasFix != nil && *filter.HasFix {
		conditions = append(conditions, "f.fixed_version IS NOT NULL")
	}
	if len(filter.PackageEcosystems) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.package_ecosystem = ANY($%d)", argN))
		args = append(args, filter.PackageEcosystems)
		argN++
	}
	if len(filter.IacProviders) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.iac_provider = ANY($%d)", argN))
		args = append(args, filter.IacProviders)
		argN++
	}
	if len(filter.SecretKinds) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.secret_kind = ANY($%d)", argN))
		args = append(args, filter.SecretKinds)
		argN++
	}
	if len(filter.Components) > 0 {
		componentPatterns := make([]string, 0, len(filter.Components))
		for _, component := range filter.Components {
			componentPatterns = append(componentPatterns, "%"+component+"%")
		}
		conditions = append(conditions, fmt.Sprintf("f.component ILIKE ANY($%d)", argN))
		args = append(args, componentPatterns)
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
		var kind int16
		err := rows.Scan(
			&f.ID, &kind, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
			&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
			&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
			&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.FixedVersion, &f.PackageEcosystem,
			&f.Purl, &f.CodeSnippet, &f.CodeFlow, &f.URL, &f.HttpMethod, &f.HttpParam,
			&f.HttpEvidence, &f.IacResource, &f.IacProvider, &f.SecretKind, &f.CommitSHA,
			&f.RuleID, &f.RuleName, &f.PriorityScore,
		)
		if err != nil {
			return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: scan: %w", err)
		}
		f.Kind = domain.FindingKind(kind)
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
