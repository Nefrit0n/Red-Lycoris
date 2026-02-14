package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
	"github.com/lib/pq"
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

	Scanner sql.NullString

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

	CWE   []string
	OWASP []string
}

type FindingNeighborsResult struct {
	PrevID   *uuid.UUID
	NextID   *uuid.UUID
	Position int
	Total    int
}

type FindingListCursor struct {
	SortValue any
	ID        uuid.UUID
}

type FindingFilters struct {
	TenantID         *uuid.UUID
	Severities       []string
	Statuses         []string
	ProductIDs       []uuid.UUID
	ImportJobID      *uuid.UUID
	PolicyID         *uuid.UUID
	PolicyDecisions  []string
	RiskBands        []string
	Query            string
	ScannerTypes     []string
	SourceType       string
	OccurrenceStatus []string // "NEW" or "REPEAT"
	DateFrom         *time.Time
	DateTo           *time.Time
	Limit            int
	Offset           int
	SortField        string
	SortOrder        string
	CanonicalOnly    bool
	IncludeRepeats   bool
	Categories       []string
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
	SLAProfile    *string
	SLASource     *string
}

// findingFilterWhereClause contains the common WHERE conditions for finding queries.
// Placeholder order (1..16):
// 1 tenant_id, 2 severities, 3 statuses, 4 product_ids, 5 import_job_id,
// 6 policy_id, 7 policy_decisions, 8 risk_bands,
// 9 query_pattern, 10 scanner_types, 11 source_type,
// 12 occurrence_status, 13 date_from, 14 date_to,
// 15 canonical_only_flag, 16 categories.
const findingFilterWhereClause = `
f.deleted_at IS NULL
  AND (f.tenant_id = $1)
  AND ($2::text[] IS NULL OR f.severity = ANY($2))
  AND ($3::text[] IS NULL OR f.status = ANY($3))
  AND ($4::uuid[] IS NULL OR f.product_id = ANY($4))
  AND ($5::uuid IS NULL OR f.import_job_id = $5)
  AND ($6::uuid IS NULL OR EXISTS (
		SELECT 1 FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id AND pr.policy_id = $6
	))
  AND ($7::text[] IS NULL OR (
		SELECT pr.decision FROM policy_results pr
		WHERE pr.subject_type = 'finding' AND pr.subject_id = f.id
		ORDER BY pr.evaluated_at DESC
		LIMIT 1
	) = ANY($7))
  AND ($8::text[] IS NULL OR fr.risk_band = ANY($8))
  AND ($9::text IS NULL OR (f.title ILIKE $9 OR f.description ILIKE $9 OR f.fingerprint ILIKE $9 OR p.identifier ILIKE $9 OR p.name ILIKE $9))
  AND ($10::text[] IS NULL OR sr.scanner = ANY($10))
  AND ($11::text IS NULL OR f.source_type = $11)
  AND ($12::text[] IS NULL OR (
		(f.duplicate_id IS NULL AND f.repeat_count = 0 AND 'NEW' = ANY($12))
		OR ((f.repeat_count > 0 OR f.duplicate_id IS NOT NULL) AND 'REPEAT' = ANY($12))
	))
  AND ($13::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) >= $13)
  AND ($14::timestamptz IS NULL OR COALESCE(f.last_seen_at, f.created_at) <= $14)
  AND ($15::bool = FALSE OR f.duplicate_id IS NULL)
  AND ($16::text[] IS NULL OR f.category = ANY($16))`

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

type findingSortValueType string

const (
	sortValueTime   findingSortValueType = "time"
	sortValueString findingSortValueType = "string"
	sortValueFloat  findingSortValueType = "float"
	sortValueInt    findingSortValueType = "int"
)

type findingSortConfig struct {
	Field     string
	ValueType findingSortValueType
	ExprAsc   string
	ExprDesc  string
}

const (
	riskScoreNullHigh = 1.0e9
	riskScoreNullLow  = -1.0
)

