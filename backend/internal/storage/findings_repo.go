package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"

	"redlycoris/internal/domain"
)

type FindingsRepo struct {
	pool               *pgxpool.Pool
	closureReasonsRepo *ClosureReasonsRepo
	findingEventsRepo  *FindingEventsRepo
}

func NewFindingsRepo(pool *pgxpool.Pool) *FindingsRepo {
	return &FindingsRepo{
		pool:               pool,
		closureReasonsRepo: NewClosureReasonsRepo(pool),
		findingEventsRepo:  NewFindingEventsRepo(pool),
	}
}

func (r *FindingsRepo) DB() *pgxpool.Pool {
	return r.pool
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
	ProjectID            uuid.UUID
	AccessibleProjectIDs []uuid.UUID
	Severities           []int
	Statuses             []int
	Kinds                []domain.FindingKind
	HasCVE               *bool
	HasFix               *bool
	InKEV                *bool
	InBDU                *bool
	EPSSMin              *float64
	CVSSMin              *float64
	AgeMaxDays           *int
	GroupBy              string
	PackageEcosystems    []string
	IacProviders         []string
	SecretKinds          []string
	Components           []string
	ComponentVersion     string
	RuleID               string
	SecretFingerprint    string // exact match for secret-group overlay
	AssigneeUserIDs      []uuid.UUID
	AssigneeMeUserID     *uuid.UUID
	Unassigned           bool
	Query                string // full-text search
	CVE                  string
	CWE                  int
	Limit                int
	Cursor               string
	SortField            string // "first_seen", "last_seen", "severity", "priority_score"
	SortDir              string // "asc", "desc"
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
			iac_provider, secret_kind, commit_sha, rule_id, rule_name,
			secret_fingerprint
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21,
			$22, $23, $24, $25, $26,
			$27, $28, $29, $30, $31,
			$32, $33, $34, $35, $36,
			$37
		)
		ON CONFLICT (fingerprint) DO UPDATE SET
			last_seen          = EXCLUDED.last_seen,
			times_seen         = findings.times_seen + 1,
			secret_fingerprint = COALESCE(EXCLUDED.secret_fingerprint, findings.secret_fingerprint)
		RETURNING id, (xmax = 0) AS inserted`

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
	kind, err := findingKindToDB(f.Kind)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.Create: %w", err)
	}

	err = r.pool.QueryRow(ctx, q,
		f.ID, f.Title, f.Description, f.Severity, f.Confidence, f.Status,
		f.FilePath, f.LineStart, f.LineEnd, f.Component, f.ComponentVersion,
		f.CVEIDs, f.CWEIDs, f.CPEURI, f.Fingerprint, f.FirstSeen, f.LastSeen,
		f.TimesSeen, f.ProjectID, f.SourceType, kind,
		f.FixedVersion, f.PackageEcosystem, f.Purl, f.CodeSnippet, f.CodeFlow,
		f.URL, f.HttpMethod, f.HttpParam, f.HttpEvidence, f.IacResource,
		f.IacProvider, f.SecretKind, f.CommitSHA, f.RuleID, f.RuleName,
		f.SecretFingerprint,
	).Scan(&f.ID, &inserted)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.Create: %w", err)
	}
	return inserted, nil
}

// CreateTx is identical to Create but runs inside an existing transaction.
func (r *FindingsRepo) CreateTx(ctx context.Context, tx pgx.Tx, f *domain.Finding) (inserted bool, err error) {
	const q = `
		INSERT INTO findings (
			id, title, description, severity, confidence, status,
			file_path, line_start, line_end, component, component_version,
			cve_ids, cwe_ids, cpe_uri, fingerprint, first_seen, last_seen,
			times_seen, project_id, source_type, finding_kind,
			fixed_version, package_ecosystem, purl, code_snippet, code_flow,
			url, http_method, http_param, http_evidence, iac_resource,
			iac_provider, secret_kind, commit_sha, rule_id, rule_name,
			secret_fingerprint
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20, $21,
			$22, $23, $24, $25, $26,
			$27, $28, $29, $30, $31,
			$32, $33, $34, $35, $36,
			$37
		)
		ON CONFLICT (fingerprint) DO UPDATE SET
			last_seen          = EXCLUDED.last_seen,
			times_seen         = findings.times_seen + 1,
			secret_fingerprint = COALESCE(EXCLUDED.secret_fingerprint, findings.secret_fingerprint)
		RETURNING id, (xmax = 0) AS inserted`

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
	kind, err := findingKindToDB(f.Kind)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.CreateTx: %w", err)
	}

	err = tx.QueryRow(ctx, q,
		f.ID, f.Title, f.Description, f.Severity, f.Confidence, f.Status,
		f.FilePath, f.LineStart, f.LineEnd, f.Component, f.ComponentVersion,
		f.CVEIDs, f.CWEIDs, f.CPEURI, f.Fingerprint, f.FirstSeen, f.LastSeen,
		f.TimesSeen, f.ProjectID, f.SourceType, kind,
		f.FixedVersion, f.PackageEcosystem, f.Purl, f.CodeSnippet, f.CodeFlow,
		f.URL, f.HttpMethod, f.HttpParam, f.HttpEvidence, f.IacResource,
		f.IacProvider, f.SecretKind, f.CommitSHA, f.RuleID, f.RuleName,
		f.SecretFingerprint,
	).Scan(&f.ID, &inserted)
	if err != nil {
		return false, fmt.Errorf("storage.FindingsRepo.CreateTx: %w", err)
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
	f.rule_id, f.rule_name, f.secret_fingerprint, fs.priority_score,
	f.closure_reason_id, f.closure_note, f.closed_at, f.closed_by, f.assigned_to`

