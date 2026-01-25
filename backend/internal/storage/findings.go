package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

type FindingListItem struct {
	ID          uuid.UUID
	TenantID    uuid.NullUUID
	ImportJobID uuid.NullUUID

	Fingerprint string
	Title       string
	Severity    string
	Status      string
	Category    string

	ProductID   uuid.NullUUID
	ProductName sql.NullString

	DuplicateID uuid.NullUUID
	RepeatCount int

	FirstSeenAt sql.NullTime
	LastSeenAt  sql.NullTime

	SLADueAt      sql.NullTime
	SLABreached   sql.NullBool
	SLABreachedAt sql.NullTime
	SLAProfile    sql.NullString
	SLASource     sql.NullString

	LastScanAt sql.NullTime
	Scanner    sql.NullString

	AssigneeID   uuid.NullUUID
	AssigneeName sql.NullString

	PolicyDecision sql.NullString

	RiskScore     sql.NullFloat64
	RiskBand      sql.NullString
	RiskUpdatedAt sql.NullTime   // placeholder (пока NULL в SELECT)
	RiskModel     sql.NullString // placeholder (пока NULL в SELECT)

	CreatedAt  time.Time
	UpdatedAt  time.Time
	SourceType sql.NullString
}

type FindingNeighborsResult struct {
	PrevID *uuid.UUID
	NextID *uuid.UUID
}

type FindingFilters struct {
	TenantID         *uuid.UUID
	Severity         string
	Status           string
	ProductID        *uuid.UUID
	ImportJobID      *uuid.UUID
	PolicyID         *uuid.UUID
	PolicyDecision   string
	RiskBand         string
	Query            string
	ScannerType      string
	SourceType       string
	OccurrenceStatus string // "NEW" or "REPEAT"
	DateFrom         *time.Time
	DateTo           *time.Time
	Limit            int
	Offset           int
	SortField        string
	SortOrder        string
	CanonicalOnly    bool
	IncludeRepeats   bool
}

type UpdateFindingParams struct {
	Title         *string
	Description   *string
	Severity      *string
	Status        *string
	ProductID     *uuid.UUID
	AssigneeID    *uuid.UUID
	SLADueAt      *time.Time
	SLABreached   *bool
	SLABreachedAt *time.Time
	SLAProfile    *json.RawMessage
	SLASource     *string
}

// findingFilterWhereClause contains the common WHERE conditions for finding queries.
// Placeholder order (1..15):
// 1 tenant_id, 2 severity, 3 status, 4 product_id, 5 import_job_id,
// 6 policy_id, 7 policy_decision, 8 risk_band,
// 9 query_pattern, 10 scanner, 11 source_type,
// 12 occurrence_status, 13 date_from, 14 date_to,
// 15 canonical_only_flag.
const findingFilterWhereClause = `
f.deleted_at IS NULL
  AND (f.tenant_id = $1)
  AND ($2::text IS NULL OR f.severity = $2)
  AND ($3::text IS NULL OR f.status = $3)
  AND ($4::uuid IS NULL OR f.product_id = $4)
  AND ($5::uuid IS NULL OR f.import_job_id = $5)
  AND ($6::uuid IS NULL OR EXISTS (
		SELECT 1 FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $6
	))
  AND ($7::text IS NULL OR (
		SELECT pr.decision FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
		ORDER BY pr.evaluated_at DESC
		LIMIT 1
	) = $7)
  AND ($8::text IS NULL OR fr.risk_band = $8)
  AND ($9::text IS NULL OR (f.title ILIKE $9 OR f.description ILIKE $9 OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9))
  AND ($10::text IS NULL OR sr.scanner = $10)
  AND ($11::text IS NULL OR f.source_type = $11)
  AND ($12::text IS NULL OR (
		($12 = 'NEW' AND f.duplicate_id IS NULL AND f.repeat_count = 0)
		OR ($12 = 'REPEAT' AND (f.repeat_count > 0 OR f.duplicate_id IS NOT NULL))
	))
  AND ($13::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $13)
  AND ($14::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $14)
  AND ($15::bool = FALSE OR f.duplicate_id IS NULL)`

