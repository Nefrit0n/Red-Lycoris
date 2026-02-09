package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	v1dto "red-lycoris/backend/internal/dto/v1"
	"red-lycoris/backend/internal/storage"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PoliciesHandler struct {
	db        *sql.DB
	validator *validator.Validate
}

type CreatePolicyRequest struct {
	Name        string          `json:"name" validate:"required,max=200"`
	Kind        string          `json:"kind" validate:"required"`
	Status      *string         `json:"status,omitempty"`
	Description *string         `json:"description,omitempty" validate:"omitempty,max=2000"`
	Rule        PolicyRuleInput `json:"rule" validate:"required"`
}

type UpdatePolicyRequest struct {
	Name        *string `json:"name,omitempty" validate:"omitempty,max=200"`
	Status      *string `json:"status,omitempty"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=2000"`
}

type PolicyRuleInput struct {
	Version    string  `json:"version" validate:"required,max=100"`
	Format     string  `json:"format" validate:"required"`
	Entrypoint *string `json:"entrypoint,omitempty" validate:"omitempty,max=200"`
	Content    string  `json:"content" validate:"required"`
}

type PolicyAssignmentInput struct {
	Scope        string  `json:"scope" validate:"required"`
	ScopeID      *string `json:"scopeId,omitempty" validate:"omitempty,uuid4"`
	Priority     int     `json:"priority"`
	PinVersion   *string `json:"pinVersion,omitempty"`
	PolicyRuleID *string `json:"policyRuleId,omitempty" validate:"omitempty,uuid4"`
}

type UpdateAssignmentsRequest struct {
	Assignments []PolicyAssignmentInput `json:"assignments"`
}

func NewPoliciesHandler(db *sql.DB) *PoliciesHandler {
	return &PoliciesHandler{db: db, validator: validator.New()}
}

func (h *PoliciesHandler) List(c *fiber.Ctx) error {
	limit := parseIntWithDefault(c.Query("limit"), 50)
	offset := parseIntWithDefault(c.Query("offset"), 0)
	if limit < 1 || limit > 200 || offset < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid pagination"})
	}

	filters := storage.PolicyFilters{
		Limit:    limit,
		Offset:   offset,
		Query:    strings.TrimSpace(c.Query("q")),
		Status:   strings.TrimSpace(c.Query("status")),
		Kind:     strings.TrimSpace(c.Query("kind")),
		TenantID: tenantIDFromContext(c),
	}

	items, total, err := storage.ListPolicies(c.Context(), h.db, filters)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policies"})
	}

	response := make([]v1dto.PolicyListItemDTO, 0, len(items))
	for _, item := range items {
		response = append(response, mapPolicyListItem(item))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response, "total": total})
}

func (h *PoliciesHandler) Get(c *fiber.Ctx) error {
	policyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy id"})
	}

	tenantID := tenantIDFromContext(c)
	policy, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if policy == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	rules, err := storage.ListPolicyRules(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy rules"})
	}
	assignments, err := storage.ListPolicyAssignments(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch assignments"})
	}

	detail := mapPolicyDetail(*policy, rules, assignments)

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": detail})
}

func (h *PoliciesHandler) Create(c *fiber.Ctx) error {
	var req CreatePolicyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	if err := validatePolicyKind(req.Kind); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	status := "disabled"
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = strings.TrimSpace(*req.Status)
	}
	if err := validatePolicyStatus(status); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	if err := validatePolicyRule(req.Rule); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	tx, err := h.db.BeginTx(c.Context(), nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to start transaction"})
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var policy storage.PolicyRecord
	tenantID := tenantIDFromContext(c)
	row := tx.QueryRowContext(
		c.Context(),
		`INSERT INTO policies (tenant_id, name, kind, status, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tenant_id, name, kind, status, description, created_at, updated_at`,
		tenantID,
		strings.TrimSpace(req.Name),
		strings.TrimSpace(req.Kind),
		status,
		req.Description,
	)
	if err := row.Scan(
		&policy.ID,
		&policy.TenantID,
		&policy.Name,
		&policy.Kind,
		&policy.Status,
		&policy.Description,
		&policy.CreatedAt,
		&policy.UpdatedAt,
	); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create policy"})
	}

	ruleRecord, err := insertPolicyRule(c.Context(), tx, policy.ID, req.Rule)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create policy rule"})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to commit policy"})
	}

	policyAuditEntry(c, h.db, "policy.created", "policy", policy.ID, auditDiff{
		After: map[string]interface{}{
			"policy": mapPolicyAuditPayload(policy),
			"rule":   mapPolicyRuleAuditPayload(ruleRecord),
		},
	})

	detail := mapPolicyDetail(policy, []storage.PolicyRuleRecord{ruleRecord}, nil)

	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true, "data": detail})
}

