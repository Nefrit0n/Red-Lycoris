package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// FindingFilterParams holds common filter parameters parsed from query string
type FindingFilterParams struct {
	ProductID        *uuid.UUID
	ImportJobID      *uuid.UUID
	DateFrom         *time.Time
	DateTo           *time.Time
	Severity         string
	Status           string
	OccurrenceStatus string
	ScannerType      string
	Query            string
	CanonicalOnly    bool
	IncludeRepeats   bool
	SortField        string
	SortOrder        string
}

// parseFindingFiltersFromQuery parses common finding filters from fiber context query params
// This eliminates duplication between List() and Neighbors() handlers
func parseFindingFiltersFromQuery(c *fiber.Ctx, db *sql.DB) (*FindingFilterParams, error) {
	params := &FindingFilterParams{
		Severity:         strings.TrimSpace(c.Query("severity")),
		Status:           strings.TrimSpace(c.Query("status")),
		OccurrenceStatus: strings.TrimSpace(c.Query("occurrenceStatus")),
		ScannerType:      strings.TrimSpace(c.Query("scannerType")),
		Query:            firstNonEmpty(strings.TrimSpace(c.Query("search")), strings.TrimSpace(c.Query("q"))),
		CanonicalOnly:    parseBoolWithDefault(c.Query("canonicalOnly"), true),
		IncludeRepeats:   parseBoolWithDefault(c.Query("includeRepeats"), false),
		SortField:        strings.TrimSpace(c.Query("sortField")),
		SortOrder:        strings.TrimSpace(c.Query("sortOrder")),
	}

	// Resolve product filter
	productID, err := resolveProductFilter(
		c.Context(),
		db,
		strings.TrimSpace(c.Query("productId")),
		strings.TrimSpace(c.Query("product")),
	)
	if err != nil {
		return nil, err
	}
	params.ProductID = productID

	// Parse import job ID
	if importJobParam := strings.TrimSpace(c.Query("import_job_id")); importJobParam != "" {
		parsed, err := uuid.Parse(importJobParam)
		if err != nil {
			return nil, fmt.Errorf("invalid import_job_id")
		}
		params.ImportJobID = &parsed
	}

	// Parse date range
	if raw := strings.TrimSpace(c.Query("dateFrom")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, fmt.Errorf("invalid dateFrom")
		}
		params.DateFrom = &parsed
	}
	if raw := strings.TrimSpace(c.Query("dateTo")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, fmt.Errorf("invalid dateTo")
		}
		params.DateTo = &parsed
	}

	return params, nil
}

// toStorageFilters converts FindingFilterParams to storage.FindingFilters
func (p *FindingFilterParams) toStorageFilters(limit, offset int) storage.FindingFilters {
	return storage.FindingFilters{
		Severity:         p.Severity,
		Status:           p.Status,
		OccurrenceStatus: p.OccurrenceStatus,
		ScannerType:      p.ScannerType,
		ProductID:        p.ProductID,
		ImportJobID:      p.ImportJobID,
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

	if filterInput == nil {
		return filters, nil
	}

	var productIDParam string
	var productParam string
	if filterInput.ProductID != nil {
		productIDParam = strings.TrimSpace(*filterInput.ProductID)
	}
	if filterInput.Product != nil {
		productParam = strings.TrimSpace(*filterInput.Product)
	}

	filters.Severity = strings.TrimSpace(filterInput.Severity)
	filters.Status = strings.TrimSpace(filterInput.Status)
	filters.OccurrenceStatus = strings.TrimSpace(filterInput.OccurrenceStatus)
	filters.ScannerType = strings.TrimSpace(filterInput.ScannerType)
	filters.Query = strings.TrimSpace(filterInput.Query)

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

	productID, err := resolveProductFilter(c.Context(), db, productIDParam, productParam)
	if err != nil {
		return filters, err
	}
	filters.ProductID = productID

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
