package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID     string   `json:"user_id"`
	Roles      []string `json:"roles"`
	PwdChanged bool     `json:"pwd_changed"`
	jwt.RegisteredClaims
}

func RequireJWT(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing token"})
		}

		tokenStr := strings.TrimPrefix(auth, "Bearer ")

		token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || claims.UserID == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "invalid claims"})
		}

		// 🔐 FORCE PASSWORD ROTATION
		if !claims.PwdChanged && c.Path() != "/api/v1/auth/change-password" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "PASSWORD_CHANGE_REQUIRED",
			})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("roles", claims.Roles)
		return c.Next()
	}
}
