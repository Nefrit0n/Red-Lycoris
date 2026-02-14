package authz

import (
	"red-lycoris/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func ContextFromFiber(c *fiber.Ctx) RequestContext {
	return RequestContext{
		UserID:   parseUUIDLocal(c, "user_id"),
		TenantID: parseUUIDLocal(c, "tenant_id"),
		OrgRole:  parseOrgRole(c),
	}
}

func parseUUIDLocal(c *fiber.Ctx, key string) uuid.UUID {
	value := c.Locals(key)
	switch typed := value.(type) {
	case uuid.UUID:
		return typed
	case string:
		parsed, err := uuid.Parse(typed)
		if err == nil {
			return parsed
		}
	}
	return uuid.Nil
}

func parseOrgRole(c *fiber.Ctx) models.OrgRole {
	value := c.Locals("org_role")
	switch typed := value.(type) {
	case models.OrgRole:
		return typed
	case string:
		return models.OrgRole(typed)
	}
	return models.OrgRoleViewer
}
