package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"red-lycoris/backend/internal/authz"
	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AdminSLAPoliciesHandler struct {
	db        *sql.DB
	evaluator *authz.Evaluator
	publisher *events.Publisher
}

type slaSettingsRequest struct {
	Enabled      bool `json:"enabled"`
	CriticalDays int  `json:"critical_days"`
	HighDays     int  `json:"high_days"`
	MediumDays   int  `json:"medium_days"`
	LowDays      int  `json:"low_days"`
	DueSoonDays  int  `json:"due_soon_days"`
}

type productSLASettingsRequest struct {
	OverrideEnabled bool `json:"override_enabled"`
	slaSettingsRequest
}

func NewAdminSLAPoliciesHandler(db *sql.DB, evaluator *authz.Evaluator, publisher *events.Publisher) *AdminSLAPoliciesHandler {
	return &AdminSLAPoliciesHandler{db: db, evaluator: evaluator, publisher: publisher}
}

func mapSLAResponse(cfg storage.SLASettings) fiber.Map {
	return fiber.Map{
		"enabled":       cfg.Enabled,
		"critical_days": cfg.CriticalDays,
		"high_days":     cfg.HighDays,
		"medium_days":   cfg.MediumDays,
		"low_days":      cfg.LowDays,
		"due_soon_days": cfg.DueSoonDays,
	}
}

func validateSLARequest(cfg storage.SLASettings) *fiber.Error {
	if err := storage.MustValidateSLASettings(cfg); err != nil {
		if strings.Contains(err.Error(), "range") {
			return fiber.NewError(http.StatusUnprocessableEntity, "Значение должно быть от 1 до 3650")
		}
		return fiber.NewError(http.StatusUnprocessableEntity, "Порог «Скоро дедлайн» не может быть больше минимального SLA")
	}
	return nil
}

func (h *AdminSLAPoliciesHandler) GetOrgSLA(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminPoliciesRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	cfg, err := storage.GetOrgSLASettings(c.Context(), h.db, rctx.TenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить SLA политики"})
	}
	return c.JSON(fiber.Map{"org_default": mapSLAResponse(cfg)})
}

func (h *AdminSLAPoliciesHandler) PutOrgSLA(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminPoliciesWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	var req slaSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Введите целое число"})
	}
	cfg := storage.SLASettings(req)
	if err := validateSLARequest(cfg); err != nil {
		return c.Status(err.Code).JSON(fiber.Map{"error": err.Message})
	}
	before, err := storage.GetOrgSLASettings(c.Context(), h.db, rctx.TenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить SLA политики"})
	}
	if err := storage.UpsertOrgSLASettings(c.Context(), h.db, rctx.TenantID, &rctx.UserID, cfg); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось сохранить SLA политики"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{
		Action:         "admin.sla.updated",
		TargetType:     "policy",
		TargetID:       stringPointer("sla/org"),
		Scope:          "policy",
		TenantID:       rctx.TenantID,
		ActorID:        &rctx.UserID,
		ActorType:      "user",
		RequestID:      requestIDFromContext(c),
		IdempotencyKey: idempotencyKeyFromContext(c),
		Diff:           auditDiff{Before: mapSLAResponse(before), After: mapSLAResponse(cfg)},
	}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminSLAPoliciesHandler) GetProductSLA(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	effective, override, err := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить SLA политики проекта"})
	}
	resp := fiber.Map{"effective": mapSLAResponse(effective), "override": nil}
	if override != nil {
		resp["override"] = mapSLAResponse(*override)
	}
	return c.JSON(resp)
}