// findingBaseJoins contains the common JOIN clauses for finding queries.
const findingBaseJoins = `
FROM findings f
LEFT JOIN finding_risk fr ON fr.finding_id = f.id
LEFT JOIN products p ON p.id = f.product_id
LEFT JOIN scan_results sr ON sr.id = f.scan_result_id`

// findingListJoins extends base joins with user and policy_results for list queries.
// Uses DISTINCT ON instead of LATERAL for better performance on large result sets.
const findingListJoins = findingBaseJoins + `
LEFT JOIN users u ON u.id = f.assignee_id
LEFT JOIN (
	SELECT DISTINCT ON (subject_id) subject_id, decision
	FROM policy_results
	WHERE subject_type = 'finding'
	ORDER BY subject_id, evaluated_at DESC
) pr_latest ON pr_latest.subject_id = f.id`

// buildFindingOrderBy generates ORDER BY clause for the given sort field and order.
// Parameter $16 is the sort field.
func buildFindingOrderBy(sortOrder string) string {
	nullsOrder := "NULLS LAST"
	order := "DESC"
	if sortOrder == "asc" {
		order = "ASC"
	}

	return fmt.Sprintf(`ORDER BY
	CASE WHEN $16 = 'slaDueAt' THEN CASE WHEN f.sla_due_at IS NULL THEN 1 ELSE 0 END END ASC,
	CASE WHEN $16 = 'slaDueAt' THEN f.sla_due_at END %s %s,
	CASE WHEN $16 = 'title' THEN f.title END %s %s,
	CASE WHEN $16 = 'productName' THEN p.name END %s %s,
	CASE WHEN $16 = 'severity' THEN (CASE LOWER(f.severity) WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) END %s %s,
	CASE WHEN $16 = 'status' THEN f.status END %s %s,
	CASE WHEN $16 = 'lastSeenAt' THEN COALESCE(f.last_seen_at, f.created_at) END %s %s,
	CASE WHEN $16 = 'createdAt' THEN f.created_at END %s %s,
	CASE WHEN $16 = 'updatedAt' THEN f.updated_at END %s %s,
	CASE WHEN $16 = 'riskScore' THEN fr.risk_score END %s %s,
	f.id %s`,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order, nullsOrder,
		order)
}

// buildFindingFilterArgs normalizes filters into a stable argument list for SQL queries.
func buildFindingFilterArgs(filters FindingFilters) []any {
	var tenant any
	if filters.TenantID != nil {
		tenant = *filters.TenantID
	}

	var product any
	if filters.ProductID != nil {
		product = *filters.ProductID
	}

	var importJob any
	if filters.ImportJobID != nil {
		importJob = *filters.ImportJobID
	}

	var policyID any
	if filters.PolicyID != nil {
		policyID = *filters.PolicyID
	}

	var dateFrom any
	if filters.DateFrom != nil {
		dateFrom = *filters.DateFrom
	}

	var dateTo any
	if filters.DateTo != nil {
		dateTo = *filters.DateTo
	}

	occ := strings.ToUpper(strings.TrimSpace(filters.OccurrenceStatus))
	var occAny any
	if occ == "NEW" || occ == "REPEAT" {
		occAny = occ
	}

	canonicalOnly := filters.CanonicalOnly || !filters.IncludeRepeats

	return []any{
		tenant,
		nilIfEmpty(filters.Severity),
		nilIfEmpty(filters.Status),
		product,
		importJob,
		policyID,
		nilIfEmpty(filters.PolicyDecision),
		nilIfEmpty(filters.RiskBand),
		likePatternOrNil(filters.Query),
		nilIfEmpty(filters.ScannerType),
		nilIfEmpty(filters.SourceType),
		occAny,
		dateFrom,
		dateTo,
		canonicalOnly,
	}
}

