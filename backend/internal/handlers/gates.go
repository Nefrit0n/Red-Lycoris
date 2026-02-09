package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"time"

	v1dto "red-lycoris/backend/internal/dto/v1"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/policies"
	"red-lycoris/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const defaultGateSeverityThreshold = models.SeverityHigh

type GateCheckHandler struct {
	db           *sql.DB
	validator    *validator.Validate
	policyEngine policies.Evaluator
}

type GateCheckRequest struct {
	ImportJobID string  `json:"importJobId" validate:"required,uuid4"`
	ProductID   *string `json:"productId,omitempty" validate:"omitempty,uuid4"`
	Profile     *string `json:"profile,omitempty" validate:"omitempty,max=100"`
	CommitSha   *string `json:"commitSha,omitempty" validate:"omitempty,max=64"`
	BuildID     *string `json:"buildId,omitempty" validate:"omitempty,max=100"`
}

func NewGateCheckHandler(db *sql.DB, policyEngine policies.Evaluator) *GateCheckHandler {
	return &GateCheckHandler{db: db, validator: validator.New(), policyEngine: policyEngine}
}

// Check performs a policy gate check for an import job.
// @Summary Gate check for an import job
// @Description Evaluate policies for an import job gate check.
// @Tags gates
// @Accept json
// @Produce json
// @Param request body GateCheckRequest true "Gate check request"
// @Success 200 {object} v1.GateCheckResponseDTO
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 412 {object} v1.GateCheckResponseDTO
// @Router /api/v1/gates/check [post]
func (h *GateCheckHandler) Check(c *fiber.Ctx) error {
	var req GateCheckRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	importJobID, err := uuid.Parse(req.ImportJobID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid importJobId"})
	}

	job, err := storage.GetImportJobByID(c.Context(), h.db, importJobID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch import job"})
	}
	if job == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "import job not found"})
	}

	var productID *uuid.UUID
	if req.ProductID != nil && strings.TrimSpace(*req.ProductID) != "" {
		parsed, err := uuid.Parse(*req.ProductID)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid productId"})
		}
		productID = &parsed
	} else if job.ProductID.Valid {
		value := job.ProductID.UUID
		productID = &value
	}

	severityCounts, err := storage.CountFindingsBySeverity(c.Context(), h.db, storage.FindingFilters{
		ImportJobID:    &importJobID,
		CanonicalOnly:  true,
		IncludeRepeats: false,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to compute severity counts"})
	}
	categoryCounts, err := countFindingsByCategory(c.Context(), h.db, storage.FindingFilters{
		ImportJobID:    &importJobID,
		CanonicalOnly:  true,
		IncludeRepeats: false,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to compute category counts"})
	}

	event := policies.Event{
		Type:  "gate_check",
		Actor: buildPolicyActor(userIDFromContext(c)),
	}
	if req.Profile != nil && strings.TrimSpace(*req.Profile) != "" {
		event.Profile = req.Profile
	}
	if req.CommitSha != nil && strings.TrimSpace(*req.CommitSha) != "" {
		event.CommitSha = req.CommitSha
	}
	if req.BuildID != nil && strings.TrimSpace(*req.BuildID) != "" {
		event.BuildID = req.BuildID
	}

	policyCtx := policies.Context{
		Subject: policies.Subject{
			Type: "import_job",
			ID:   job.ID.String(),
		},
		Event: event,
		ImportJob: &policies.ImportJob{
			ID:              job.ID.String(),
			Scanner:         job.Scanner,
			Status:          job.Status,
			FindingsTotal:   job.FindingsTotal,
			FindingsNew:     job.FindingsNew,
			DuplicatesTotal: job.DuplicatesTotal,
			CreatedAt:       job.CreatedAt.Format(time.RFC3339),
			SeverityCounts:  buildPolicySeverityCounts(convertSeverityCounts(severityCounts)),
			CategoryCounts:  buildPolicyCategoryCounts(categoryCounts),
		},
	}
	if job.StartedAt.Valid {
		value := job.StartedAt.Time.Format(time.RFC3339)
		policyCtx.ImportJob.StartedAt = &value
	}
	if job.FinishedAt.Valid {
		value := job.FinishedAt.Time.Format(time.RFC3339)
		policyCtx.ImportJob.FinishedAt = &value
	}
	if productID != nil {
		policyCtx.Product = &policies.Product{ID: productID.String()}
	}

	decision, err := h.policyEngine.Evaluate(policyCtx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "policy evaluation failed"})
	}

	decisionOutcome := normalizeOutcome(decision.Outcome)
	if policyHasAction(decision, "gate_fail") {
		decisionOutcome = policies.OutcomeFail
	}
	pass := decisionOutcome != policies.OutcomeFail

	violations := make([]v1dto.GateCheckViolationDTO, 0, len(decision.Violations))
	for _, violation := range decision.Violations {
		violations = append(violations, v1dto.GateCheckViolationDTO{
			Code:     violation.Code,
			Message:  violation.Message,
			Severity: violation.Severity,
			Refs:     violation.Refs,
		})
	}

	blockingFindings, err := h.resolveBlockingFindings(c, decision.Violations, importJobID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve blocking findings"})
	}

	var policyMeta *v1dto.GateCheckPolicyDTO
	if decision.Policy != nil {
		version := decision.Policy.PolicyVersion
		sha := decision.Policy.Sha256
		policyMeta = &v1dto.GateCheckPolicyDTO{
			PolicyID:     &decision.Policy.PolicyID,
			PolicyRuleID: decision.Policy.PolicyRuleID,
			Version:      &version,
			Sha256:       &sha,
		}
	}

	response := v1dto.GateCheckResponseDTO{
		Pass:             pass,
		Decision:         decisionOutcome,
		BlockingFindings: blockingFindings,
		Violations:       violations,
		Policy:           policyMeta,
		EvaluatedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	if !pass {
		return c.Status(http.StatusPreconditionFailed).JSON(response)
	}
	return c.Status(http.StatusOK).JSON(response)
}