// Extra columns joined only for list queries (KEV/BDU flags, max EPSS/CVSS
// across linked CVEs, and project name). Subqueries are correlated per row but
// hit PK indexes on enrichment tables (kev_catalog, epss_scores, nvd_cves) and
// a GIN index on bdu_fstec.cve_ids.
var findingListColumns = findingColumns + `,
	EXISTS(
		SELECT 1 FROM kev_catalog k
		WHERE f.cve_ids IS NOT NULL AND k.cve_id = ANY(f.cve_ids)
	) AS in_kev,
	(
		SELECT MAX(e.epss_score) FROM epss_scores e
		WHERE f.cve_ids IS NOT NULL AND e.cve_id = ANY(f.cve_ids)
	) AS max_epss,
	(
		SELECT MAX(n.cvss_v31_score) FROM nvd_cves n
		WHERE f.cve_ids IS NOT NULL AND n.cve_id = ANY(f.cve_ids)
	) AS max_cvss,
	EXISTS(
		SELECT 1 FROM bdu_fstec b
		WHERE f.cve_ids IS NOT NULL AND b.cve_ids && f.cve_ids
	) AS in_bdu,
	p.name AS project_name,
	COALESCE(au.email, '') AS assignee_email`

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
		&f.RuleID, &f.RuleName, &f.SecretFingerprint, &f.PriorityScore,
		&f.ClosureReasonID, &f.ClosureNote, &f.ClosedAt, &f.ClosedBy, &f.AssignedTo,
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

