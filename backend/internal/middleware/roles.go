package middleware

import "github.com/gofiber/fiber/v2"

func AuthorizeRole(allowedRoles ...string) fiber.Handler {
	allowed := map[string]struct{}{}
	for _, r := range allowedRoles {
		allowed[r] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		roles, ok := c.Locals("roles").([]string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "missing roles"})
		}
		for _, r := range roles {
			if _, ok := allowed[r]; ok {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient role"})
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