func (h *GateCheckHandler) resolveBlockingFindings(c *fiber.Ctx, violations []policies.Violation, importJobID uuid.UUID) ([]v1dto.GateBlockingFindingDTO, error) {
	linked := map[uuid.UUID]policies.Violation{}
	for _, violation := range violations {
		for _, ref := range violation.Refs {
			for _, id := range extractFindingIDs(ref) {
				if _, exists := linked[id]; !exists {
					linked[id] = violation
				}
			}
		}
	}

	if len(linked) > 0 {
		results := make([]v1dto.GateBlockingFindingDTO, 0, len(linked))
		for id, violation := range linked {
			finding, err := storage.GetFindingByID(c.Context(), h.db, id)
			if err != nil {
				return nil, err
			}
			if finding == nil {
				continue
			}
			results = append(results, v1dto.GateBlockingFindingDTO{
				FindingID:     finding.ID.String(),
				Title:         finding.Title,
				Severity:      finding.Severity,
				Category:      finding.Category,
				ViolationCode: violation.Code,
			})
		}
		return results, nil
	}

	minRank := severityRank(defaultGateSeverityThreshold)
	findings, err := storage.ListBlockingFindingsByImportJob(c.Context(), h.db, importJobID, minRank)
	if err != nil {
		return nil, err
	}

	results := make([]v1dto.GateBlockingFindingDTO, 0, len(findings))
	for _, finding := range findings {
		results = append(results, v1dto.GateBlockingFindingDTO{
			FindingID:     finding.ID.String(),
			Title:         finding.Title,
			Severity:      finding.Severity,
			Category:      finding.Category,
			ViolationCode: "severity_threshold",
		})
	}
	return results, nil
}

