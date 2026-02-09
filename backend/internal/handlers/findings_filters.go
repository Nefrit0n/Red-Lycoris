package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// FindingFilterParams holds common filter parameters parsed from query string
type FindingFilterParams struct {
	TenantID         *uuid.UUID
	ProductIDs       []uuid.UUID
	ImportJobID      *uuid.UUID
	PolicyID         *uuid.UUID
	PolicyDecisions  []string
	DateFrom         *time.Time
	DateTo           *time.Time
	Severities       []string
	Statuses         []string
	RiskBands        []string
	OccurrenceStatus []string
	ScannerTypes     []string
	Categories       []string
	SourceType       string
	Query            string
	CanonicalOnly    bool
	IncludeRepeats   bool
	SortField        string
	SortOrder        string
}

func readQueryValues(c *fiber.Ctx, key string) []string {
	args := c.Context().QueryArgs()
	rawValues := args.PeekMulti(key)
	values := make([]string, 0, len(rawValues))
	for _, raw := range rawValues {
		values = append(values, string(raw))
	}
	if len(values) == 0 {
		if fallback := strings.TrimSpace(c.Query(key)); fallback != "" {
			values = append(values, fallback)
		}
	}

	resolved := make([]string, 0, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				resolved = append(resolved, trimmed)
			}
		}
	}
	return resolved
}

func toOptionalSlice(value string) []string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return []string{trimmed}
}

// parseFindingFiltersFromQuery parses common finding filters from fiber context query params
// This eliminates duplication between List() and Neighbors() handlers
func parseFindingFiltersFromQuery(c *fiber.Ctx, db *sql.DB) (*FindingFilterParams, error) {
	severities := readQueryValues(c, "severity")
	for _, value := range severities {
		if err := validateFindingSeverity(value); err != nil {
			return nil, err
		}
	}

	statuses := readQueryValues(c, "status")
	for _, value := range statuses {
		if err := validateFindingStatus(value); err != nil {
			return nil, err
		}
	}

	riskBands := readQueryValues(c, "riskBand")
	for _, value := range riskBands {
		if !isValidRiskBand(value) {
			return nil, fmt.Errorf("invalid riskBand")
		}
	}

	policyDecisions := readQueryValues(c, "policyDecision")
	for _, value := range policyDecisions {
		if !isValidPolicyDecision(value) {
			return nil, fmt.Errorf("invalid policyDecision")
		}
	}

	categories := readQueryValues(c, "category")
	for _, value := range categories {
		if err := validateFindingCategory(value); err != nil {
			return nil, err
		}
	}

	params := &FindingFilterParams{
		Severities:       severities,
		Statuses:         statuses,
		RiskBands:        riskBands,
		OccurrenceStatus: readQueryValues(c, "occurrenceStatus"),
		ScannerTypes:     readQueryValues(c, "scannerType"),
		Categories:       categories,
		SourceType:       strings.TrimSpace(c.Query("sourceType")),
		Query:            firstNonEmpty(strings.TrimSpace(c.Query("search")), strings.TrimSpace(c.Query("q"))),
		CanonicalOnly:    parseBoolWithDefault(c.Query("canonicalOnly"), true),
		IncludeRepeats:   parseBoolWithDefault(c.Query("includeRepeats"), false),
		SortField:        strings.TrimSpace(c.Query("sortField")),
		SortOrder:        strings.TrimSpace(c.Query("sortOrder")),
		PolicyDecisions:  policyDecisions,
	}

	if raw := strings.TrimSpace(c.Query("tenantId")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("invalid tenantId")
		}
		params.TenantID = &parsed
	}

	// Default tenant scoping:
	// - prefer explicit tenantId query param
	// - fallback to tenant from JWT middleware context
	// - as a last resort (single-tenant MVP) use uuid.Nil
	if params.TenantID == nil {
		if tid := tenantIDFromContext(c); tid != nil {
			params.TenantID = tid
		} else {
			zero := uuid.Nil
			params.TenantID = &zero
		}
	}

	// Resolve product filter
	productIDValues := readQueryValues(c, "productId")
	productValues := readQueryValues(c, "product")
	productIDs, err := resolveProductFilters(c.Context(), db, productIDValues, productValues)
	if err != nil {
		return nil, err
	}
	params.ProductIDs = productIDs

	// Parse import job ID
	if importJobParam := strings.TrimSpace(c.Query("import_job_id")); importJobParam != "" {
		parsed, err := uuid.Parse(importJobParam)
		if err != nil {
			return nil, fmt.Errorf("invalid import_job_id")
		}
		params.ImportJobID = &parsed
	}

	if policyIDRaw := strings.TrimSpace(c.Query("policyId")); policyIDRaw != "" {
		parsed, err := uuid.Parse(policyIDRaw)
		if err != nil {
			return nil, fmt.Errorf("invalid policyId")
		}
		params.PolicyID = &parsed
	}

	// Parse date range
	if raw := strings.TrimSpace(c.Query("dateFrom")); raw != "" {
		parsed, err := parseDateParam(raw, false)
		if err != nil {
			return nil, err
		}
		params.DateFrom = parsed
	}
	if raw := strings.TrimSpace(c.Query("dateTo")); raw != "" {
		parsed, err := parseDateParam(raw, true)
		if err != nil {
			return nil, err
		}
		params.DateTo = parsed
	}

	return params, nil
}

