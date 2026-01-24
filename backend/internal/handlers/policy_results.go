package handlers

import (
	"bufio"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	v1dto "lotus-warden/backend/internal/dto/v1"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PolicyResultsHandler struct {
	db *sql.DB
}

const maxPolicyResultsExportLimit = 20000

func NewPolicyResultsHandler(db *sql.DB) *PolicyResultsHandler {
	return &PolicyResultsHandler{db: db}
}

func (h *PolicyResultsHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), 50)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	filters := storage.PolicyResultFilters{
		Limit:    limit,
		Offset:   offset,
		Decision: strings.TrimSpace(c.Query("decision")),
		TenantID: tenantIDFromContext(c),
	}

	if filters.Decision != "" && !isValidPolicyDecision(filters.Decision) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid decision"})
	}

	if policyIDRaw := strings.TrimSpace(c.Query("policyId")); policyIDRaw != "" {
		parsed, err := uuid.Parse(policyIDRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policyId"})
		}
		filters.PolicyID = &parsed
	}

	if productRaw := strings.TrimSpace(c.Query("productId")); productRaw != "" {
		parsed, err := uuid.Parse(productRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
		}
		filters.ProductID = &parsed
	}

	if importJobRaw := strings.TrimSpace(c.Query("importJobId")); importJobRaw != "" {
		parsed, err := uuid.Parse(importJobRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid importJobId"})
		}
		filters.ImportJobID = &parsed
	}

	if fromRaw := strings.TrimSpace(c.Query("from")); fromRaw != "" {
		parsed, err := time.Parse(time.RFC3339, fromRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid from timestamp"})
		}
		filters.From = &parsed
	}
	if toRaw := strings.TrimSpace(c.Query("to")); toRaw != "" {
		parsed, err := time.Parse(time.RFC3339, toRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid to timestamp"})
		}
		filters.To = &parsed
	}

	results, total, err := storage.ListPolicyResults(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy results"})
	}

	response := make([]v1dto.PolicyResultDTO, 0, len(results))
	for _, item := range results {
		response = append(response, mapPolicyResult(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *PolicyResultsHandler) Get(c *fiber.Ctx) error {
	resultID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy result id"})
	}

	result, err := storage.GetPolicyResultByID(c.Context(), h.db, resultID, tenantIDFromContext(c))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy result"})
	}
	if result == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy result not found"})
	}

	response := mapPolicyResultDetail(*result)

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

