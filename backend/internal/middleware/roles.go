package middleware

import "github.com/gofiber/fiber/v2"

func AuthorizeRole(allowedRoles ...string) fiber.Handler {
	allowed := map[string]struct{}{}
	for _, role := range allowedRoles {
		allowed[role] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		rolesValue := c.Locals("roles")
		roles, ok := rolesValue.([]string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing roles"})
		}
		for _, role := range roles {
			if _, exists := allowed[role]; exists {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"success": false, "error": "insufficient role"})
	}
}

func HasRole(c *fiber.Ctx, role string) bool {
	rolesValue := c.Locals("roles")
	roles, ok := rolesValue.([]string)
	if !ok {
		return false
	}
	for _, entry := range roles {
		if entry == role {
			return true
		}
	}
	return false
}