func scanFindingListItem(row pgx.Row) (*domain.Finding, error) {
	var f domain.Finding
	var kind int16
	var projectName *string
	err := row.Scan(
		&f.ID, &kind, &f.Title, &f.Description, &f.Severity, &f.Confidence, &f.Status,
		&f.FilePath, &f.LineStart, &f.LineEnd, &f.Component, &f.ComponentVersion,
		&f.CVEIDs, &f.CWEIDs, &f.CPEURI, &f.Fingerprint, &f.FirstSeen, &f.LastSeen,
		&f.TimesSeen, &f.ProjectID, &f.SourceType, &f.FixedVersion, &f.PackageEcosystem,
		&f.Purl, &f.CodeSnippet, &f.CodeFlow, &f.URL, &f.HttpMethod, &f.HttpParam,
		&f.HttpEvidence, &f.IacResource, &f.IacProvider, &f.SecretKind, &f.CommitSHA,
		&f.RuleID, &f.RuleName, &f.SecretFingerprint, &f.PriorityScore,
		&f.ClosureReasonID, &f.ClosureNote, &f.ClosedAt, &f.ClosedBy, &f.AssignedTo,
		&f.InKEV, &f.MaxEPSS, &f.MaxCVSS, &f.InBDU, &projectName, &f.AssigneeEmail,
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
	if projectName != nil {
		f.ProjectName = *projectName
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

// Facet axis names understood by buildBaseWhere. Passing one as excludeField
// drops the corresponding filter clause so a facet count is not biased by its
// own filter.
const (
	FacetSeverity    = "severity"
	FacetStatus      = "status"
	FacetKind        = "kind"
	FacetProject     = "project"
	FacetEcosystem   = "ecosystem"
	FacetIacProvider = "iac_provider"
	FacetSecretKind  = "secret_kind"
	FacetHasCVE      = "has_cve"
	FacetHasFix      = "has_fix"
	FacetInKEV       = "in_kev"
	FacetInBDU       = "in_bdu"
)

// buildBaseWhere compiles the non-cursor conditions for a findings query, with
// the option to exclude a single dimension so facet counts stay honest for
// that axis. Cursor and pagination clauses are the caller's job.
func buildBaseWhere(filter *FindingsFilter, excludeField string, startArg int) ([]string, []any, int) {
	var conditions []string
	var args []any
	argN := startArg

	if filter.AccessibleProjectIDs != nil {
		if len(filter.AccessibleProjectIDs) == 0 {
			conditions = append(conditions, "1 = 0")
		} else {
			conditions = append(conditions, fmt.Sprintf("f.project_id = ANY($%d)", argN))
			args = append(args, filter.AccessibleProjectIDs)
			argN++
		}
	}
	if filter.ProjectID != uuid.Nil && excludeField != FacetProject {
		conditions = append(conditions, fmt.Sprintf("f.project_id = $%d", argN))
		args = append(args, filter.ProjectID)
		argN++
	}
	if len(filter.Severities) > 0 && excludeField != FacetSeverity {
		conditions = append(conditions, fmt.Sprintf("f.severity = ANY($%d)", argN))
		args = append(args, filter.Severities)
		argN++
	}
	if len(filter.Statuses) > 0 && excludeField != FacetStatus {
		conditions = append(conditions, fmt.Sprintf("f.status = ANY($%d)", argN))
		args = append(args, filter.Statuses)
		argN++
	}
	if len(filter.Kinds) > 0 && excludeField != FacetKind {
		kinds := make([]int16, 0, len(filter.Kinds))
		for _, k := range filter.Kinds {
			if k < math.MinInt16 || k > math.MaxInt16 {
				conditions = append(conditions, "1 = 0")
				kinds = nil
				break
			}
			kinds = append(kinds, int16(k))
		}
		if len(kinds) > 0 {
			conditions = append(conditions, fmt.Sprintf("f.finding_kind = ANY($%d)", argN))
			args = append(args, kinds)
			argN++
		}
	}
	if filter.HasCVE != nil && *filter.HasCVE && excludeField != FacetHasCVE {
		conditions = append(conditions, "array_length(f.cve_ids, 1) > 0")
	}
	if filter.HasFix != nil && *filter.HasFix && excludeField != FacetHasFix {
		conditions = append(conditions, "f.fixed_version IS NOT NULL")
	}
	if filter.InKEV != nil && *filter.InKEV && excludeField != FacetInKEV {
		conditions = append(conditions,
			"EXISTS (SELECT 1 FROM kev_catalog k WHERE f.cve_ids IS NOT NULL AND k.cve_id = ANY(f.cve_ids))")
	}
	if filter.InBDU != nil && *filter.InBDU && excludeField != FacetInBDU {
		conditions = append(conditions,
			"EXISTS (SELECT 1 FROM bdu_fstec b WHERE f.cve_ids IS NOT NULL AND b.cve_ids && f.cve_ids)")
	}
	if filter.EPSSMin != nil {
		conditions = append(conditions, fmt.Sprintf(
			"COALESCE((SELECT MAX(e.epss_score) FROM epss_scores e WHERE f.cve_ids IS NOT NULL AND e.cve_id = ANY(f.cve_ids)), 0) >= $%d",
			argN))
		args = append(args, *filter.EPSSMin)
		argN++
	}
	if filter.CVSSMin != nil {
		conditions = append(conditions, fmt.Sprintf(
			"COALESCE((SELECT MAX(n.cvss_v31_score) FROM nvd_cves n WHERE f.cve_ids IS NOT NULL AND n.cve_id = ANY(f.cve_ids)), 0) >= $%d",
			argN))
		args = append(args, *filter.CVSSMin)
		argN++
	}
	if filter.AssigneeMeUserID != nil {
		conditions = append(conditions, fmt.Sprintf("f.assigned_to = $%d", argN))
		args = append(args, *filter.AssigneeMeUserID)
		argN++
	}
	if filter.Unassigned {
		conditions = append(conditions, "f.assigned_to IS NULL")
	}
	if len(filter.AssigneeUserIDs) > 0 {
		conditions = append(conditions, fmt.Sprintf("f.assigned_to = ANY($%d)", argN))
		args = append(args, filter.AssigneeUserIDs)
		argN++
	}
	if filter.AgeMaxDays != nil && *filter.AgeMaxDays > 0 {
		conditions = append(conditions, fmt.Sprintf(
			"f.first_seen >= now() - ($%d::int * interval '1 day')", argN))
		args = append(args, *filter.AgeMaxDays)
		argN++
	}
	if len(filter.PackageEcosystems) > 0 && excludeField != FacetEcosystem {
		conditions = append(conditions, fmt.Sprintf("f.package_ecosystem = ANY($%d)", argN))
		args = append(args, filter.PackageEcosystems)
		argN++
	}
	if len(filter.IacProviders) > 0 && excludeField != FacetIacProvider {
		conditions = append(conditions, fmt.Sprintf("f.iac_provider = ANY($%d)", argN))
		args = append(args, filter.IacProviders)
		argN++
	}
	if len(filter.SecretKinds) > 0 && excludeField != FacetSecretKind {
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
	if filter.ComponentVersion != "" {
		conditions = append(conditions, fmt.Sprintf("COALESCE(f.component_version, '') = $%d", argN))
		args = append(args, filter.ComponentVersion)
		argN++
	}
	if filter.RuleID != "" {
		conditions = append(conditions, fmt.Sprintf("f.rule_id = $%d", argN))
		args = append(args, filter.RuleID)
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
	if filter.SecretFingerprint != "" {
		conditions = append(conditions, fmt.Sprintf("f.secret_fingerprint = $%d", argN))
		args = append(args, filter.SecretFingerprint)
		argN++
	}

	return conditions, args, argN
}

// whereClause joins conditions into a "WHERE a AND b" fragment or returns "".
func whereClause(conditions []string) string {
	if len(conditions) == 0 {
		return ""
	}
	return "WHERE " + strings.Join(conditions, " AND ")
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
	if limit <= 0 || limit > 1000 {
		limit = 50
	}

	conditions, args, argN := buildBaseWhere(&filter, "", 1)

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

	where := whereClause(conditions)

	// Count total matching (without cursor/limit). When cursor is set, strip
	// the trailing cursor condition so count reflects the full filtered set.
	countWhere := where
	countArgs := args
	if filter.Cursor != "" {
		countWhere = whereClause(conditions[:len(conditions)-1])
		countArgs = args[:len(args)-2]
	}

	countQ := `SELECT count(*) FROM findings f ` + countWhere
	var total int
	if err := r.pool.QueryRow(ctx, countQ, countArgs...).Scan(&total); err != nil {
		return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: count: %w", err)
	}

	// Main query with joins for priority_score + project name.
	joinClause := `LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		LEFT JOIN projects p ON p.id = f.project_id
		LEFT JOIN users au ON au.id = f.assigned_to`

	q := fmt.Sprintf(`SELECT %s FROM findings f %s %s ORDER BY %s %s, f.id %s LIMIT $%d`,
		findingListColumns, joinClause, where, sortCol, sortDir, sortDir, argN)
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: query: %w", err)
	}
	defer rows.Close()

	var findings []domain.Finding
	for rows.Next() {
		f, err := scanFindingListItem(rows)
		if err != nil {
			return nil, "", 0, fmt.Errorf("storage.FindingsRepo.List: scan: %w", err)
		}
		findings = append(findings, *f)
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

// SeverityFacet, StatusFacet, etc are the typed facet buckets returned by
// Facets. Each bucket carries just the axis value + count so the frontend can
// render chips without another enrichment round trip.
type SeverityFacet struct {
	Severity int `json:"severity"`
	Count    int `json:"count"`
}

type StatusFacet struct {
	Status int `json:"status"`
	Count  int `json:"count"`
}

type KindFacet struct {
	Kind  string `json:"kind"`
	Count int    `json:"count"`
}

type StringFacet struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type ProjectFacet struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Count int       `json:"count"`
}

type EnrichmentFacets struct {
	InKEV  int `json:"in_kev"`
	HasCVE int `json:"has_cve"`
	HasFix int `json:"has_fix"`
	InBDU  int `json:"in_bdu"`
}

type FindingsFacets struct {
	BySeverity    []SeverityFacet  `json:"by_severity"`
	ByStatus      []StatusFacet    `json:"by_status"`
	ByKind        []KindFacet      `json:"by_kind"`
	BySource      []StringFacet    `json:"by_source"`
	ByProject     []ProjectFacet   `json:"by_project"`
	ByEcosystem   []StringFacet    `json:"by_ecosystem"`
	ByIacProvider []StringFacet    `json:"by_iac_provider"`
	BySecretKind  []StringFacet    `json:"by_secret_kind"`
	Enrichment    EnrichmentFacets `json:"enrichment"`
}

// Facets runs all facet sub-queries in parallel and returns the bucketed
// counts. Each dimension drops its own filter so the chips stay clickable.
func (r *FindingsRepo) Facets(ctx context.Context, filter FindingsFilter) (*FindingsFacets, error) {
	out := &FindingsFacets{
		BySeverity:    []SeverityFacet{},
		ByStatus:      []StatusFacet{},
		ByKind:        []KindFacet{},
		BySource:      []StringFacet{},
		ByProject:     []ProjectFacet{},
		ByEcosystem:   []StringFacet{},
		ByIacProvider: []StringFacet{},
		BySecretKind:  []StringFacet{},
	}

	g, gctx := errgroup.WithContext(ctx)
	// Avoid flooding Postgres with too many concurrent full-table aggregates.
	// Facets still execute in parallel, but with a bounded fan-out to keep tail
	// latency predictable under load.
	g.SetLimit(4)

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetSeverity, 1)
		q := `SELECT f.severity, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.severity`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_severity: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b SeverityFacet
			if err := rows.Scan(&b.Severity, &b.Count); err != nil {
				return fmt.Errorf("facets.by_severity scan: %w", err)
			}
			out.BySeverity = append(out.BySeverity, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetStatus, 1)
		q := `SELECT f.status, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.status`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_status: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b StatusFacet
			if err := rows.Scan(&b.Status, &b.Count); err != nil {
				return fmt.Errorf("facets.by_status scan: %w", err)
			}
			out.ByStatus = append(out.ByStatus, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetKind, 1)
		q := `SELECT f.finding_kind, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.finding_kind`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_kind: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var kind int16
			var cnt int
			if err := rows.Scan(&kind, &cnt); err != nil {
				return fmt.Errorf("facets.by_kind scan: %w", err)
			}
			out.ByKind = append(out.ByKind, KindFacet{
				Kind:  domain.FindingKind(kind).String(),
				Count: cnt,
			})
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, "", 1)
		q := `SELECT f.source_type, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.source_type ORDER BY count(*) DESC`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_source: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b StringFacet
			if err := rows.Scan(&b.Value, &b.Count); err != nil {
				return fmt.Errorf("facets.by_source scan: %w", err)
			}
			out.BySource = append(out.BySource, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetProject, 1)
		q := `SELECT p.id, p.name, count(*)
			FROM findings f
			JOIN projects p ON p.id = f.project_id
			` + whereClause(conds) + `
			GROUP BY p.id, p.name
			ORDER BY count(*) DESC
			LIMIT 20`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_project: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b ProjectFacet
			if err := rows.Scan(&b.ID, &b.Name, &b.Count); err != nil {
				return fmt.Errorf("facets.by_project scan: %w", err)
			}
			out.ByProject = append(out.ByProject, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetEcosystem, 1)
		conds = append(conds, fmt.Sprintf("f.finding_kind = %d", int(domain.KindSCA)))
		conds = append(conds, "f.package_ecosystem IS NOT NULL")
		q := `SELECT f.package_ecosystem, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.package_ecosystem ORDER BY count(*) DESC`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_ecosystem: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b StringFacet
			if err := rows.Scan(&b.Value, &b.Count); err != nil {
				return fmt.Errorf("facets.by_ecosystem scan: %w", err)
			}
			out.ByEcosystem = append(out.ByEcosystem, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetIacProvider, 1)
		conds = append(conds, fmt.Sprintf("f.finding_kind = %d", int(domain.KindIaC)))
		conds = append(conds, "f.iac_provider IS NOT NULL")
		q := `SELECT f.iac_provider, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.iac_provider ORDER BY count(*) DESC`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_iac_provider: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b StringFacet
			if err := rows.Scan(&b.Value, &b.Count); err != nil {
				return fmt.Errorf("facets.by_iac_provider scan: %w", err)
			}
			out.ByIacProvider = append(out.ByIacProvider, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetSecretKind, 1)
		conds = append(conds, fmt.Sprintf("f.finding_kind = %d", int(domain.KindSecrets)))
		conds = append(conds, "f.secret_kind IS NOT NULL")
		q := `SELECT f.secret_kind, count(*) FROM findings f ` + whereClause(conds) + ` GROUP BY f.secret_kind ORDER BY count(*) DESC`
		rows, err := r.pool.Query(gctx, q, args...)
		if err != nil {
			return fmt.Errorf("facets.by_secret_kind: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var b StringFacet
			if err := rows.Scan(&b.Value, &b.Count); err != nil {
				return fmt.Errorf("facets.by_secret_kind scan: %w", err)
			}
			out.BySecretKind = append(out.BySecretKind, b)
		}
		return rows.Err()
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetInKEV, 1)
		conds = append(conds, "EXISTS (SELECT 1 FROM kev_catalog k WHERE f.cve_ids IS NOT NULL AND k.cve_id = ANY(f.cve_ids))")
		return r.pool.QueryRow(gctx,
			`SELECT count(*) FROM findings f `+whereClause(conds), args...,
		).Scan(&out.Enrichment.InKEV)
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetHasCVE, 1)
		conds = append(conds, "array_length(f.cve_ids, 1) > 0")
		return r.pool.QueryRow(gctx,
			`SELECT count(*) FROM findings f `+whereClause(conds), args...,
		).Scan(&out.Enrichment.HasCVE)
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetHasFix, 1)
		conds = append(conds, "f.fixed_version IS NOT NULL")
		return r.pool.QueryRow(gctx,
			`SELECT count(*) FROM findings f `+whereClause(conds), args...,
		).Scan(&out.Enrichment.HasFix)
	})

	g.Go(func() error {
		conds, args, _ := buildBaseWhere(&filter, FacetInBDU, 1)
		conds = append(conds, "EXISTS (SELECT 1 FROM bdu_fstec b WHERE f.cve_ids IS NOT NULL AND b.cve_ids && f.cve_ids)")
		return r.pool.QueryRow(gctx,
			`SELECT count(*) FROM findings f `+whereClause(conds), args...,
		).Scan(&out.Enrichment.InBDU)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.Facets: %w", err)
	}
	return out, nil
}