var findingSortConfigs = map[string]findingSortConfig{
	"lastSeenAt": {
		Field:     "lastSeenAt",
		ValueType: sortValueTime,
		ExprAsc:   "COALESCE(f.last_seen_at, f.created_at)",
		ExprDesc:  "COALESCE(f.last_seen_at, f.created_at)",
	},
	"createdAt": {
		Field:     "createdAt",
		ValueType: sortValueTime,
		ExprAsc:   "f.created_at",
		ExprDesc:  "f.created_at",
	},
	"severity": {
		Field:     "severity",
		ValueType: sortValueInt,
		ExprAsc:   "f.severity_rank",
		ExprDesc:  "f.severity_rank",
	},
	"status": {
		Field:     "status",
		ValueType: sortValueInt,
		ExprAsc:   "f.status_rank",
		ExprDesc:  "f.status_rank",
	},
	"riskScore": {
		Field:     "riskScore",
		ValueType: sortValueFloat,
		ExprAsc:   fmt.Sprintf("COALESCE(fr.risk_score, %f)", riskScoreNullHigh),
		ExprDesc:  fmt.Sprintf("COALESCE(fr.risk_score, %f)", riskScoreNullLow),
	},
	"slaDueAt": {
		Field:     "slaDueAt",
		ValueType: sortValueTime,
		ExprAsc:   "COALESCE(f.sla_due_at, TIMESTAMPTZ '9999-12-31T23:59:59Z')",
		ExprDesc:  "COALESCE(f.sla_due_at, TIMESTAMPTZ '0001-01-01T00:00:00Z')",
	},
	"title": {
		Field:     "title",
		ValueType: sortValueString,
		ExprAsc:   "f.title",
		ExprDesc:  "f.title",
	},
	"updatedAt": {
		Field:     "updatedAt",
		ValueType: sortValueTime,
		ExprAsc:   "f.updated_at",
		ExprDesc:  "f.updated_at",
	},
}

// NormalizeFindingSortField validates and normalizes sort field names.
func NormalizeFindingSortField(field string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(field))
	switch s {
	case "", "lastseenat", "lastactivity":
		return "lastSeenAt", nil
	case "createdat":
		return "createdAt", nil
	case "severity":
		return "severity", nil
	case "status":
		return "status", nil
	case "riskscore":
		return "riskScore", nil
	case "sladueat":
		return "slaDueAt", nil
	case "title":
		return "title", nil
	case "updatedat":
		return "updatedAt", nil
	default:
		return "", fmt.Errorf("unsupported sortField")
	}
}

// NormalizeFindingSortOrder validates and normalizes sort order values.
func NormalizeFindingSortOrder(order string) string {
	if strings.EqualFold(strings.TrimSpace(order), "asc") {
		return "asc"
	}
	return "desc"
}

func findingSortConfigFor(field string) (findingSortConfig, error) {
	config, ok := findingSortConfigs[field]
	if !ok {
		return findingSortConfig{}, fmt.Errorf("unsupported sortField")
	}
	return config, nil
}

func findingSortExpr(config findingSortConfig, order string) string {
	if order == "asc" {
		return config.ExprAsc
	}
	return config.ExprDesc
}

func findingSortOrderBy(config findingSortConfig, order string) string {
	expr := findingSortExpr(config, order)
	if order == "asc" {
		return fmt.Sprintf("ORDER BY %s ASC, f.id ASC", expr)
	}
	return fmt.Sprintf("ORDER BY %s DESC, f.id DESC", expr)
}

func findingSortCursorPredicate(config findingSortConfig, order string, argIndex int) string {
	expr := findingSortExpr(config, order)
	operator := ">"
	if order == "desc" {
		operator = "<"
	}
	return fmt.Sprintf("(%s, f.id) %s ($%d, $%d)", expr, operator, argIndex, argIndex+1)
}

func findingCursorKeyDestination(valueType findingSortValueType) any {
	switch valueType {
	case sortValueFloat:
		var v float64
		return &v
	case sortValueInt:
		var v int16
		return &v
	case sortValueString:
		var v string
		return &v
	default:
		var v time.Time
		return &v
	}
}