func normalizeFindingSortField(field string) string {
	s := strings.TrimSpace(field)
	s = strings.ToLower(s)
	switch s {
	case "title", "productname", "severity", "status", "lastseenat", "createdat", "updatedat", "sladueat", "riskscore":
		// Normalize camelCase used by frontend.
		if s == "productname" {
			return "productName"
		}
		if s == "lastseenat" {
			return "lastSeenAt"
		}
		if s == "createdat" {
			return "createdAt"
		}
		if s == "updatedat" {
			return "updatedAt"
		}
		if s == "sladueat" {
			return "slaDueAt"
		}
		if s == "riskscore" {
			return "riskScore"
		}
		return s
	default:
		return "createdAt"
	}
}

func normalizeSortOrder(order string) string {
	if strings.EqualFold(strings.TrimSpace(order), "asc") {
		return "asc"
	}
	return "desc"
}

// findingScanFields is the list of fields to scan from a finding query result.
type findingScanFields struct {
	scanResultID  sql.NullString
	productID     sql.NullString
	importJobID   sql.NullString
	duplicateID   sql.NullString
	assigneeID    sql.NullString
	createdAt     time.Time
	updatedAt     time.Time
	deletedAt     sql.NullTime
	description   sql.NullString
	evidence      []byte
	sourceType    sql.NullString
	category      sql.NullString
	firstSeenAt   sql.NullTime
	lastSeenAt    sql.NullTime
	slaDueAt      sql.NullTime
	slaBreached   sql.NullBool
	slaBreachedAt sql.NullTime
	slaProfile    []byte
	slaSource     sql.NullString
}

// populateFinding fills a Finding model from scanned fields.
func populateFinding(finding *models.Finding, f *findingScanFields) {
	finding.CreatedAt = f.createdAt
	finding.UpdatedAt = f.updatedAt
	if f.deletedAt.Valid {
		finding.DeletedAt = &f.deletedAt.Time
	}

	if f.scanResultID.Valid {
		id, _ := uuid.Parse(f.scanResultID.String)
		finding.ScanResultID = &id
	}
	if f.productID.Valid {
		id, _ := uuid.Parse(f.productID.String)
		finding.ProductID = &id
	}
	if f.importJobID.Valid {
		id, _ := uuid.Parse(f.importJobID.String)
		finding.ImportJobID = &id
	}
	if f.duplicateID.Valid {
		id, _ := uuid.Parse(f.duplicateID.String)
		finding.DuplicateID = &id
	}
	if f.assigneeID.Valid {
		id, _ := uuid.Parse(f.assigneeID.String)
		finding.AssigneeID = &id
	}
	if f.description.Valid {
		finding.Description = &f.description.String
	}
	if f.sourceType.Valid {
		finding.SourceType = &f.sourceType.String
	}
	if f.category.Valid {
		finding.Category = f.category.String
	}
	if f.firstSeenAt.Valid {
		finding.FirstSeenAt = f.firstSeenAt.Time
	}
	if f.lastSeenAt.Valid {
		finding.LastSeenAt = f.lastSeenAt.Time
	}
	if f.slaBreached.Valid {
		finding.SLABreached = f.slaBreached.Bool
	}
	if len(f.slaProfile) > 0 {
		s := string(f.slaProfile)
		finding.SLAProfile = &s
	}
	if len(f.evidence) > 0 {
		finding.Evidence = json.RawMessage(f.evidence)
	}
}