// ListGroups aggregates findings by a grouping axis (cve|component|rule|secret)
// and returns up to 200 groups ordered by max severity + findings count. Cursor
// pagination is not supported — groups are bounded and cheap compared to the
// flat list.
func (r *FindingsRepo) ListGroups(ctx context.Context, filter FindingsFilter, groupBy string) ([]domain.FindingGroup, int, error) {
	const groupLimit = 200

	// Shared enrichment expressions for modes that aggregate across finding CVE arrays.
	const (
		sharedKEV  = "bool_or(EXISTS (SELECT 1 FROM kev_catalog k WHERE f.cve_ids IS NOT NULL AND k.cve_id = ANY(f.cve_ids)))"
		sharedBDU  = "bool_or(EXISTS (SELECT 1 FROM bdu_fstec b WHERE f.cve_ids IS NOT NULL AND b.cve_ids && f.cve_ids))"
		sharedEPSS = "MAX((SELECT MAX(e.epss_score) FROM epss_scores e WHERE f.cve_ids IS NOT NULL AND e.cve_id = ANY(f.cve_ids)))"
		sharedCVSS = "MAX((SELECT MAX(n.cvss_v31_score) FROM nvd_cves n WHERE f.cve_ids IS NOT NULL AND n.cve_id = ANY(f.cve_ids)))"
	)

	var (
		groupKeyExpr   string
		groupTitleExpr string
		secretKindExpr string
		ecosystemExpr  string
		fixedVerExpr   string
		inKEVExpr      string
		inBDUExpr      string
		bduIDsExpr     string
		epssExpr       string
		cvssExpr       string
		fromExpr       string
		extraConds     []string
	)

	switch groupBy {
	case "cve":
		// Unnest CVE arrays so each (finding, cve) pair contributes once. The
		// LEFT JOIN to nvd_cves provides description and CVSS without an extra
		// correlated subquery per row.
		groupKeyExpr = "cve_key"
		groupTitleExpr = "MAX(n.description)"
		secretKindExpr = "NULL::text"
		ecosystemExpr = "NULL::text"
		fixedVerExpr = "NULL::text"
		inKEVExpr = "bool_or(EXISTS (SELECT 1 FROM kev_catalog k WHERE k.cve_id = cve_key))"
		inBDUExpr = "bool_or(EXISTS (SELECT 1 FROM bdu_fstec b WHERE b.cve_ids @> ARRAY[cve_key]))"
		// Correlated subquery runs once per GROUP ROW (~200 max) — acceptable.
		bduIDsExpr = "(SELECT array_agg(DISTINCT b2.bdu_id) FROM bdu_fstec b2 WHERE b2.cve_ids @> ARRAY[cve_key])"
		epssExpr = "MAX((SELECT e.epss_score FROM epss_scores e WHERE e.cve_id = cve_key))"
		cvssExpr = "MAX(n.cvss_v31_score)" // from the LEFT JOIN
		fromExpr = "findings f CROSS JOIN LATERAL unnest(f.cve_ids) AS c(cve_key) LEFT JOIN nvd_cves n ON n.cve_id = cve_key"
		extraConds = []string{"f.cve_ids IS NOT NULL", "array_length(f.cve_ids, 1) > 0"}
	case "component":
		groupKeyExpr = "f.component || '@' || COALESCE(f.component_version, '')"
		groupTitleExpr = "NULL::text"
		secretKindExpr = "NULL::text"
		ecosystemExpr = "MAX(f.package_ecosystem)"
		fixedVerExpr = "MIN(CASE WHEN f.fixed_version IS NOT NULL THEN f.fixed_version END)"
		inKEVExpr = sharedKEV
		inBDUExpr = sharedBDU
		bduIDsExpr = "NULL::text[]"
		epssExpr = sharedEPSS
		cvssExpr = sharedCVSS
		fromExpr = "findings f"
		extraConds = []string{"f.component IS NOT NULL"}
	case "rule":
		// Unit separator (E'\x1f') is the join byte — safe because rule_id /
		// rule_name are human-readable strings that never contain control chars.
		groupKeyExpr = `COALESCE(f.rule_id, '') || E'\x1f' || COALESCE(f.rule_name, '')`
		groupTitleExpr = "MAX(f.rule_name)"
		secretKindExpr = "NULL::text"
		ecosystemExpr = "NULL::text"
		fixedVerExpr = "NULL::text"
		inKEVExpr = sharedKEV
		inBDUExpr = sharedBDU
		bduIDsExpr = "NULL::text[]"
		epssExpr = sharedEPSS
		cvssExpr = sharedCVSS
		fromExpr = "findings f"
		extraConds = []string{"f.rule_id IS NOT NULL"}
	case "secret":
		// Use fingerprint when available; fall back to rule_id + file_path so that
		// secrets imported before the fingerprint migration still get grouped.
		groupKeyExpr = "COALESCE(f.secret_fingerprint, COALESCE(f.rule_id, '') || ':' || COALESCE(f.file_path, ''))"
		groupTitleExpr = "MAX(f.secret_kind)"
		secretKindExpr = "MAX(f.secret_kind)"
		ecosystemExpr = "NULL::text"
		fixedVerExpr = "NULL::text"
		// Secrets don't carry CVE IDs, so KEV/BDU/EPSS/CVSS are always null.
		inKEVExpr = "FALSE"
		inBDUExpr = "FALSE"
		bduIDsExpr = "NULL::text[]"
		epssExpr = "NULL::real"
		cvssExpr = "NULL::real"
		fromExpr = "findings f"
		extraConds = []string{
			fmt.Sprintf("f.finding_kind = %d", int(domain.KindSecrets)),
		}
	case "cwe":
		// Unnest CWE int arrays so each (finding, cwe) pair contributes once.
		groupKeyExpr = "cwe_key::text"
		groupTitleExpr = "NULL::text"
		secretKindExpr = "NULL::text"
		ecosystemExpr = "NULL::text"
		fixedVerExpr = "NULL::text"
		inKEVExpr = sharedKEV
		inBDUExpr = sharedBDU
		bduIDsExpr = "NULL::text[]"
		epssExpr = sharedEPSS
		cvssExpr = sharedCVSS
		fromExpr = "findings f CROSS JOIN LATERAL unnest(f.cwe_ids) AS c(cwe_key)"
		extraConds = []string{"f.cwe_ids IS NOT NULL", "array_length(f.cwe_ids, 1) > 0"}
	default:
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListGroups: unknown group_by %q", groupBy)
	}

	conds, args, _ := buildBaseWhere(&filter, "", 1)
	conds = append(conds, extraConds...)

	q := fmt.Sprintf(`
		SELECT
			%s AS group_key,
			%s AS group_title,
			%s AS secret_kind,
			%s AS ecosystem,
			%s AS fixed_version,
			count(*) AS findings_count,
			count(DISTINCT f.project_id) AS projects_count,
			max(f.severity) AS max_severity,
			min(f.first_seen) AS first_seen,
			max(f.last_seen) AS last_seen,
			array_agg(DISTINCT f.project_id) AS project_ids,
			(array_agg(f.id ORDER BY f.first_seen DESC))[1:3] AS sample_ids,
			%s AS in_kev,
			%s AS in_bdu,
			%s AS bdu_ids,
			%s AS max_epss,
			%s AS max_cvss
		FROM %s
		%s
		GROUP BY %s
		ORDER BY max_severity DESC, findings_count DESC
		LIMIT %d`,
		groupKeyExpr, groupTitleExpr, secretKindExpr, ecosystemExpr, fixedVerExpr,
		inKEVExpr, inBDUExpr, bduIDsExpr, epssExpr, cvssExpr,
		fromExpr, whereClause(conds), groupKeyExpr, groupLimit)

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListGroups: query: %w", err)
	}
	defer rows.Close()

	groups := make([]domain.FindingGroup, 0)
	for rows.Next() {
		var g domain.FindingGroup
		var groupTitle, secretKind, ecosystem, fixedVersion *string
		if err := rows.Scan(
			&g.GroupKey, &groupTitle, &secretKind, &ecosystem, &fixedVersion,
			&g.FindingsCount, &g.ProjectsCount,
			&g.MaxSeverity, &g.FirstSeen, &g.LastSeen,
			&g.ProjectIDs, &g.SampleIDs,
			&g.InKEV, &g.InBDU, &g.BDUIDs,
			&g.MaxEPSS, &g.MaxCVSS,
		); err != nil {
			return nil, 0, fmt.Errorf("storage.FindingsRepo.ListGroups: scan: %w", err)
		}
		if groupTitle != nil {
			g.GroupTitle = *groupTitle
		}
		g.SecretKind = secretKind
		g.Ecosystem = ecosystem
		g.FixedVersion = fixedVersion

		if groupBy == "rule" {
			// Unit-separator (\x1f) splits rule_id from rule_name; present as
			// "rule_id — rule_name" for display.
			if idx := strings.Index(g.GroupKey, "\x1f"); idx >= 0 {
				id, name := g.GroupKey[:idx], g.GroupKey[idx+1:]
				if name == "" {
					g.GroupKey = id
				} else {
					g.GroupKey = id + " — " + name
				}
			}
		}
		if g.ProjectIDs == nil {
			g.ProjectIDs = []uuid.UUID{}
		}
		if g.SampleIDs == nil {
			g.SampleIDs = []uuid.UUID{}
		}
		if g.BDUIDs == nil {
			g.BDUIDs = []string{}
		}
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListGroups: rows: %w", err)
	}
	return groups, len(groups), nil
}

