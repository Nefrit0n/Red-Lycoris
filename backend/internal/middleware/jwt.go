package middleware

import (
	"fmt"
	"strings"

	"red-lycoris/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type JWTClaims struct {
	UserID             string   `json:"user_id"`
	TenantID           string   `json:"tenant_id,omitempty"`
	Roles              []string `json:"roles"`
	OrgRole            string   `json:"org_role,omitempty"`
	MustChangePassword bool     `json:"must_change_password"`
	jwt.RegisteredClaims
}

func RequireJWT(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "missing token"})
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
		if claims.OrgRole != "" {
			c.Locals("org_role", claims.OrgRole)
		} else {
			c.Locals("org_role", string(resolveOrgRoleFromLegacyRoles(claims.Roles)))
		}
		if claims.TenantID != "" {
			tenantID, err := uuid.Parse(claims.TenantID)
			if err != nil {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "invalid tenant claims",
				})
			}
			c.Locals("tenant_id", tenantID)
		}

		return c.Next()
	}
}

func resolveOrgRoleFromLegacyRoles(roles []string) models.OrgRole {
	has := map[string]struct{}{}
	for _, role := range roles {
		has[role] = struct{}{}
	}
	if _, ok := has[string(models.OrgRoleOwner)]; ok {
		return models.OrgRoleOwner
	}
	if _, ok := has[string(models.OrgRoleAdmin)]; ok {
		return models.OrgRoleAdmin
	}
	if _, ok := has[string(models.OrgRoleSecurityManager)]; ok {
		return models.OrgRoleSecurityManager
	}
	return models.OrgRoleViewer
}