func (h *PolicyResultsHandler) Export(c *fiber.Ctx) error {
	format := strings.ToLower(strings.TrimSpace(c.Query("format")))
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "json" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid format"})
	}

	limit := parseIntWithDefault(c.Query("limit"), 5000)
	if limit < 1 || limit > maxPolicyResultsExportLimit {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid limit"})
	}

	filters := storage.PolicyResultsExportFilters{
		Decision: strings.TrimSpace(c.Query("decision")),
		Limit:    limit,
		TenantID: tenantIDFromContext(c),
	}

	if filters.Decision != "" && !isValidPolicyDecision(filters.Decision) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid decision"})
	}

	if policyIDRaw := strings.TrimSpace(c.Query("policyId")); policyIDRaw != "" {
		parsed, err := uuid.Parse(policyIDRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policyId"})
		}
		filters.PolicyID = &parsed
	}

	if productRaw := strings.TrimSpace(c.Query("productId")); productRaw != "" {
		parsed, err := uuid.Parse(productRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid productId"})
		}
		filters.ProductID = &parsed
	}

	if importJobRaw := strings.TrimSpace(c.Query("importJobId")); importJobRaw != "" {
		parsed, err := uuid.Parse(importJobRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid importJobId"})
		}
		filters.ImportJobID = &parsed
	}

	if fromRaw := strings.TrimSpace(c.Query("from")); fromRaw != "" {
		parsed, err := time.Parse(time.RFC3339, fromRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid from timestamp"})
		}
		filters.From = &parsed
	}
	if toRaw := strings.TrimSpace(c.Query("to")); toRaw != "" {
		parsed, err := time.Parse(time.RFC3339, toRaw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid to timestamp"})
		}
		filters.To = &parsed
	}

	rows, err := storage.QueryPolicyResultsExport(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to export policy results"})
	}
	defer rows.Close()

	filename := "policy-results." + format
	c.Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	if format == "json" {
		c.Set("Content-Type", "application/x-ndjson")
		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			encoder := json.NewEncoder(w)
			for rows.Next() {
				var evaluatedAt time.Time
				var policyID uuid.UUID
				var policyVersion sql.NullString
				var subjectType string
				var subjectID uuid.UUID
				var decision string
				var violationsRaw []byte
				if err := rows.Scan(
					&evaluatedAt,
					&policyID,
					&policyVersion,
					&subjectType,
					&subjectID,
					&decision,
					&violationsRaw,
				); err != nil {
					return
				}
				record := map[string]interface{}{
					"evaluatedAt":        evaluatedAt.Format(time.RFC3339),
					"policyId":           policyID.String(),
					"policyVersion":      nullStringValue(policyVersion),
					"subjectType":        subjectType,
					"subjectId":          subjectID.String(),
					"decision":           decision,
					"violationCodes":     extractViolationCodes(violationsRaw),
					"blockingFindingIds": []string{},
				}
				_ = encoder.Encode(record)
			}
		})
		return nil
	}

	c.Set("Content-Type", "text/csv")
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		writer := csv.NewWriter(w)
		_ = writer.Write([]string{
			"evaluatedAt",
			"policyId",
			"policyVersion",
			"subjectType",
			"subjectId",
			"decision",
			"violationCodes",
			"blockingFindingIds",
		})
		for rows.Next() {
			var evaluatedAt time.Time
			var policyID uuid.UUID
			var policyVersion sql.NullString
			var subjectType string
			var subjectID uuid.UUID
			var decision string
			var violationsRaw []byte
			if err := rows.Scan(
				&evaluatedAt,
				&policyID,
				&policyVersion,
				&subjectType,
				&subjectID,
				&decision,
				&violationsRaw,
			); err != nil {
				return
			}
			_ = writer.Write([]string{
				evaluatedAt.Format(time.RFC3339),
				policyID.String(),
				nullStringValue(policyVersion),
				subjectType,
				subjectID.String(),
				decision,
				strings.Join(extractViolationCodes(violationsRaw), "|"),
				"",
			})
			writer.Flush()
		}
		writer.Flush()
	})

	return nil
}

func mapPolicyResult(result storage.PolicyResultItem) v1dto.PolicyResultDTO {
	var ruleID *string
	if result.PolicyRuleID.Valid {
		value := result.PolicyRuleID.UUID.String()
		ruleID = &value
	}
	var version *string
	if result.PolicyVersion.Valid {
		value := result.PolicyVersion.String
		version = &value
	}

	return v1dto.PolicyResultDTO{
		ID:            result.ID.String(),
		PolicyID:      result.PolicyID.String(),
		PolicyRuleID:  ruleID,
		SubjectType:   result.SubjectType,
		SubjectID:     result.SubjectID.String(),
		Decision:      result.Decision,
		Violations:    result.Violations,
		InputHash:     result.InputHash,
		EvaluatedAt:   result.EvaluatedAt.Format(time.RFC3339),
		PolicyVersion: version,
	}
}

func mapPolicyResultDetail(result storage.PolicyResultDetail) v1dto.PolicyResultDetailDTO {
	base := mapPolicyResult(result.PolicyResultItem)

	var policyName *string
	if result.PolicyName.Valid {
		value := result.PolicyName.String
		policyName = &value
	}
	var policyKind *string
	if result.PolicyKind.Valid {
		value := result.PolicyKind.String
		policyKind = &value
	}
	var ruleFormat *string
	if result.RuleFormat.Valid {
		value := result.RuleFormat.String
		ruleFormat = &value
	}
	var entrypoint *string
	if result.RuleEntrypoint.Valid {
		value := result.RuleEntrypoint.String
		entrypoint = &value
	}

	return v1dto.PolicyResultDetailDTO{
		PolicyResultDTO: base,
		PolicyName:      policyName,
		PolicyKind:      policyKind,
		RuleFormat:      ruleFormat,
		RuleEntrypoint:  entrypoint,
		Actions:         []map[string]interface{}{},
	}
}

func extractViolationCodes(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var violations []struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(raw, &violations); err != nil {
		return []string{}
	}
	codes := make([]string, 0, len(violations))
	for _, violation := range violations {
		if strings.TrimSpace(violation.Code) != "" {
			codes = append(codes, violation.Code)
		}
	}
	return codes
}

func nullStringValue(value sql.NullString) string {
	if value.Valid {
		return value.String
	}
	return ""
}