// BulkLimitExceededError is returned by ListIDsByGroup when a group has more
// than the hard-coded 5000-finding ceiling for a single bulk operation.
type BulkLimitExceededError struct {
	Count int
}

func (e *BulkLimitExceededError) Error() string {
	return fmt.Sprintf("group contains %d findings, exceeds bulk limit of 5000", e.Count)
}

// ListIDsByGroup resolves the set of finding IDs belonging to a specific group
// key. It honours the base FindingsFilter (RBAC/project scoping) and refuses to
// return more than 5000 IDs in one call.
func (r *FindingsRepo) ListIDsByGroup(ctx context.Context, filter FindingsFilter, groupBy, groupKey string) ([]uuid.UUID, int, error) {
	const hardLimit = 5000

	// Clear overlay fields so we can set them precisely to the group key.
	filter.CVE = ""
	filter.Components = nil
	filter.ComponentVersion = ""
	filter.RuleID = ""
	filter.SecretFingerprint = ""

	conds, args, argN := buildBaseWhere(&filter, "", 1)

	switch groupBy {
	case "cve":
		conds = append(conds, fmt.Sprintf("f.cve_ids @> ARRAY[$%d]::text[]", argN))
		args = append(args, groupKey)
	case "component":
		at := strings.LastIndex(groupKey, "@")
		if at >= 0 {
			comp, ver := groupKey[:at], groupKey[at+1:]
			conds = append(conds, fmt.Sprintf("f.component = $%d", argN))
			args = append(args, comp)
			argN++
			conds = append(conds, fmt.Sprintf("COALESCE(f.component_version, '') = $%d", argN))
			args = append(args, ver)
		} else {
			conds = append(conds, fmt.Sprintf("f.component = $%d", argN))
			args = append(args, groupKey)
		}
	case "rule":
		// Accept both internal (\x1f) and display (" — ") formats from client.
		ruleID := groupKey
		if idx := strings.Index(groupKey, "\x1f"); idx >= 0 {
			ruleID = groupKey[:idx]
		} else if idx := strings.Index(groupKey, " — "); idx >= 0 {
			ruleID = groupKey[:idx]
		}
		conds = append(conds, fmt.Sprintf("f.rule_id = $%d", argN))
		args = append(args, ruleID)
	case "secret":
		conds = append(conds, fmt.Sprintf("f.secret_fingerprint = $%d", argN))
		args = append(args, groupKey)
	case "cwe":
		cweID, err := strconv.Atoi(groupKey)
		if err != nil || cweID <= 0 {
			return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: invalid cwe group_key %q", groupKey)
		}
		conds = append(conds, fmt.Sprintf("f.cwe_ids @> ARRAY[$%d]::int[]", argN))
		args = append(args, cweID)
	default:
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: unknown group_by %q", groupBy)
	}

	where := whereClause(conds)

	var total int
	if err := r.pool.QueryRow(ctx, "SELECT count(*) FROM findings f "+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: count: %w", err)
	}
	if total > hardLimit {
		return nil, total, &BulkLimitExceededError{Count: total}
	}

	q := fmt.Sprintf("SELECT f.id FROM findings f %s LIMIT %d", where, hardLimit)
	idRows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: query: %w", err)
	}
	defer idRows.Close()

	ids := make([]uuid.UUID, 0, total)
	for idRows.Next() {
		var id uuid.UUID
		if err := idRows.Scan(&id); err != nil {
			return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: scan: %w", err)
		}
		ids = append(ids, id)
	}
	if err := idRows.Err(); err != nil {
		return nil, 0, fmt.Errorf("storage.FindingsRepo.ListIDsByGroup: rows: %w", err)
	}
	return ids, total, nil
}