// toStorageFilters converts FindingFilterParams to storage.FindingFilters
func (p *FindingFilterParams) toStorageFilters(limit, offset int) storage.FindingFilters {
	return storage.FindingFilters{
		TenantID:         p.TenantID,
		Severities:       p.Severities,
		Statuses:         p.Statuses,
		RiskBands:        p.RiskBands,
		OccurrenceStatus: p.OccurrenceStatus,
		ScannerTypes:     p.ScannerTypes,
		Categories:       p.Categories,
		SourceType:       p.SourceType,
		ProductIDs:       p.ProductIDs,
		ImportJobID:      p.ImportJobID,
		PolicyID:         p.PolicyID,
		PolicyDecisions:  p.PolicyDecisions,
		Query:            p.Query,
		DateFrom:         p.DateFrom,
		DateTo:           p.DateTo,
		CanonicalOnly:    p.CanonicalOnly,
		IncludeRepeats:   p.IncludeRepeats,
		SortField:        p.SortField,
		SortOrder:        p.SortOrder,
		Limit:            limit,
		Offset:           offset,
	}
}

// toStorageFiltersWithoutPagination converts FindingFilterParams to storage.FindingFilters without pagination
func (p *FindingFilterParams) toStorageFiltersWithoutPagination() storage.FindingFilters {
	return p.toStorageFilters(0, 0)
}

func isValidPolicyDecision(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "pass", "fail", "warn":
		return true
	default:
		return false
	}
}

// parsePagination parses pagination parameters from query string
// Returns limit, offset, and an error response if validation fails
func parsePagination(c *fiber.Ctx) (int, int, error) {
	limit := parseIntWithDefault(c.Query("limit"), 20)
	offset := parseIntWithDefault(c.Query("offset"), 0)

	if limit < 1 || limit > 200 || offset < 0 {
		page := parseIntWithDefault(c.Query("page"), 1)
		pageSize := parseIntWithDefault(c.Query("pageSize"), 20)
		if page < 1 || pageSize < 1 || pageSize > 200 {
			return 0, 0, fmt.Errorf("invalid pagination")
		}
		limit = pageSize
		offset = (page - 1) * pageSize
	}

	return limit, offset, nil
}

// parseBulkFilters converts BulkActionFilters to storage.FindingFilters with validation
func parseBulkFilters(c *fiber.Ctx, db *sql.DB, filterInput *BulkActionFilters) (storage.FindingFilters, error) {
	filters := storage.FindingFilters{
		CanonicalOnly:  true,
		IncludeRepeats: false,
	}

	// Bulk actions must always be tenant-scoped.
	// We intentionally do NOT allow running bulk actions without an effective tenant.
	if tid := tenantIDFromContext(c); tid != nil {
		filters.TenantID = tid
	} else {
		zero := uuid.Nil
		filters.TenantID = &zero
	}

	if filterInput == nil {
		return filters, nil
	}

	if filterInput.TenantID != nil && strings.TrimSpace(*filterInput.TenantID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*filterInput.TenantID))
		if err != nil {
			return filters, fmt.Errorf("invalid tenantId")
		}
		filters.TenantID = &parsed
	}

	var productIDParam []string
	var productParam []string
	if filterInput.ProductID != nil {
		productIDParam = []string{strings.TrimSpace(*filterInput.ProductID)}
	}
	if filterInput.Product != nil {
		productParam = []string{strings.TrimSpace(*filterInput.Product)}
	}

	filters.Severities = toOptionalSlice(filterInput.Severity)
	filters.Statuses = toOptionalSlice(filterInput.Status)
	filters.OccurrenceStatus = toOptionalSlice(filterInput.OccurrenceStatus)
	filters.ScannerTypes = toOptionalSlice(filterInput.ScannerType)
	filters.SourceType = strings.TrimSpace(filterInput.SourceType)
	filters.Query = strings.TrimSpace(filterInput.Query)
	filters.PolicyDecisions = nil
	filters.RiskBands = nil
	filters.Categories = nil

	if filterInput.DateFrom != nil && strings.TrimSpace(*filterInput.DateFrom) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*filterInput.DateFrom))
		if err != nil {
			return filters, fmt.Errorf("invalid dateFrom")
		}
		filters.DateFrom = &parsed
	}

	if filterInput.DateTo != nil && strings.TrimSpace(*filterInput.DateTo) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*filterInput.DateTo))
		if err != nil {
			return filters, fmt.Errorf("invalid dateTo")
		}
		filters.DateTo = &parsed
	}

	if filterInput.CanonicalOnly != nil {
		filters.CanonicalOnly = *filterInput.CanonicalOnly
	}
	if filterInput.IncludeRepeats != nil {
		filters.IncludeRepeats = *filterInput.IncludeRepeats
	}

	productIDs, err := resolveProductFilters(c.Context(), db, productIDParam, productParam)
	if err != nil {
		return filters, err
	}
	filters.ProductIDs = productIDs

	if filterInput.ImportJobID != nil && strings.TrimSpace(*filterInput.ImportJobID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*filterInput.ImportJobID))
		if err != nil {
			return filters, fmt.Errorf("invalid import_job_id")
		}
		filters.ImportJobID = &parsed
	}

	return filters, nil
}

// respondWithFilterError sends a standardized filter error response
func respondWithFilterError(c *fiber.Ctx, err error) error {
	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
}
