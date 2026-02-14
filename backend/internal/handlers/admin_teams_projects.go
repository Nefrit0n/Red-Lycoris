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

type AdminTeamsProjectsHandler struct {
	db        *sql.DB
	evaluator *authz.Evaluator
	publisher *events.Publisher
}

func NewAdminTeamsProjectsHandler(db *sql.DB, evaluator *authz.Evaluator, publisher *events.Publisher) *AdminTeamsProjectsHandler {
	return &AdminTeamsProjectsHandler{db: db, evaluator: evaluator, publisher: publisher}
}

func (h *AdminTeamsProjectsHandler) ListTeams(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminTeamsRead); err != nil {
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
	items, next, err := storage.ListAdminTeams(c.Context(), h.db, rctx.TenantID, strings.TrimSpace(c.Query("q")), cursor, limit)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить команды"})
	}
	resp := make([]fiber.Map, 0, len(items))
	for _, it := range items {
		resp = append(resp, fiber.Map{"id": it.ID, "name": it.Name, "members_count": it.MembersCount, "products_count": it.ProductsCount, "updated_at": it.UpdatedAt.UTC().Format(timeRFC3339)})
	}
	out := fiber.Map{"items": resp, "next_cursor": nil}
	if next != nil {
		out["next_cursor"] = next.String()
	}
	return c.JSON(out)
}

func requireIdempotencyHeader(c *fiber.Ctx) error {
	if strings.TrimSpace(c.Get("Idempotency-Key")) == "" {
		return fiber.NewError(http.StatusBadRequest, "Требуется заголовок Idempotency-Key")
	}
	return nil
}

func (h *AdminTeamsProjectsHandler) CreateTeam(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminTeamsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Укажите название команды"})
	}
	id, err := storage.CreateTeam(c.Context(), h.db, rctx.TenantID, strings.TrimSpace(req.Name), req.Description)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось создать команду"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.team.created", TargetType: "team", TargetID: stringPointer(id.String()), Scope: "admin_teams", ScopeID: &id, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"name": req.Name}}, auditMetadataFromContext(c))
	return c.Status(http.StatusCreated).JSON(fiber.Map{"id": id.String()})
}

func (h *AdminTeamsProjectsHandler) PatchTeam(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminTeamsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	teamID, err := uuid.Parse(c.Params("teamId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный teamId"})
	}
	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	if err := storage.UpdateTeam(c.Context(), h.db, rctx.TenantID, teamID, req.Name, req.Description); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось обновить команду"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.team.updated", TargetType: "team", TargetID: stringPointer(teamID.String()), Scope: "admin_teams", ScopeID: &teamID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c)}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) GetTeam(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminTeamsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	teamID, err := uuid.Parse(c.Params("teamId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный teamId"})
	}
	detail, err := storage.GetTeamDetail(c.Context(), h.db, rctx.TenantID, teamID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить команду"})
	}
	if detail == nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Команда не найдена"})
	}
	members := []fiber.Map{}
	for _, m := range detail.Members {
		members = append(members, fiber.Map{"user_id": m.UserID, "email": m.Email, "full_name": nullableStr(m.FullName)})
	}
	productRoles := []fiber.Map{}
	for _, p := range detail.ProductRoles {
		productRoles = append(productRoles, fiber.Map{"product_id": p.ProductID, "product_name": p.ProductName, "role": p.Role})
	}
	return c.JSON(fiber.Map{"id": detail.ID, "name": detail.Name, "description": nullableStr(detail.Description), "members": members, "product_roles": productRoles})
}

func nullableStr(s sql.NullString) interface{} {
	if s.Valid {
		return s.String
	}
	return nil
}