func (h *AdminSLAPoliciesHandler) PutProductSLA(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	var req productSLASettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Введите целое число"})
	}
	beforeEffective, beforeOverride, err := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить SLA политики проекта"})
	}

	if !req.OverrideEnabled {
		if err := storage.DeleteProductSLAOverride(c.Context(), h.db, rctx.TenantID, productID); err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось сбросить переопределение SLA"})
		}
		afterEffective, _, afterErr := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
		if afterErr == nil {
			beforePayload := map[string]interface{}{"effective": mapSLAResponse(beforeEffective), "override": nil}
			if beforeOverride != nil {
				beforePayload["override"] = mapSLAResponse(*beforeOverride)
			}
			writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{
				Action:         "admin.sla.project_override_updated",
				TargetType:     "product",
				TargetID:       stringPointer(productID.String()),
				Scope:          "admin_projects",
				ScopeID:        &productID,
				TenantID:       rctx.TenantID,
				ActorID:        &rctx.UserID,
				ActorType:      "user",
				RequestID:      requestIDFromContext(c),
				IdempotencyKey: idempotencyKeyFromContext(c),
				Diff:           auditDiff{Before: beforePayload, After: map[string]interface{}{"effective": mapSLAResponse(afterEffective), "override": nil}},
			}, auditMetadataFromContext(c))
		}
		return c.JSON(fiber.Map{"ok": true})
	}

	cfg := storage.SLASettings(req.slaSettingsRequest)
	if vErr := validateSLARequest(cfg); vErr != nil {
		return c.Status(vErr.Code).JSON(fiber.Map{"error": vErr.Message})
	}
	if err := storage.UpsertProductSLAOverride(c.Context(), h.db, rctx.TenantID, productID, &rctx.UserID, cfg); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось сохранить SLA переопределение"})
	}
	afterEffective, afterOverride, err := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
	if err == nil {
		beforePayload := map[string]interface{}{"effective": mapSLAResponse(beforeEffective), "override": nil}
		if beforeOverride != nil {
			beforePayload["override"] = mapSLAResponse(*beforeOverride)
		}
		afterPayload := map[string]interface{}{"effective": mapSLAResponse(afterEffective), "override": nil}
		if afterOverride != nil {
			afterPayload["override"] = mapSLAResponse(*afterOverride)
		}
		writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{
			Action:         "admin.sla.project_override_updated",
			TargetType:     "product",
			TargetID:       stringPointer(productID.String()),
			Scope:          "admin_projects",
			ScopeID:        &productID,
			TenantID:       rctx.TenantID,
			ActorID:        &rctx.UserID,
			ActorType:      "user",
			RequestID:      requestIDFromContext(c),
			IdempotencyKey: idempotencyKeyFromContext(c),
			Diff:           auditDiff{Before: beforePayload, After: afterPayload},
		}, auditMetadataFromContext(c))
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminSLAPoliciesHandler) DeleteProductSLA(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	beforeEffective, beforeOverride, _ := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
	if err := storage.DeleteProductSLAOverride(c.Context(), h.db, rctx.TenantID, productID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось сбросить переопределение SLA"})
	}
	afterEffective, _, afterErr := storage.GetEffectiveProductSLA(c.Context(), h.db, rctx.TenantID, productID)
	if afterErr == nil {
		beforePayload := map[string]interface{}{"effective": mapSLAResponse(beforeEffective), "override": nil}
		if beforeOverride != nil {
			beforePayload["override"] = mapSLAResponse(*beforeOverride)
		}
		writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{
			Action:         "admin.sla.project_override_updated",
			TargetType:     "product",
			TargetID:       stringPointer(productID.String()),
			Scope:          "admin_projects",
			ScopeID:        &productID,
			TenantID:       rctx.TenantID,
			ActorID:        &rctx.UserID,
			ActorType:      "user",
			RequestID:      requestIDFromContext(c),
			IdempotencyKey: idempotencyKeyFromContext(c),
			Diff:           auditDiff{Before: beforePayload, After: map[string]interface{}{"effective": mapSLAResponse(afterEffective), "override": nil}},
		}, auditMetadataFromContext(c))
	}
	return c.JSON(fiber.Map{"ok": true})
}
