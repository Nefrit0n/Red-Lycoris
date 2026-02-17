package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"red-lycoris/backend/internal/security"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AdminIntegrationTokensHandler struct{ db *sql.DB }

func NewAdminIntegrationTokensHandler(db *sql.DB) *AdminIntegrationTokensHandler {
	return &AdminIntegrationTokensHandler{db: db}
}

func (h *AdminIntegrationTokensHandler) List(c *fiber.Ctx) error {
	orgID := c.Locals("integration_org_id").(uuid.UUID)
	var pid *uuid.UUID
	if p, ok := c.Locals("integration_project_id").(uuid.UUID); ok {
		pid = &p
	}
	items, err := storage.ListIntegrationTokens(c.Context(), h.db, orgID, pid)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "list failed"})
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AdminIntegrationTokensHandler) Create(c *fiber.Ctx) error {
	var req struct {
		Name      string     `json:"name"`
		OrgID     uuid.UUID  `json:"org_id"`
		ProjectID *uuid.UUID `json:"project_id"`
		ExpiresAt *time.Time `json:"expires_at"`
		Scopes    []string   `json:"scopes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}
	if err := security.ValidateScopeList(req.Scopes); err != nil {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}
	policy, err := storage.GetOrgSecurityPolicy(c.Context(), h.db, req.OrgID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "policy lookup failed"})
	}
	now := time.Now().UTC()
	expiresAt := now.AddDate(0, 0, policy.DefaultTokenTTLDays)
	if req.ExpiresAt != nil {
		expiresAt = req.ExpiresAt.UTC()
	}
	if expiresAt.After(now.AddDate(0, 0, policy.MaxTokenTTLDays)) {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "expires_at exceeds max ttl"})
	}
	plain, err := security.GenerateIntegrationToken()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "token generation failed"})
	}
	hash, err := security.HashToken(plain)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "token hash failed"})
	}
	row := storage.IntegrationToken{ID: uuid.New(), OrgID: req.OrgID, Name: req.Name, TokenHash: hash, Scopes: req.Scopes, CreatedAt: now, ExpiresAt: expiresAt}
	if req.ProjectID != nil {
		row.ProjectID = sql.NullString{String: req.ProjectID.String(), Valid: true}
	}
	if err := storage.CreateIntegrationToken(c.Context(), h.db, row); err != nil {
		return c.Status(http.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	_ = storage.InsertIntegrationTokenEvent(c.Context(), h.db, row.OrgID, row.ID, "created", "user", nil, c.IP(), string(c.Request().Header.UserAgent()), storage.EncodeJSON(map[string]any{"name": row.Name}))
	return c.Status(http.StatusCreated).JSON(fiber.Map{"token": row, "token_secret": plain})
}

func (h *AdminIntegrationTokensHandler) Patch(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req struct {
		Name      *string    `json:"name"`
		ExpiresAt *time.Time `json:"expires_at"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "bad request"})
	}
	if err := storage.UpdateIntegrationTokenPatch(c.Context(), h.db, id, req.Name, req.ExpiresAt); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "update failed"})
	}
	tok, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	if tok != nil {
		_ = storage.InsertIntegrationTokenEvent(c.Context(), h.db, tok.OrgID, tok.ID, "name_changed", "user", nil, c.IP(), string(c.Request().Header.UserAgent()), storage.EncodeJSON(req))
	}
	return c.JSON(tok)
}

func (h *AdminIntegrationTokensHandler) Revoke(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	tok, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	if tok == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	if err := storage.RevokeIntegrationToken(c.Context(), h.db, id, time.Now().UTC()); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "revoke failed"})
	}
	_ = storage.InsertIntegrationTokenEvent(c.Context(), h.db, tok.OrgID, tok.ID, "revoked", "user", nil, c.IP(), string(c.Request().Header.UserAgent()), storage.EncodeJSON(map[string]any{"id": id.String()}))
	updated, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	return c.JSON(updated)
}

func (h *AdminIntegrationTokensHandler) Rotate(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	tok, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	if tok == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	plain, _ := security.GenerateIntegrationToken()
	hash, _ := security.HashToken(plain)
	if err := storage.RotateIntegrationToken(c.Context(), h.db, id, hash, tok.ExpiresAt); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "rotate failed"})
	}
	_ = storage.InsertIntegrationTokenEvent(c.Context(), h.db, tok.OrgID, tok.ID, "rotated", "user", nil, c.IP(), string(c.Request().Header.UserAgent()), storage.EncodeJSON(map[string]any{"id": id.String()}))
	updated, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	return c.JSON(fiber.Map{"token": updated, "token_secret": plain})
}

func (h *AdminIntegrationTokensHandler) Audit(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	tok, _ := storage.GetIntegrationTokenByID(c.Context(), h.db, id)
	if tok == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	items, err := storage.ListIntegrationTokenEvents(c.Context(), h.db, tok.OrgID, tok.ID, 100)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "audit failed"})
	}
	return c.JSON(fiber.Map{"items": items})
}