func (r *FindingsRepo) getForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*domain.Finding, error) {
	finding, err := scanFinding(tx.QueryRow(ctx, `
		SELECT `+findingColumns+`
		FROM findings f
		LEFT JOIN finding_scores fs ON fs.finding_id = f.id
		WHERE f.id = $1
		FOR UPDATE OF f`, id))
	if err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.getForUpdate: %w", err)
	}
	return finding, nil
}

func (r *FindingsRepo) ApplyTriageAction(
	ctx context.Context,
	userID uuid.UUID,
	findingID uuid.UUID,
	action domain.TriageAction,
) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	finding, err := r.getForUpdate(ctx, tx, findingID)
	if err != nil {
		return err
	}

	if err := r.closureReasonsRepo.EnsureLoaded(ctx); err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: load closure reasons: %w", err)
	}
	if err := action.ApplyTo(finding, r.closureReasonsRepo); err != nil {
		return err
	}

	const uq = `
		UPDATE findings
		SET status = $1,
			closure_reason_id = $2,
			closure_note = $3,
			closed_at = $4,
			closed_by = $5,
			assigned_to = $6
		WHERE id = $7`
	if _, err := tx.Exec(ctx, uq,
		finding.Status, finding.ClosureReasonID, finding.ClosureNote, finding.ClosedAt, finding.ClosedBy, finding.AssignedTo, finding.ID,
	); err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: update finding: %w", err)
	}

	event, err := action.BuildEvent(userID, finding)
	if err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: build event: %w", err)
	}
	if err := r.findingEventsRepo.Create(ctx, tx, event); err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("storage.FindingsRepo.ApplyTriageAction: commit: %w", err)
	}
	return nil
}