func (h *PoliciesHandler) Update(c *fiber.Ctx) error {
	policyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy id"})
	}

	var req UpdatePolicyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	if req.Status != nil {
		if err := validatePolicyStatus(strings.TrimSpace(*req.Status)); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	if req.Name == nil && req.Description == nil && req.Status == nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "no fields to update"})
	}

	tenantID := tenantIDFromContext(c)
	current, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if current == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	if err := storage.UpdatePolicy(c.Context(), h.db, policyID, storage.UpdatePolicyParams{
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
	}); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update policy"})
	}

	updated, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if updated == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	if req.Status != nil && strings.TrimSpace(*req.Status) != current.Status {
		action := "policy.disabled"
		if strings.EqualFold(strings.TrimSpace(*req.Status), "enabled") {
			action = "policy.enabled"
		}
		policyAuditEntry(c, h.db, action, "policy", updated.ID, auditDiff{
			Before: mapPolicyAuditPayload(*current),
			After:  mapPolicyAuditPayload(*updated),
		})
	}

	if req.Name != nil || req.Description != nil {
		policyAuditEntry(c, h.db, "policy.updated", "policy", updated.ID, auditDiff{
			Before: mapPolicyAuditPayload(*current),
			After:  mapPolicyAuditPayload(*updated),
		})
	}

	rules, err := storage.ListPolicyRules(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy rules"})
	}
	assignments, err := storage.ListPolicyAssignments(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch assignments"})
	}

	detail := mapPolicyDetail(*updated, rules, assignments)

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": detail})
}

func (h *PoliciesHandler) AddVersion(c *fiber.Ctx) error {
	policyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy id"})
	}

	var req PolicyRuleInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	if err := validatePolicyRule(req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
	}

	tenantID := tenantIDFromContext(c)
	current, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if current == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	tx, err := h.db.BeginTx(c.Context(), nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to start transaction"})
	}
	defer func() {
		_ = tx.Rollback()
	}()

	ruleRecord, err := insertPolicyRule(c.Context(), tx, policyID, req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create policy rule"})
	}

	if _, err := tx.ExecContext(
		c.Context(),
		`UPDATE policies SET updated_at = $1 WHERE id = $2`,
		time.Now().UTC(),
		policyID,
	); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to update policy timestamp"})
	}

	if err := tx.Commit(); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to commit policy rule"})
	}

	policyAuditEntry(c, h.db, "policy.version_added", "policy_rule", policyID, auditDiff{
		After: mapPolicyRuleAuditPayload(ruleRecord),
	})

	return c.Status(http.StatusCreated).JSON(fiber.Map{"success": true, "data": mapPolicyRule(ruleRecord)})
}