func GetFindingByID(ctx context.Context, db *sql.DB, findingID uuid.UUID) (*models.Finding, error) {
	row := db.QueryRowContext(
		ctx,
		`SELECT id, scan_result_id, product_id, import_job_id, fingerprint, title, description, severity, status, duplicate_id, repeat_count, first_seen_at, last_seen_at, created_at, updated_at, deleted_at, evidence, source_type, category,
			sla_due_at, sla_breached, sla_breached_at, sla_profile, sla_source, assignee_id
		 FROM findings
		 WHERE id = $1 AND deleted_at IS NULL`,
		findingID,
	)

	var finding models.Finding
	var f findingScanFields
	if err := row.Scan(
		&finding.ID,
		&f.scanResultID,
		&f.productID,
		&f.importJobID,
		&finding.Fingerprint,
		&finding.Title,
		&f.description,
		&finding.Severity,
		&finding.Status,
		&f.duplicateID,
		&finding.RepeatCount,
		&f.firstSeenAt,
		&f.lastSeenAt,
		&f.createdAt,
		&f.updatedAt,
		&f.deletedAt,
		&f.evidence,
		&f.sourceType,
		&f.category,
		&f.slaDueAt,
		&f.slaBreached,
		&f.slaBreachedAt,
		&f.slaProfile,
		&f.slaSource,
		&f.assigneeID,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	populateFinding(&finding, &f)
	return &finding, nil
}

func ListFindings(ctx context.Context, db *sql.DB, filters FindingFilters) ([]FindingListItem, int, error) {
	if filters.TenantID == nil {
		return nil, 0, fmt.Errorf("tenant_id is required for listing findings")
	}

	if filters.Limit <= 0 {
		filters.Limit = 20
	}
	if filters.Limit > 200 {
		filters.Limit = 200
	}
	if filters.Offset < 0 {
		filters.Offset = 0
	}

	sortField := normalizeFindingSortField(filters.SortField)
	sortOrder := normalizeSortOrder(filters.SortOrder)

	argsBase := buildFindingFilterArgs(filters)

	// COUNT query
	countQuery := fmt.Sprintf(`SELECT COUNT(*) %s WHERE %s`, findingBaseJoins, findingFilterWhereClause)

	var total int
	if err := db.QueryRowContext(ctx, countQuery, argsBase...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// SELECT query with pagination
	args := append(append([]any{}, argsBase...), sortField, filters.Limit, filters.Offset)

	selectFields := `
		SELECT
			f.id,
			f.tenant_id,
			f.import_job_id,
			f.fingerprint, f.title, f.severity, f.status, COALESCE(f.category, '') AS category,
			f.product_id, p.name,
			f.duplicate_id, f.repeat_count,
			f.first_seen_at, f.last_seen_at,
			f.sla_due_at, f.sla_breached, f.sla_breached_at,
			f.sla_profile::text, f.sla_source,
			MAX(sr.created_at) OVER (PARTITION BY f.product_id) AS last_scan_at,
			sr.scanner,
			f.assignee_id, u.username,
			pr_latest.decision,
			fr.risk_score, fr.risk_band,
			f.created_at, f.updated_at, f.source_type`

	query := fmt.Sprintf(`%s %s WHERE %s %s LIMIT $17 OFFSET $18`,
		selectFields,
		findingListJoins,
		findingFilterWhereClause,
		buildFindingOrderBy(sortOrder))

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []FindingListItem{}
	for rows.Next() {
		var item FindingListItem
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.ImportJobID,

			&item.Fingerprint,
			&item.Title,
			&item.Severity,
			&item.Status,
			&item.Category,

			&item.ProductID,
			&item.ProductName,

			&item.DuplicateID,
			&item.RepeatCount,

			&item.FirstSeenAt,
			&item.LastSeenAt,

			&item.SLADueAt,
			&item.SLABreached,
			&item.SLABreachedAt,
			&item.SLAProfile,
			&item.SLASource,

			&item.LastScanAt,
			&item.Scanner,

			&item.AssigneeID,
			&item.AssigneeName,

			&item.PolicyDecision,

			&item.RiskScore,
			&item.RiskBand,
			&item.RiskUpdatedAt,
			&item.RiskModel,

			&item.CreatedAt,
			&item.UpdatedAt,
			&item.SourceType,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func GetFindingNeighbors(ctx context.Context, db *sql.DB, currentID uuid.UUID, filters FindingFilters) (FindingNeighborsResult, error) {
	if filters.TenantID == nil {
		return FindingNeighborsResult{}, fmt.Errorf("tenant_id is required for finding neighbors")
	}

	sortField := normalizeFindingSortField(filters.SortField)
	sortOrder := normalizeSortOrder(filters.SortOrder)

	args := append(buildFindingFilterArgs(filters), sortField, currentID)

	query := fmt.Sprintf(`
		WITH ranked AS (
			SELECT
				f.id,
				ROW_NUMBER() OVER (%s) AS rn
			%s
			WHERE %s
		),
		cur AS (
			SELECT rn FROM ranked WHERE id = $17
		)
		SELECT
			(SELECT id FROM ranked, cur WHERE ranked.rn = cur.rn - 1) AS prev_id,
			(SELECT id FROM ranked, cur WHERE ranked.rn = cur.rn + 1) AS next_id
		FROM cur`,
		buildFindingOrderBy(sortOrder),
		findingBaseJoins,
		findingFilterWhereClause)

	row := db.QueryRowContext(ctx, query, args...)
	var res FindingNeighborsResult
	if err := row.Scan(&res.PrevID, &res.NextID); err != nil {
		if err == sql.ErrNoRows {
			return res, nil
		}
		return res, err
	}
	return res, nil
}

func UpdateFinding(ctx context.Context, db *sql.DB, findingID uuid.UUID, params UpdateFindingParams) (*models.Finding, error) {
	if params.Title == nil && params.Description == nil && params.Severity == nil && params.Status == nil &&
		params.ProductID == nil && params.AssigneeID == nil && params.SLADueAt == nil &&
		params.SLABreached == nil && params.SLABreachedAt == nil && params.SLAProfile == nil && params.SLASource == nil {
		return nil, nil
	}

	updatedAt := time.Now().UTC()

	row := db.QueryRowContext(
		ctx,
		`UPDATE findings
		 SET title = COALESCE($1, title),
		     description = COALESCE($2, description),
		     severity = COALESCE($3, severity),
		     status = COALESCE($4, status),
		     product_id = COALESCE($5, product_id),
		     assignee_id = COALESCE($6, assignee_id),
		     sla_due_at = COALESCE($7, sla_due_at),
		     sla_breached = COALESCE($8, sla_breached),
		     sla_breached_at = COALESCE($9, sla_breached_at),
		     sla_profile = COALESCE($10, sla_profile),
		     sla_source = COALESCE($11, sla_source),
		     updated_at = $12
		 WHERE id = $13 AND deleted_at IS NULL
		 RETURNING id, scan_result_id, product_id, import_job_id, fingerprint, title, description, severity, status, duplicate_id, repeat_count, first_seen_at, last_seen_at, created_at, updated_at, evidence, source_type, category,
			sla_due_at, sla_breached, sla_breached_at, sla_profile, sla_source, assignee_id`,
		params.Title,
		params.Description,
		params.Severity,
		params.Status,
		params.ProductID,
		params.AssigneeID,
		params.SLADueAt,
		params.SLABreached,
		params.SLABreachedAt,
		params.SLAProfile,
		params.SLASource,
		updatedAt,
		findingID,
	)

	var finding models.Finding
	var f findingScanFields
	if err := row.Scan(
		&finding.ID,
		&f.scanResultID,
		&f.productID,
		&f.importJobID,
		&finding.Fingerprint,
		&finding.Title,
		&f.description,
		&finding.Severity,
		&finding.Status,
		&f.duplicateID,
		&finding.RepeatCount,
		&f.firstSeenAt,
		&f.lastSeenAt,
		&f.createdAt,
		&f.updatedAt,
		&f.evidence,
		&f.sourceType,
		&f.category,
		&f.slaDueAt,
		&f.slaBreached,
		&f.slaBreachedAt,
		&f.slaProfile,
		&f.slaSource,
		&f.assigneeID,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	populateFinding(&finding, &f)
	return &finding, nil
}
