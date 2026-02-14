package handlers

import (
	"database/sql"
	"net/http"

	"red-lycoris/backend/internal/authz"
	"red-lycoris/backend/internal/models"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AdminAccessHandler struct {
	db        *sql.DB
	evaluator *authz.Evaluator
}

func NewAdminAccessHandler(db *sql.DB, evaluator *authz.Evaluator) *AdminAccessHandler {
	return &AdminAccessHandler{db: db, evaluator: evaluator}
}

func (h *AdminAccessHandler) ListTeamMembers(c *fiber.Ctx) error {
	requestCtx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(requestCtx, authz.PermAdminTeamsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "forbidden"})
	}

	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid team id"})
	}

	items, err := storage.ListTeamMembers(c.Context(), h.db, requestCtx.TenantID, teamID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list team members"})
	}
	return c.JSON(fiber.Map{"success": true, "data": items})
}

func (h *AdminAccessHandler) ListProductAccess(c *fiber.Ctx) error {
	requestCtx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(requestCtx, authz.PermAdminProjectsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "forbidden"})
	}

	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	teamRoles, err := storage.ListProductTeamRoles(c.Context(), h.db, requestCtx.TenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list team roles"})
	}
	userRoles, err := storage.ListProductUserRoles(c.Context(), h.db, requestCtx.TenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to list user roles"})
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"teamRoles": teamRoles, "userRoles": userRoles}})
}

func (h *AdminAccessHandler) GetMyEffectiveProductRole(c *fiber.Ctx) error {
	requestCtx := authz.ContextFromFiber(c)
	productID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "invalid product id"})
	}

	if err := h.evaluator.RequireProjectRole(c.Context(), requestCtx, productID, models.ProjectRoleViewer); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"success": false, "error": "forbidden"})
	}
	role, err := storage.GetEffectiveProductRole(c.Context(), h.db, requestCtx.TenantID, requestCtx.UserID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "failed to evaluate role"})
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"role": role}})
}