func findCursorValueFromDestination(dest any) any {
	switch value := dest.(type) {
	case *float64:
		return *value
	case *int16:
		return *value
	case *string:
		return *value
	case *time.Time:
		return *value
	default:
		return nil
	}
}

func ParseFindingCursorValue(sortField, raw string) (any, error) {
	config, err := findingSortConfigFor(sortField)
	if err != nil {
		return nil, err
	}
	switch config.ValueType {
	case sortValueFloat:
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid cursor")
		}
		return v, nil
	case sortValueInt:
		var v int16
		if _, err := fmt.Sscanf(raw, "%d", &v); err != nil {
			return nil, fmt.Errorf("invalid cursor")
		}
		return v, nil
	case sortValueString:
		if raw == "" {
			return nil, fmt.Errorf("invalid cursor")
		}
		return raw, nil
	default:
		parsed, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return nil, fmt.Errorf("invalid cursor")
		}
		return parsed, nil
	}
}

func FormatFindingCursorValue(sortField string, value any) (string, error) {
	config, err := findingSortConfigFor(sortField)
	if err != nil {
		return "", err
	}
	switch config.ValueType {
	case sortValueFloat:
		typed, ok := value.(float64)
		if !ok {
			return "", fmt.Errorf("invalid cursor")
		}
		return strconv.FormatFloat(typed, 'g', -1, 64), nil
	case sortValueInt:
		switch v := value.(type) {
		case int16:
			return fmt.Sprintf("%d", v), nil
		case int:
			return fmt.Sprintf("%d", v), nil
		default:
			return "", fmt.Errorf("invalid cursor")
		}
	case sortValueString:
		typed, ok := value.(string)
		if !ok {
			return "", fmt.Errorf("invalid cursor")
		}
		return typed, nil
	default:
		typed, ok := value.(time.Time)
		if !ok {
			return "", fmt.Errorf("invalid cursor")
		}
		return typed.UTC().Format(time.RFC3339Nano), nil
	}
}

// buildFindingFilterArgs normalizes filters into a stable argument list for SQL queries.
func buildFindingFilterArgs(filters FindingFilters) []any {
	var tenant any
	if filters.TenantID != nil {
		tenant = *filters.TenantID
	}

	var products any
	if len(filters.ProductIDs) > 0 {
		products = pq.Array(filters.ProductIDs)
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

	occValues := make([]string, 0, len(filters.OccurrenceStatus))
	for _, value := range filters.OccurrenceStatus {
		normalized := strings.ToUpper(strings.TrimSpace(value))
		if normalized == "NEW" || normalized == "REPEAT" {
			occValues = append(occValues, normalized)
		}
	}
	var occAny any
	if len(occValues) > 0 {
		occAny = pq.Array(occValues)
	}

	canonicalOnly := filters.CanonicalOnly || !filters.IncludeRepeats

	return []any{
		tenant,
		stringSliceOrNil(filters.Severities),
		stringSliceOrNil(filters.Statuses),
		products,
		importJob,
		policyID,
		stringSliceOrNil(filters.PolicyDecisions),
		stringSliceOrNil(filters.RiskBands),
		likePatternOrNil(filters.Query),
		stringSliceOrNil(filters.ScannerTypes),
		nilIfEmpty(filters.SourceType),
		occAny,
		dateFrom,
		dateTo,
		canonicalOnly,
		stringSliceOrNil(filters.Categories),
	}
}

func stringSliceOrNil(values []string) any {
	trimmed := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			trimmed = append(trimmed, strings.TrimSpace(value))
		}
	}
	if len(trimmed) == 0 {
		return nil
	}
	return pq.Array(trimmed)
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