func convertSeverityCounts(counts map[string]int) storage.SeverityCounts {
	out := storage.SeverityCounts{}
	v := reflect.ValueOf(&out).Elem()

	setIntField := func(field string, val int) {
		f := v.FieldByName(field)
		if !f.IsValid() || !f.CanSet() {
			return
		}
		switch f.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			f.SetInt(int64(val))
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			if val < 0 {
				return
			}
			f.SetUint(uint64(val))
		}
	}

	for k, val := range counts {
		switch strings.ToLower(strings.TrimSpace(k)) {
		case "critical":
			setIntField("Critical", val)
		case "high":
			setIntField("High", val)
		case "medium":
			setIntField("Medium", val)
		case "low":
			setIntField("Low", val)
		case "info", "informational":
			setIntField("Info", val)
		case "unknown":
			setIntField("Unknown", val)
		}
	}

	return out
}

func countFindingsByCategory(ctx context.Context, db *sql.DB, filters storage.FindingFilters) ([]storage.CategoryCount, error) {
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	argN := 1

	if filters.ImportJobID != nil {
		where = append(where, fmt.Sprintf("import_job_id = $%d", argN))
		args = append(args, *filters.ImportJobID)
		argN++
	}
	if filters.CanonicalOnly {
		// Канонические = не дубликаты.
		where = append(where, "duplicate_id IS NULL")
	}

	var queryBuilder strings.Builder
	queryBuilder.WriteString(`SELECT category, COUNT(*)
			FROM findings
			WHERE `)
	queryBuilder.WriteString(strings.Join(where, " AND "))
	queryBuilder.WriteString(`
			GROUP BY category`)
	query := queryBuilder.String()

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []storage.CategoryCount{}
	for rows.Next() {
		var entry storage.CategoryCount
		if err := rows.Scan(&entry.Category, &entry.Count); err != nil {
			return nil, err
		}
		res = append(res, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

func buildPolicySeverityCounts(counts storage.SeverityCounts) []policies.SeverityCount {
	results := []policies.SeverityCount{}
	if counts.Critical > 0 {
		results = append(results, policies.SeverityCount{Severity: "CRITICAL", Count: counts.Critical})
	}
	if counts.High > 0 {
		results = append(results, policies.SeverityCount{Severity: "HIGH", Count: counts.High})
	}
	if counts.Medium > 0 {
		results = append(results, policies.SeverityCount{Severity: "MEDIUM", Count: counts.Medium})
	}
	if counts.Low > 0 {
		results = append(results, policies.SeverityCount{Severity: "LOW", Count: counts.Low})
	}
	if counts.Info > 0 {
		results = append(results, policies.SeverityCount{Severity: "INFO", Count: counts.Info})
	}
	return results
}

func buildPolicyCategoryCounts(counts []storage.CategoryCount) []policies.CategoryCount {
	results := make([]policies.CategoryCount, 0, len(counts))
	for _, entry := range counts {
		results = append(results, policies.CategoryCount{Category: entry.Category, Count: entry.Count})
	}
	return results
}

func severityRank(severity string) int {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

var findingIDRegex = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

func extractFindingIDs(ref string) []uuid.UUID {
	matches := findingIDRegex.FindAllString(ref, -1)
	if len(matches) == 0 {
		return nil
	}
	results := []uuid.UUID{}
	for _, match := range matches {
		if id, err := uuid.Parse(match); err == nil {
			results = append(results, id)
		}
	}
	return results
}

func normalizeOutcome(outcome string) string {
	switch strings.ToLower(strings.TrimSpace(outcome)) {
	case policies.OutcomeFail:
		return policies.OutcomeFail
	case policies.OutcomeWarn:
		return policies.OutcomeWarn
	default:
		return policies.OutcomePass
	}
}

func buildPolicyActor(actorID *uuid.UUID) *policies.Actor {
	if actorID == nil {
		return nil
	}
	return &policies.Actor{Type: "user", ID: actorID.String()}
}