func (h *AdminTeamsProjectsHandler) PutTeamMembers(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminTeamsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	teamID, err := uuid.Parse(c.Params("teamId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный teamId"})
	}
	var req struct {
		UserIDs []string `json:"user_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный запрос"})
	}
	ids := make([]uuid.UUID, 0, len(req.UserIDs))
	for _, raw := range req.UserIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Некорректный user_id"})
		}
		ids = append(ids, id)
	}
	if err := storage.ReplaceTeamMembers(c.Context(), h.db, rctx.TenantID, teamID, ids); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось обновить участников"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.team.member_added", TargetType: "team", TargetID: stringPointer(teamID.String()), Scope: "admin_teams", ScopeID: &teamID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"user_ids": req.UserIDs}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) ListAdminProducts(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	items, err := storage.ListAdminProducts(c.Context(), h.db, rctx.TenantID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить проекты"})
	}
	return c.JSON(items)
}

func (h *AdminTeamsProjectsHandler) GetProductAccess(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	productID, err := uuid.Parse(c.Params("productId"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Некорректный productId"})
	}
	view, err := storage.GetProductAccessView(c.Context(), h.db, rctx.TenantID, productID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось загрузить доступ"})
	}
	teams := []fiber.Map{}
	for _, t := range view.Teams {
		teams = append(teams, fiber.Map{"team_id": t.TeamID, "team_name": t.TeamName, "role": t.Role})
	}
	users := []fiber.Map{}
	for _, u := range view.Users {
		users = append(users, fiber.Map{"user_id": u.UserID, "email": u.Email, "full_name": nullableStr(u.FullName), "role": u.Role})
	}
	return c.JSON(fiber.Map{"teams": teams, "users": users})
}

func (h *AdminTeamsProjectsHandler) PutProductTeamRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, _ := uuid.Parse(c.Params("productId"))
	teamID, _ := uuid.Parse(c.Params("teamId"))
	var req struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil || req.Role == "" {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Укажите роль"})
	}
	if err := storage.SetTeamProductRole(c.Context(), h.db, rctx.TenantID, productID, teamID, req.Role); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось назначить роль"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_projects", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"team_id": teamID.String(), "role": req.Role}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) DeleteProductTeamRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, _ := uuid.Parse(c.Params("productId"))
	teamID, _ := uuid.Parse(c.Params("teamId"))
	if err := storage.DeleteTeamProductRole(c.Context(), h.db, rctx.TenantID, productID, teamID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось удалить роль"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_projects", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"team_id": teamID.String(), "removed": true}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) PutProductUserRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, _ := uuid.Parse(c.Params("productId"))
	userID, _ := uuid.Parse(c.Params("userId"))
	var req struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil || req.Role == "" {
		return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "Укажите роль"})
	}
	if err := storage.UpsertUserProductRole(c.Context(), h.db, rctx.TenantID, userID, productID, req.Role); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось назначить роль"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_projects", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"user_id": userID.String(), "role": req.Role}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) DeleteProductUserRole(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsWrite); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	if err := requireIdempotencyHeader(c); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	productID, _ := uuid.Parse(c.Params("productId"))
	userID, _ := uuid.Parse(c.Params("userId"))
	if err := storage.DeleteUserProductRole(c.Context(), h.db, rctx.TenantID, userID, productID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось удалить роль"})
	}
	writeAdminAuditAndEvent(c.Context(), h.db, h.publisher, auditEntryInput{Action: "admin.product.access_changed", TargetType: "product", TargetID: stringPointer(productID.String()), Scope: "admin_projects", ScopeID: &productID, TenantID: rctx.TenantID, ActorID: &rctx.UserID, ActorType: "user", RequestID: requestIDFromContext(c), IdempotencyKey: idempotencyKeyFromContext(c), Metadata: map[string]interface{}{"user_id": userID.String(), "removed": true}}, auditMetadataFromContext(c))
	return c.JSON(fiber.Map{"ok": true})
}

func (h *AdminTeamsProjectsHandler) GetEffectiveAccess(c *fiber.Ctx) error {
	rctx := authz.ContextFromFiber(c)
	if err := h.evaluator.Require(rctx, authz.PermAdminProjectsRead); err != nil {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "Недостаточно прав"})
	}
	productID, _ := uuid.Parse(c.Params("productId"))
	userID, _ := uuid.Parse(c.Params("userId"))
	effective, sources, err := storage.GetEffectiveAccess(c.Context(), h.db, rctx.TenantID, productID, userID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Не удалось вычислить права"})
	}
	mapped := []fiber.Map{}
	for _, s := range sources {
		m := fiber.Map{"type": s.Type, "role": s.Role, "detail": s.Detail}
		if s.TeamID != nil {
			m["team_id"] = s.TeamID.String()
		}
		if s.TeamName != nil {
			m["team_name"] = *s.TeamName
		}
		mapped = append(mapped, m)
	}
	return c.JSON(fiber.Map{"effective_role": effective, "sources": mapped})
}
