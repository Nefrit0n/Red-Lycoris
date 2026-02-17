package middleware

import (
	"database/sql"
	"strings"
	"sync"
	"time"

	"red-lycoris/backend/internal/security"
	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type cachedToken struct {
	token   storage.IntegrationToken
	expires time.Time
}

type IntegrationBearerAuth struct {
	db         *sql.DB
	mu         sync.RWMutex
	cache      map[string]cachedToken
	usedEvents map[uuid.UUID]time.Time
}

func NewIntegrationBearerAuth(db *sql.DB) *IntegrationBearerAuth {
	return &IntegrationBearerAuth{db: db, cache: map[string]cachedToken{}, usedEvents: map[uuid.UUID]time.Time{}}
}

func (m *IntegrationBearerAuth) Require(scopes ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := strings.TrimSpace(c.Get("Authorization"))
		if !strings.HasPrefix(auth, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing token"})
		}
		raw := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		if raw == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}
		tok, ok := m.fromCache(raw)
		if !ok {
			resolved, err := m.resolveToken(c, raw)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "auth lookup failed"})
			}
			if resolved == nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
			}
			tok = *resolved
			m.toCache(raw, tok)
		}
		if tok.RevokedAt.Valid || time.Now().After(tok.ExpiresAt) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "token revoked or expired"})
		}
		if !hasScopes(tok.Scopes, scopes) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient scope"})
		}
		c.Locals("integration_token_id", tok.ID)
		c.Locals("integration_org_id", tok.OrgID)
		if tok.ProjectID.Valid && tok.ProjectID.String != "" {
			if id, err := uuid.Parse(tok.ProjectID.String); err == nil {
				c.Locals("integration_project_id", id)
			}
		}
		c.Locals("integration_scopes", tok.Scopes)
		_ = storage.TouchIntegrationTokenLastUsed(c.Context(), m.db, tok.ID)
		m.throttledUsedEvent(c, tok)
		return c.Next()
	}
}

func (m *IntegrationBearerAuth) resolveToken(c *fiber.Ctx, raw string) (*storage.IntegrationToken, error) {
	items, err := storage.ListActiveIntegrationTokens(c.Context(), m.db)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		if security.VerifyToken(raw, it.TokenHash) {
			copy := it
			return &copy, nil
		}
	}
	return nil, nil
}

func (m *IntegrationBearerAuth) fromCache(raw string) (storage.IntegrationToken, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	entry, ok := m.cache[raw]
	if !ok || time.Now().After(entry.expires) {
		return storage.IntegrationToken{}, false
	}
	return entry.token, true
}

func (m *IntegrationBearerAuth) toCache(raw string, t storage.IntegrationToken) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[raw] = cachedToken{token: t, expires: time.Now().Add(1 * time.Minute)}
}

func hasScopes(actual, required []string) bool {
	set := map[string]struct{}{}
	for _, s := range actual {
		set[s] = struct{}{}
	}
	for _, r := range required {
		if _, ok := set[r]; !ok {
			return false
		}
	}
	return true
}

func (m *IntegrationBearerAuth) throttledUsedEvent(c *fiber.Ctx, tok storage.IntegrationToken) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if t, ok := m.usedEvents[tok.ID]; ok && time.Since(t) < 5*time.Minute {
		return
	}
	m.usedEvents[tok.ID] = time.Now()
	_ = storage.InsertIntegrationTokenEvent(c.Context(), m.db, tok.OrgID, tok.ID, "used", "token", nil, c.IP(), string(c.Request().Header.UserAgent()), storage.EncodeJSON(map[string]any{"path": c.Path(), "method": c.Method(), "request_id": c.Locals("requestid")}))
}
