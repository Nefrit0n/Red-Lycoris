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

type AdminUsersHandler struct {
	db        *sql.DB
	evaluator *authz.Evaluator
	publisher *events.Publisher
}

func NewAdminUsersHandler(db *sql.DB, evaluator *authz.Evaluator, publisher *events.Publisher) *AdminUsersHandler {
	return &AdminUsersHandler{db: db, evaluator: evaluator, publisher: publisher}
}

func (h *AdminUsersHandler) List(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminUsersRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	limit := parseIntWithDefault(c.Query("limit"), 20)
	if limit < 1 || limit > 100 {
		limit = 20
	}
	var cursor *uuid.UUID
	if raw := strings.TrimSpace(c.Query("cursor")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный курсор"})
		}
		cursor = &id
	}
	items, next, err := storage.ListAdminUsers(c.Context(), h.db, storage.ListAdminUsersFilters{
		TenantID: rctx.TenantID,
		Q:        strings.TrimSpace(c.Query("q")),
		Role:     strings.TrimSpace(c.Query("role")),
		Status:   strings.TrimSpace(c.Query("status")),
		Cursor:   cursor,
		Limit:    limit,
	})
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить пользователей"})
	}

	resp := make([]fiber.Map, 0, len(items))
	for _, it := range items {
		name := ""
		if it.FullName.Valid {
			name = it.FullName.String
		}
		var lastLogin interface{}
		if it.LastLoginAt.Valid {
			lastLogin = it.LastLoginAt.Time.UTC().Format(timeRFC3339)
		}
		resp = append(resp, fiber.Map{
			"id":             it.ID,
			"full_name":      name,
			"email":          it.Email,
			"org_role":       it.OrgRole,
			"status":         it.Status,
			"last_login_at":  lastLogin,
			"teams_count":    it.TeamsCount,
			"products_count": it.ProductsCount,
		})
	}
	payload := fiber.Map{"items": resp, "next_cursor": nil}
	if next != nil {
		payload["next_cursor"] = next.String()
	}
	return c.JSON(payload)
}

const timeRFC3339 = "2006-01-02T15:04:05Z07:00"

