package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID string   `json:"user_id"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}

func RequireJWT(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "missing bearer token"})
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "missing bearer token"})
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "invalid token"})
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || claims.UserID == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"success": false, "error": "invalid token claims"})
		}

		c.Locals("user_id", claims.UserID)
		if claims.Roles == nil {
			claims.Roles = []string{}
		}
		c.Locals("roles", claims.Roles)
		return c.Next()
	}
}
