package handlers

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
)

const (
	defaultFindingsExportLimit = 10000
	maxFindingsExportLimit     = 20000
)

type findingExportRow struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Severity       string     `json:"severity"`
	Status         string     `json:"status"`
	Category       string     `json:"category"`
	ProductID      *string    `json:"productId,omitempty"`
	ProductName    *string    `json:"productName,omitempty"`
	ScannerType    *string    `json:"scannerType,omitempty"`
	SourceType     *string    `json:"sourceType,omitempty"`
	ImportJobID    *string    `json:"importJobId,omitempty"`
	PolicyDecision *string    `json:"policyDecision,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	FirstSeenAt    *time.Time `json:"firstSeenAt,omitempty"`
	LastSeenAt     *time.Time `json:"lastSeenAt,omitempty"`
	RepeatCount    int        `json:"repeatCount"`
	SLADueAt       *time.Time `json:"slaDueAt,omitempty"`
	SLABreached    *bool      `json:"slaBreached,omitempty"`
	SLABreachedAt  *time.Time `json:"slaBreachedAt,omitempty"`
	RiskScore      *float64   `json:"riskScore,omitempty"`
	RiskBand       *string    `json:"riskBand,omitempty"`
	RiskUpdatedAt  *time.Time `json:"riskUpdatedAt,omitempty"`
	RiskModel      *string    `json:"riskModel,omitempty"`
	CVSSScore      *float64   `json:"cvssScore,omitempty"`
	EPSSScore      *float64   `json:"epssScore,omitempty"`
	KEV            *bool      `json:"kev,omitempty"`
}

// Export streams findings as CSV or JSON using current filters.
//
// GET /api/v1/findings/export?format=csv|json&limit=10000&offset=0&...
//
// Notes:
// - limit defaults to 10k, max 20k to prevent accidental huge exports.
// - format=json returns a standard JSON array (not NDJSON) for compatibility.
func (h *FindingsHandler) Export(c *fiber.Ctx) error {
	format := strings.ToLower(strings.TrimSpace(c.Query("format")))
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "json" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid format"})
	}

	limit := parseIntWithDefault(strings.TrimSpace(c.Query("limit")), defaultFindingsExportLimit)
	offset := parseIntWithDefault(strings.TrimSpace(c.Query("offset")), 0)
	if limit < 1 || limit > maxFindingsExportLimit || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid limit/offset"})
	}

	filterParams, err := parseFindingFiltersFromQuery(c, h.db)
	if err != nil {
		return respondWithFilterError(c, err)
	}

	filters := filterParams.toStorageFilters(limit, offset)
	rows, err := storage.QueryFindingsExport(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to export findings"})
	}
	defer rows.Close()

	stamp := time.Now().UTC().Format("2006-01-02")
	baseName := "findings_" + stamp

	switch format {
	case "csv":
		c.Set("Content-Type", "text/csv; charset=utf-8")
		c.Set("Content-Disposition", "attachment; filename=\""+baseName+".csv\"")

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			csvw := csv.NewWriter(w)
			_ = csvw.Write([]string{
				"id",
				"title",
				"severity",
				"status",
				"category",
				"product_id",
				"product_name",
				"scanner_type",
				"source_type",
				"import_job_id",
				"policy_decision",
				"created_at",
				"updated_at",
				"first_seen_at",
				"last_seen_at",
				"repeat_count",
				"sla_due_at",
				"sla_breached",
				"sla_breached_at",
				"risk_score",
				"risk_band",
				"risk_updated_at",
				"risk_model",
				"cvss_score",
				"epss_score",
				"kev",
			})

			for rows.Next() {
				row, ok := scanFindingExportRow(rows)
				if !ok {
					break
				}
				_ = csvw.Write([]string{
					row.ID,
					row.Title,
					row.Severity,
					row.Status,
					row.Category,
					nullableString(row.ProductID),
					nullableString(row.ProductName),
					nullableString(row.ScannerType),
					nullableString(row.SourceType),
					nullableString(row.ImportJobID),
					nullableString(row.PolicyDecision),
					row.CreatedAt.UTC().Format(time.RFC3339),
					row.UpdatedAt.UTC().Format(time.RFC3339),
					nullableTime(row.FirstSeenAt),
					nullableTime(row.LastSeenAt),
					strconv.Itoa(row.RepeatCount),
					nullableTime(row.SLADueAt),
					nullableBool(row.SLABreached),
					nullableTime(row.SLABreachedAt),
					nullableFloat(row.RiskScore),
					nullableString(row.RiskBand),
					nullableTime(row.RiskUpdatedAt),
					nullableString(row.RiskModel),
					nullableFloat(row.CVSSScore),
					nullableFloat(row.EPSSScore),
					nullableBool(row.KEV),
				})
			}
			csvw.Flush()
			_ = w.Flush()
		})

		return nil

	case "json":
		c.Set("Content-Type", "application/json; charset=utf-8")
		c.Set("Content-Disposition", "attachment; filename=\""+baseName+".json\"")

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			_, _ = w.WriteString("[")
			first := true
			for rows.Next() {
				row, ok := scanFindingExportRow(rows)
				if !ok {
					break
				}
				b, err := json.Marshal(row)
				if err != nil {
					break
				}
				if !first {
					_, _ = w.WriteString(",")
				}
				first = false
				_, _ = w.Write(b)
			}
			_, _ = w.WriteString("]")
			_ = w.Flush()
		})

		return nil
	}

	return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid format"})
}

func nullableString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func nullableTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func nullableBool(v *bool) string {
	if v == nil {
		return ""
	}
	if *v {
		return "true"
	}
	return "false"
}

func nullableFloat(v *float64) string {
	if v == nil {
		return ""
	}
	// keep it human-friendly but deterministic
	return strconv.FormatFloat(*v, 'f', -1, 64)
}

func scanFindingExportRow(scanner interface{ Scan(dest ...any) error }) (*findingExportRow, bool) {
	var (
		id            string
		title         string
		severity      string
		status        string
		category      string
		productID     *string
		productName   *string
		scannerType   *string
		sourceType    *string
		importJobID   *string
		policyDec     *string
		createdAt     time.Time
		updatedAt     time.Time
		firstSeenAt   *time.Time
		lastSeenAt    *time.Time
		repeatCount   int
		slaDueAt      *time.Time
		slaBreached   *bool
		slaBreachedAt *time.Time
		riskScore     *float64
		riskBand      *string
		riskUpdatedAt *time.Time
		riskModel     *string
		cvssScore     *float64
		epssScore     *float64
		kev           *bool
	)

	if err := scanner.Scan(
		&id,
		&title,
		&severity,
		&status,
		&category,
		&productID,
		&productName,
		&scannerType,
		&sourceType,
		&importJobID,
		&policyDec,
		&createdAt,
		&updatedAt,
		&firstSeenAt,
		&lastSeenAt,
		&repeatCount,
		&slaDueAt,
		&slaBreached,
		&slaBreachedAt,
		&riskScore,
		&riskBand,
		&riskUpdatedAt,
		&riskModel,
		&cvssScore,
		&epssScore,
		&kev,
	); err != nil {
		return nil, false
	}

	return &findingExportRow{
		ID:             id,
		Title:          title,
		Severity:       severity,
		Status:         status,
		Category:       category,
		ProductID:      productID,
		ProductName:    productName,
		ScannerType:    scannerType,
		SourceType:     sourceType,
		ImportJobID:    importJobID,
		PolicyDecision: policyDec,
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
		FirstSeenAt:    firstSeenAt,
		LastSeenAt:     lastSeenAt,
		RepeatCount:    repeatCount,
		SLADueAt:       slaDueAt,
		SLABreached:    slaBreached,
		SLABreachedAt:  slaBreachedAt,
		RiskScore:      riskScore,
		RiskBand:       riskBand,
		RiskUpdatedAt:  riskUpdatedAt,
		RiskModel:      riskModel,
		CVSSScore:      cvssScore,
		EPSSScore:      epssScore,
		KEV:            kev,
	}, true
}