type BulkResult struct {
	Succeeded []uuid.UUID          `json:"succeeded"`
	Failed    map[uuid.UUID]string `json:"failed"`
}

func (r *FindingsRepo) ApplyBulkTriageAction(
	ctx context.Context,
	userID uuid.UUID,
	ids []uuid.UUID,
	builder func(id uuid.UUID) domain.TriageAction,
) (BulkResult, error) {
	result := BulkResult{
		Succeeded: make([]uuid.UUID, 0, len(ids)),
		Failed:    make(map[uuid.UUID]string),
	}
	var mu sync.Mutex
	eg, egCtx := errgroup.WithContext(ctx)
	eg.SetLimit(10)

	for _, findingID := range ids {
		id := findingID
		eg.Go(func() error {
			action := builder(id)
			err := r.ApplyTriageAction(egCtx, userID, id, action)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				result.Failed[id] = err.Error()
				return nil
			}
			result.Succeeded = append(result.Succeeded, id)
			return nil
		})
	}
	if err := eg.Wait(); err != nil {
		return result, fmt.Errorf("storage.FindingsRepo.ApplyBulkTriageAction: %w", err)
	}
	return result, nil
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

func (r *FindingsRepo) GetProjectID(ctx context.Context, id string) (uuid.UUID, error) {
	findingID, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("storage.FindingsRepo.GetProjectID: parse finding id: %w", err)
	}

	const q = `SELECT project_id FROM findings WHERE id = $1`
	var projectID uuid.UUID
	if err := r.pool.QueryRow(ctx, q, findingID).Scan(&projectID); err != nil {
		return uuid.Nil, fmt.Errorf("storage.FindingsRepo.GetProjectID: %w", err)
	}
	return projectID, nil
}

