package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID             string   `json:"user_id"`
	Roles              []string `json:"roles"`
	MustChangePassword bool     `json:"must_change_password"`
	jwt.RegisteredClaims
}

func RequireJWT(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing token",
			})
		}

		tokenStr := strings.TrimPrefix(auth, "Bearer ")

		token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid token",
			})
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "invalid claims",
			})
		}

		userID := claims.UserID
		if userID == "" {
			userID = claims.Subject
		}

		if userID == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "invalid claims",
			})
		}

		path := c.Path()

		if claims.MustChangePassword &&
			!strings.HasPrefix(path, "/api/v1/auth/change-password") &&
			!strings.HasPrefix(path, "/api/v1/auth/logout") {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "PASSWORD_CHANGE_REQUIRED",
			})
		}

		c.Locals("user_id", userID)
		c.Locals("roles", claims.Roles)

		return c.Next()
	}
}