func (h *PoliciesHandler) UpdateAssignments(c *fiber.Ctx) error {
	policyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy id"})
	}

	tenantID := tenantIDFromContext(c)

	var req UpdateAssignmentsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid request body"})
	}

	if req.Assignments == nil {
		req.Assignments = []PolicyAssignmentInput{}
	}

	for _, assignment := range req.Assignments {
		if err := h.validator.Struct(assignment); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
		if err := validatePolicyAssignment(assignment); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}
	}

	current, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if current == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	beforeAssignments, err := storage.ListPolicyAssignments(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch assignments"})
	}

	rules, err := storage.ListPolicyRules(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy rules"})
	}

	var defaultRuleID *uuid.UUID
	if len(rules) > 0 {
		defaultRuleID = &rules[0].ID
	}

	tx, err := h.db.BeginTx(c.Context(), nil)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to start transaction"})
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(c.Context(), `DELETE FROM policy_assignments WHERE policy_id = $1`, policyID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to reset assignments"})
	}

	createdAssignments := []storage.PolicyAssignmentRecord{}
	for _, assignment := range req.Assignments {
		ruleID, err := resolveAssignmentRuleID(c.Context(), h.db, policyID, assignment, defaultRuleID)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": err.Error()})
		}

		var scopeID interface{}
		if assignment.ScopeID != nil && strings.TrimSpace(*assignment.ScopeID) != "" {
			parsed := uuid.MustParse(strings.TrimSpace(*assignment.ScopeID))
			scopeID = parsed
		}

		row := tx.QueryRowContext(
			c.Context(),
			`INSERT INTO policy_assignments (policy_id, policy_rule_id, scope, scope_id, priority)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, policy_id, policy_rule_id, scope, scope_id, priority, created_at`,
			policyID,
			ruleID,
			assignment.Scope,
			scopeID,
			assignment.Priority,
		)

		var record storage.PolicyAssignmentRecord
		if err := row.Scan(
			&record.ID,
			&record.PolicyID,
			&record.PolicyRuleID,
			&record.Scope,
			&record.ScopeID,
			&record.Priority,
			&record.CreatedAt,
		); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to create assignment"})
		}
		createdAssignments = append(createdAssignments, record)
	}

	if err := tx.Commit(); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to commit assignments"})
	}

	policyAuditEntry(c, h.db, "policy.assigned", "policy_assignment", policyID, auditDiff{
		Before: mapPolicyAssignmentsAuditPayload(beforeAssignments),
		After:  mapPolicyAssignmentsAuditPayload(createdAssignments),
	})

	response := make([]v1dto.PolicyAssignmentDTO, 0, len(createdAssignments))
	for _, assignment := range createdAssignments {
		response = append(response, mapPolicyAssignment(assignment))
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true, "data": response})
}

func (h *PoliciesHandler) Delete(c *fiber.Ctx) error {
	policyID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid policy id"})
	}

	tenantID := tenantIDFromContext(c)
	current, err := storage.GetPolicyByID(c.Context(), h.db, policyID, tenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to fetch policy"})
	}
	if current == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"success": false, "error": "policy not found"})
	}

	if err := storage.DeletePolicy(c.Context(), h.db, policyID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to delete policy"})
	}

	policyAuditEntry(c, h.db, "policy.deleted", "policy", policyID, auditDiff{
		Before: mapPolicyAuditPayload(*current),
	})

	return c.Status(http.StatusOK).JSON(fiber.Map{"success": true})
}

func mapPolicyListItem(item storage.PolicyListItem) v1dto.PolicyListItemDTO {
	policy := mapPolicyRecord(item.PolicyRecord)
	var latestVersion *string
	if item.LatestVersion.Valid {
		value := item.LatestVersion.String
		latestVersion = &value
	}
	return v1dto.PolicyListItemDTO{
		PolicyDTO:        policy,
		LatestVersion:    latestVersion,
		AssignmentsCount: item.AssignmentsCount,
	}
}

func mapPolicyDetail(policy storage.PolicyRecord, rules []storage.PolicyRuleRecord, assignments []storage.PolicyAssignmentRecord) v1dto.PolicyDetailDTO {
	versions := make([]v1dto.PolicyRuleDTO, 0, len(rules))
	for _, rule := range rules {
		versions = append(versions, mapPolicyRule(rule))
	}

	mappedAssignments := make([]v1dto.PolicyAssignmentDTO, 0, len(assignments))
	for _, assignment := range assignments {
		mappedAssignments = append(mappedAssignments, mapPolicyAssignment(assignment))
	}

	var activeRule *v1dto.PolicyRuleDTO
	var latestVersion *string
	if len(versions) > 0 {
		activeRule = &versions[0]
		latestVersion = &versions[0].Version
	}

	return v1dto.PolicyDetailDTO{
		PolicyDTO:        mapPolicyRecord(policy),
		LatestVersion:    latestVersion,
		AssignmentsCount: len(assignments),
		ActiveRule:       activeRule,
		Versions:         versions,
		Assignments:      mappedAssignments,
	}
}