func (h *AdminUsersHandler) Invite(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminUsersInvite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	var req struct {
		Email    string  `json:"email"`
		FullName *string `json:"full_name"`
		OrgRole  string  `json:"org_role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Укажите email"})
	}
	if req.OrgRole == "" {
		req.OrgRole = "viewer"
	}

	exists, err := storage.UserExistsByEmailInTenant(c.Context(), h.db, rctx.TenantID, req.Email)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Ошибка проверки пользователя"})
	}
	if exists {
		return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "Пользователь уже состоит в организации"})
	}
	if inv, err := storage.FindPendingInvitationByEmail(c.Context(), h.db, rctx.TenantID, req.Email); err == nil && inv != nil {
		return c.JSON(fiber.Map{"invitation_id": inv.String(), "status": "invited"})
	}
	invitedBy := rctx.UserID
	invID, err := storage.CreateInvitation(c.Context(), h.db, rctx.TenantID, req.Email, req.FullName, req.OrgRole, &invitedBy)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось создать приглашение"})
	}

	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{
		Action: "admin.user.invited", TargetType: "user", TargetID: nil, Scope: "admin_users", TenantID: rctx.TenantID,
		ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c),
		Metadata: map[string]interface{}{"email": req.Email, "org_role": req.OrgRole, "invitation_id": invID.String()},
	}, auditMetadataFromContext(c))

	return c.Status(http.StatusCreated).JSON(fiber.Map{"invitation_id": invID.String(), "status": "invited"})
}

func (h *AdminUsersHandler) Patch(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	userID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный userId"})
	}
	var req struct {
		OrgRole *string `json:"org_role"`
		Status  *string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	if req.OrgRole != nil {
		if err := h.evaluator.Require(rctx, authz.PermAdminUsersUpdateRole); err != nil {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
		}
	}
	if req.Status != nil && *req.Status == "deactivated" {
		if err := h.evaluator.Require(rctx, authz.PermAdminUsersDeactivate); err != nil {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
		}
	}
	if err := storage.UpdateAdminUser(c.Context(), h.db, rctx.TenantID, userID, req.OrgRole, req.Status); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось обновить пользователя"})
	}
	action := "admin.user.updated"
	if req.OrgRole != nil {
		action = "admin.user.role_changed"
	}
	if req.Status != nil && *req.Status == "deactivated" {
		action = "admin.user.deactivated"
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: action, TargetType: "user", TargetID: stringPointer(userID.String()), Scope: "admin_users", ScopeID: &userID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c)}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminUsersHandler) GetAccess(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminUsersRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	userID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный userId"})
	}
	view, err := storage.GetUserAccessView(c.Context(), h.db, rctx.TenantID, userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить доступы"})
	}
	if view == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Пользователь не найден"})
	}
	teams := make([]fiber.Map, 0, len(view.Teams))
	for _, t := range view.Teams {
		teams = append(teams, fiber.Map{"id": t.ID, "name": t.Name})
	}
	prods := make([]fiber.Map, 0, len(view.ProductRoles))
	for _, p := range view.ProductRoles {
		prods = append(prods, fiber.Map{"product_id": p.ProductID, "product_name": p.ProductName, "role": p.Role})
	}
	return c.JSON(fiber.Map{"org_role": view.OrgRole, "teams": teams, "product_roles": prods})
}

func (h *AdminUsersHandler) PutTeams(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminUsersUpdateRole); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	userID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный userId"})
	}
	var req struct {
		TeamIDs []string `json:"team_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	teamIDs := make([]uuid.UUID, 0, len(req.TeamIDs))
	for _, raw := range req.TeamIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Некорректный team_id"})
		}
		teamIDs = append(teamIDs, id)
	}
	if err := storage.ReplaceUserTeams(c.Context(), h.db, rctx.TenantID, userID, teamIDs); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось обновить команды"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.team.member_added", TargetType: "user", TargetID: stringPointer(userID.String()), Scope: "admin_users", ScopeID: &userID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"team_ids": req.TeamIDs}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminUsersHandler) PutProductRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	userID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный userId"})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	var req struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil || req.Role == "" {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Укажите роль"})
	}
	if err := storage.UpsertUserProductRole(c.Context(), h.db, rctx.TenantID, userID, productID, req.Role); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось выдать доступ"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_users", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"user_id": userID.String(), "role": req.Role}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminUsersHandler) DeleteProductRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	userID, err := uuid.Parse(c.Params("userId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный userId"})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	if err := storage.DeleteUserProductRole(c.Context(), h.db, rctx.TenantID, userID, productID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось удалить доступ"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_users", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"user_id": userID.String(), "removed": true}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminUsersHandler) Bulk(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Требуется заголовок Idempotency-Key"})
	}
	var req struct {
		UserIDs []string               `json:"user_ids"`
		Action  string                 `json:"action"`
		Params  map[string]interface{} `json:"params"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	processed := 0
	for _, raw := range req.UserIDs {
		uid, err := uuid.Parse(raw)
		if err != nil {
			continue
		}
		switch req.Action {
		case "set_org_role":
			if err := h.evaluator.Require(rctx, authz.PermAdminUsersUpdateRole); err != nil {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
			}
			role, _ := req.Params["org_role"].(string)
			_ = storage.UpdateAdminUser(c.Context(), h.db, rctx.TenantID, uid, &role, nil)
			processed++
		case "add_to_team":
			if err := h.evaluator.Require(rctx, authz.PermAdminTeamsWrite); err != nil {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
			}
			teamIDRaw, _ := req.Params["team_id"].(string)
			teamID, err := uuid.Parse(teamIDRaw)
			if err != nil {
				continue
			}
			_ = storage.ReplaceUserTeams(c.Context(), h.db, rctx.TenantID, uid, []uuid.UUID{teamID})
			processed++
		case "deactivate":
			if err := h.evaluator.Require(rctx, authz.PermAdminUsersDeactivate); err != nil {
				return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
			}
			status := "deactivated"
			_ = storage.UpdateAdminUser(c.Context(), h.db, rctx.TenantID, uid, nil, &status)
			processed++
		}
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.user.bulk_updated", TargetType: "user", Scope: "admin_users", TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"action": req.Action, "processed": processed}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true, "processed": processed})
}