// GetProjectIDsForFindings returns a map from finding ID to its project ID for
// the given set of finding IDs. Used by group-level bulk RBAC checks.
func (r *FindingsRepo) GetProjectIDsForFindings(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]uuid.UUID, error) {
	if len(ids) == 0 {
		return map[uuid.UUID]uuid.UUID{}, nil
	}
	const q = `SELECT id, project_id FROM findings WHERE id = ANY($1)`
	rows, err := r.pool.Query(ctx, q, ids)
	if err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.GetProjectIDsForFindings: %w", err)
	}
	defer rows.Close()
	result := make(map[uuid.UUID]uuid.UUID, len(ids))
	for rows.Next() {
		var fID, pID uuid.UUID
		if err := rows.Scan(&fID, &pID); err != nil {
			return nil, fmt.Errorf("storage.FindingsRepo.GetProjectIDsForFindings: scan: %w", err)
		}
		result[fID] = pID
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.GetProjectIDsForFindings: rows: %w", err)
	}
	return result, nil
}

func (r *FindingsRepo) ListDistinctProjectIDs(ctx context.Context, findingIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(findingIDs) == 0 {
		return []uuid.UUID{}, nil
	}

	const q = `SELECT DISTINCT project_id FROM findings WHERE id = ANY($1)`
	rows, err := r.pool.Query(ctx, q, findingIDs)
	if err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.ListDistinctProjectIDs: %w", err)
	}
	defer rows.Close()

	result := make([]uuid.UUID, 0)
	for rows.Next() {
		var projectID uuid.UUID
		if err := rows.Scan(&projectID); err != nil {
			return nil, fmt.Errorf("storage.FindingsRepo.ListDistinctProjectIDs: scan: %w", err)
		}
		result = append(result, projectID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.FindingsRepo.ListDistinctProjectIDs: rows: %w", err)
	}

	return result, nil
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

func findingKindToDB(kind domain.FindingKind) (int16, error) {
	if kind < math.MinInt16 || kind > math.MaxInt16 {
		return 0, fmt.Errorf("finding kind %d is out of int16 range", kind)
	}
	return int16(kind), nil
}