func mapPolicyRecord(policy storage.PolicyRecord) v1dto.PolicyDTO {
	var tenantID *string
	if policy.TenantID.Valid {
		value := policy.TenantID.UUID.String()
		tenantID = &value
	}
	var description *string
	if policy.Description.Valid {
		value := policy.Description.String
		description = &value
	}

	return v1dto.PolicyDTO{
		ID:          policy.ID.String(),
		TenantID:    tenantID,
		Name:        policy.Name,
		Kind:        policy.Kind,
		Status:      policy.Status,
		Description: description,
		CreatedAt:   policy.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   policy.UpdatedAt.Format(time.RFC3339),
	}
}

func mapPolicyRule(rule storage.PolicyRuleRecord) v1dto.PolicyRuleDTO {
	var entrypoint *string
	if rule.Entrypoint.Valid {
		value := rule.Entrypoint.String
		entrypoint = &value
	}
	return v1dto.PolicyRuleDTO{
		ID:         rule.ID.String(),
		PolicyID:   rule.PolicyID.String(),
		Version:    rule.Version,
		Format:     rule.Format,
		Content:    rule.Content,
		Sha256:     rule.Sha256,
		Entrypoint: entrypoint,
		CreatedAt:  rule.CreatedAt.Format(time.RFC3339),
	}
}

func mapPolicyAssignment(assignment storage.PolicyAssignmentRecord) v1dto.PolicyAssignmentDTO {
	var ruleID *string
	if assignment.PolicyRuleID.Valid {
		value := assignment.PolicyRuleID.UUID.String()
		ruleID = &value
	}
	var scopeID *string
	if assignment.ScopeID.Valid {
		value := assignment.ScopeID.UUID.String()
		scopeID = &value
	}

	return v1dto.PolicyAssignmentDTO{
		ID:           assignment.ID.String(),
		PolicyID:     assignment.PolicyID.String(),
		PolicyRuleID: ruleID,
		Scope:        assignment.Scope,
		ScopeID:      scopeID,
		Priority:     assignment.Priority,
		CreatedAt:    assignment.CreatedAt.Format(time.RFC3339),
	}
}

func insertPolicyRule(ctx context.Context, tx *sql.Tx, policyID uuid.UUID, input PolicyRuleInput) (storage.PolicyRuleRecord, error) {
	content := strings.TrimSpace(input.Content)
	sum := sha256.Sum256([]byte(content))
	sha := hex.EncodeToString(sum[:])

	row := tx.QueryRowContext(
		ctx,
		`INSERT INTO policy_rules (policy_id, version, format, content, sha256, entrypoint)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, policy_id, version, format, content, sha256, entrypoint, created_at`,
		policyID,
		strings.TrimSpace(input.Version),
		strings.TrimSpace(input.Format),
		content,
		sha,
		nullableStringArg(input.Entrypoint),
	)

	var rule storage.PolicyRuleRecord
	if err := row.Scan(
		&rule.ID,
		&rule.PolicyID,
		&rule.Version,
		&rule.Format,
		&rule.Content,
		&rule.Sha256,
		&rule.Entrypoint,
		&rule.CreatedAt,
	); err != nil {
		return storage.PolicyRuleRecord{}, err
	}

	return rule, nil
}

func validatePolicyStatus(value string) error {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "enabled", "disabled":
		return nil
	default:
		return fiber.NewError(http.StatusBadRequest, "invalid policy status")
	}
}

func validatePolicyKind(value string) error {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "gate", "sla", "auto_triage":
		return nil
	default:
		return fiber.NewError(http.StatusBadRequest, "invalid policy kind")
	}
}

func validatePolicyRule(rule PolicyRuleInput) error {
	if strings.TrimSpace(rule.Content) == "" {
		return fiber.NewError(http.StatusBadRequest, "rule content is required")
	}
	if strings.TrimSpace(rule.Version) == "" {
		return fiber.NewError(http.StatusBadRequest, "rule version is required")
	}
	if strings.TrimSpace(rule.Format) == "" {
		return fiber.NewError(http.StatusBadRequest, "rule format is required")
	}
	if !strings.EqualFold(strings.TrimSpace(rule.Format), "rego") {
		return fiber.NewError(http.StatusBadRequest, "only rego format is supported")
	}
	return nil
}

