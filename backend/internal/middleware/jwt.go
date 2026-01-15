package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID string `json:"user_id"`
	Scope  string `json:"scope"`
	jwt.RegisteredClaims
}

func RequireJWT(secret string, requiredScope string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing bearer token"})
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if tokenString == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing bearer token"})
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || claims.UserID == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "invalid token claims"})
		}
		if requiredScope != "" && !scopeAllows(claims.Scope, requiredScope) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient scope"})
		}

		c.Locals("user_id", claims.UserID)
		return c.Next()
	}
}

func scopeAllows(scope string, required string) bool {
	for _, entry := range strings.Fields(scope) {
		if entry == required {
			return true
		}
	}
	return false
}
