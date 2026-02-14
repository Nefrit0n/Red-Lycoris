package middleware

import (
	"errors"

	"red-lycoris/backend/internal/authz"

	"github.com/gofiber/fiber/v2"
)

func RequirePermission(evaluator *authz.Evaluator, permission authz.Permission) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := authz.ContextFromFiber(c)
		if err := evaluator.Require(ctx, permission); err != nil {
			if errors.Is(err, authz.ErrForbidden) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"success": false, "error": "forbidden"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "authorization failed"})
		}
		return c.Next()
	}
}