func validatePolicyAssignment(input PolicyAssignmentInput) error {
	scope := strings.TrimSpace(input.Scope)
	switch scope {
	case "global", "product", "import_job", "scan_result":
	default:
		return fiber.NewError(http.StatusBadRequest, "invalid assignment scope")
	}

	if scope == "global" {
		return nil
	}

	if input.ScopeID == nil || strings.TrimSpace(*input.ScopeID) == "" {
		return fiber.NewError(http.StatusBadRequest, "scopeId is required")
	}
	return nil
}

func resolveAssignmentRuleID(ctx context.Context, db *sql.DB, policyID uuid.UUID, assignment PolicyAssignmentInput, fallback *uuid.UUID) (*uuid.UUID, error) {
	if assignment.PolicyRuleID != nil && strings.TrimSpace(*assignment.PolicyRuleID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*assignment.PolicyRuleID))
		if err != nil {
			return nil, fiber.NewError(http.StatusBadRequest, "invalid policyRuleId")
		}
		return &parsed, nil
	}

	if assignment.PinVersion != nil && strings.TrimSpace(*assignment.PinVersion) != "" {
		ruleID, err := storage.GetPolicyRuleIDByVersion(ctx, db, policyID, strings.TrimSpace(*assignment.PinVersion))
		if err != nil {
			return nil, err
		}
		if ruleID == nil {
			return nil, fiber.NewError(http.StatusBadRequest, "pinVersion not found")
		}
		return ruleID, nil
	}

	if fallback != nil {
		return fallback, nil
	}

	return nil, fiber.NewError(http.StatusBadRequest, "policy has no rules")
}

func mapPolicyAuditPayload(policy storage.PolicyRecord) map[string]interface{} {
	payload := map[string]interface{}{
		"id":        policy.ID.String(),
		"name":      policy.Name,
		"kind":      policy.Kind,
		"status":    policy.Status,
		"createdAt": policy.CreatedAt.Format(time.RFC3339),
		"updatedAt": policy.UpdatedAt.Format(time.RFC3339),
	}
	if policy.Description.Valid {
		payload["description"] = policy.Description.String
	}
	if policy.TenantID.Valid {
		payload["tenantId"] = policy.TenantID.UUID.String()
	}
	return payload
}

func mapPolicyRuleAuditPayload(rule storage.PolicyRuleRecord) map[string]interface{} {
	payload := map[string]interface{}{
		"id":             rule.ID.String(),
		"policyId":       rule.PolicyID.String(),
		"version":        rule.Version,
		"format":         rule.Format,
		"sha256":         rule.Sha256,
		"contentPreview": contentPreview(rule.Content, 200),
		"createdAt":      rule.CreatedAt.Format(time.RFC3339),
	}
	if rule.Entrypoint.Valid {
		payload["entrypoint"] = rule.Entrypoint.String
	}
	return payload
}

func mapPolicyAssignmentsAuditPayload(assignments []storage.PolicyAssignmentRecord) []map[string]interface{} {
	payload := make([]map[string]interface{}, 0, len(assignments))
	for _, assignment := range assignments {
		entry := map[string]interface{}{
			"id":        assignment.ID.String(),
			"policyId":  assignment.PolicyID.String(),
			"scope":     assignment.Scope,
			"priority":  assignment.Priority,
			"createdAt": assignment.CreatedAt.Format(time.RFC3339),
		}
		if assignment.PolicyRuleID.Valid {
			entry["policyRuleId"] = assignment.PolicyRuleID.UUID.String()
		}
		if assignment.ScopeID.Valid {
			entry["scopeId"] = assignment.ScopeID.UUID.String()
		}
		payload = append(payload, entry)
	}
	return payload
}

func nullableStringArg(value *string) interface{} {
	if value == nil {
		return nil
	}
	if trimmed := strings.TrimSpace(*value); trimmed != "" {
		return trimmed
	}
	return nil
}

func contentPreview(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || limit <= 0 {
		return ""
	}
	if len(trimmed) <= limit {
		return trimmed
	}
	return trimmed[:limit]
}