func ListFindings(ctx context.Context, db *sql.DB, filters FindingFilters, cursor *FindingListCursor, useCursor bool, includeTotal bool) ([]FindingListItem, *int, *FindingListCursor, bool, error) {
	if filters.TenantID == nil {
		return nil, nil, nil, false, fmt.Errorf("tenant_id is required for listing findings")
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

	sortField, err := NormalizeFindingSortField(filters.SortField)
	if err != nil {
		return nil, nil, nil, false, err
	}
	sortOrder := NormalizeFindingSortOrder(filters.SortOrder)

	argsBase := buildFindingFilterArgs(filters)

	var total *int
	if includeTotal {
		countQuery := fmt.Sprintf(`SELECT COUNT(*) %s WHERE %s`, findingBaseJoins, findingFilterWhereClause)
		var count int
		if err := db.QueryRowContext(ctx, countQuery, argsBase...).Scan(&count); err != nil {
			return nil, nil, nil, false, err
		}
		total = &count
	}

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
			sr.scanner,
			f.assignee_id, u.username,
			pr_latest.decision,
			fr.risk_score, fr.risk_band,
			fr.computed_at, fr.model_version,
			f.created_at, f.updated_at, f.source_type,
			f.cwe,
			f.owasp,
			%s AS sort_key`

	whereClause := findingFilterWhereClause
	args := append([]any{}, argsBase...)
	argIndex := len(args) + 1

	var query string
	sortConfig, err := findingSortConfigFor(sortField)
	if err != nil {
		return nil, nil, nil, false, err
	}

	if useCursor {
		if cursor != nil {
			whereClause = fmt.Sprintf("%s AND %s", whereClause, findingSortCursorPredicate(sortConfig, sortOrder, argIndex))
			args = append(args, cursor.SortValue, cursor.ID)
			argIndex += 2
		}
		orderBy := findingSortOrderBy(sortConfig, sortOrder)
		limitValue := filters.Limit + 1
		query = fmt.Sprintf(`%s %s WHERE %s %s LIMIT $%d`,
			fmt.Sprintf(selectFields, findingSortExpr(sortConfig, sortOrder)),
			findingListJoins,
			whereClause,
			orderBy,
			argIndex)
		args = append(args, limitValue)
	} else {
		orderBy := findingSortOrderBy(sortConfig, sortOrder)
		limitValue := filters.Limit + 1
		query = fmt.Sprintf(`%s %s WHERE %s %s LIMIT $%d OFFSET $%d`,
			fmt.Sprintf(selectFields, findingSortExpr(sortConfig, sortOrder)),
			findingListJoins,
			whereClause,
			orderBy,
			argIndex,
			argIndex+1)
		args = append(args, limitValue, filters.Offset)
	}

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, nil, nil, false, err
	}
	defer rows.Close()

	items := []FindingListItem{}
	sortKeys := []any{}
	var nextCursor *FindingListCursor
	hasNext := false
	for rows.Next() {
		var item FindingListItem
		sortKeyDest := findingCursorKeyDestination(sortConfig.ValueType)
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
			pq.Array(&item.CWE),
			pq.Array(&item.OWASP),
			sortKeyDest,
		); err != nil {
			return nil, nil, nil, false, err
		}
		items = append(items, item)
		sortKeys = append(sortKeys, findCursorValueFromDestination(sortKeyDest))
	}
	if err := rows.Err(); err != nil {
		return nil, nil, nil, false, err
	}

	if len(items) > filters.Limit {
		hasNext = true
		items = items[:filters.Limit]
		sortKeys = sortKeys[:filters.Limit]
	}

	if useCursor && hasNext {
		lastIndex := len(items) - 1
		nextCursor = &FindingListCursor{SortValue: sortKeys[lastIndex], ID: items[lastIndex].ID}
	}

	return items, total, nextCursor, hasNext, nil
}

func GetFindingNeighbors(ctx context.Context, db *sql.DB, currentID uuid.UUID, filters FindingFilters) (FindingNeighborsResult, error) {
	if filters.TenantID == nil {
		return FindingNeighborsResult{}, fmt.Errorf("tenant_id is required for finding neighbors")
	}

	argsBase := buildFindingFilterArgs(filters)
	currentArgs := append(argsBase, currentID)

	currentQuery := fmt.Sprintf(`
		SELECT COALESCE(f.last_seen_at, f.created_at)
		%s
		WHERE %s AND f.id = $17`,
		findingBaseJoins,
		findingFilterWhereClause,
	)

	var currentSortKey time.Time
	if err := db.QueryRowContext(ctx, currentQuery, currentArgs...).Scan(&currentSortKey); err != nil {
		if err == sql.ErrNoRows {
			return FindingNeighborsResult{}, nil
		}
		return FindingNeighborsResult{}, err
	}

	res := FindingNeighborsResult{}

	prevQuery := fmt.Sprintf(`
		SELECT f.id
		%s
		WHERE %s
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) > ($16, $17)
		ORDER BY COALESCE(f.last_seen_at, f.created_at) DESC, f.id DESC
		LIMIT 1`,
		findingBaseJoins,
		findingFilterWhereClause,
	)
	prevArgs := append(argsBase, currentSortKey, currentID)
	if err := db.QueryRowContext(ctx, prevQuery, prevArgs...).Scan(&res.PrevID); err != nil {
		if err != sql.ErrNoRows {
			return res, err
		}
		res.PrevID = nil
	}

	nextQuery := fmt.Sprintf(`
		SELECT f.id
		%s
		WHERE %s
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) < ($16, $17)
		ORDER BY COALESCE(f.last_seen_at, f.created_at) DESC, f.id DESC
		LIMIT 1`,
		findingBaseJoins,
		findingFilterWhereClause,
	)
	nextArgs := append(argsBase, currentSortKey, currentID)
	if err := db.QueryRowContext(ctx, nextQuery, nextArgs...).Scan(&res.NextID); err != nil {
		if err != sql.ErrNoRows {
			return res, err
		}
		res.NextID = nil
	}

	positionQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		%s
		WHERE %s
		  AND (COALESCE(f.last_seen_at, f.created_at), f.id) > ($16, $17)`,
		findingBaseJoins,
		findingFilterWhereClause,
	)
	if err := db.QueryRowContext(ctx, positionQuery, prevArgs...).Scan(&res.Position); err != nil {
		return res, err
	}
	res.Position += 1

	totalQuery := fmt.Sprintf(`SELECT COUNT(*) %s WHERE %s`, findingBaseJoins, findingFilterWhereClause)
	if err := db.QueryRowContext(ctx, totalQuery, argsBase...).Scan(&res.Total); err != nil {
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
	var severityRank *int16
	var statusRank *int16
	if params.Severity != nil {
		rank := models.SeverityRank(*params.Severity)
		severityRank = &rank
	}
	if params.Status != nil {
		rank := models.StatusRank(*params.Status)
		statusRank = &rank
	}

	row := db.QueryRowContext(
		ctx,
		`UPDATE findings
		 SET title = COALESCE($1, title),
		     description = COALESCE($2, description),
		     severity = COALESCE($3, severity),
		     severity_rank = COALESCE($4, severity_rank),
		     status = COALESCE($5, status),
		     status_rank = COALESCE($6, status_rank),
		     product_id = COALESCE($7, product_id),
		     assignee_id = COALESCE($8, assignee_id),
		     sla_due_at = COALESCE($9, sla_due_at),
		     sla_breached = COALESCE($10, sla_breached),
		     sla_breached_at = COALESCE($11, sla_breached_at),
		     sla_profile = COALESCE($12, sla_profile),
		     sla_source = COALESCE($13, sla_source),
		     updated_at = $14
		 WHERE id = $15 AND deleted_at IS NULL
		 RETURNING id, scan_result_id, product_id, import_job_id, fingerprint, title, description, severity, status, duplicate_id, repeat_count, first_seen_at, last_seen_at, created_at, updated_at, evidence, source_type, category,
			sla_due_at, sla_breached, sla_breached_at, sla_profile, sla_source, assignee_id`,
		params.Title,
		params.Description,
		params.Severity,
		severityRank,
		params.Status,
		statusRank,
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
