package middleware

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"os"
	"strings"

	"red-lycoris/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var idempotencyLogger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

func RequireIdempotency(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		method := strings.ToUpper(c.Method())
		if method != fiber.MethodPost && method != fiber.MethodPut && method != fiber.MethodPatch && method != fiber.MethodDelete {
			return c.Next()
		}

		key := strings.TrimSpace(c.Get("Idempotency-Key"))
		if key == "" {
			return c.Next()
		}

		tenantID, ok := c.Locals("tenant_id").(uuid.UUID)
		if !ok || tenantID == uuid.Nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"success": false, "error": "missing tenant context"})
		}

		scope := method + " " + c.Path()
		hash := sha256.Sum256(c.BodyRaw())
		requestHash := hex.EncodeToString(hash[:])

		record, err := storage.GetIdempotencyKey(c.Context(), db, tenantID, scope, key)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "idempotency check failed"})
		}
		if record != nil {
			if record.RequestHash != requestHash {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": "idempotency key reused with different payload"})
			}
			c.Set("Content-Type", "application/json")
			c.Set("X-Idempotency-Replayed", "true")
			return c.Status(record.ResponseCode).Send(record.ResponseBody)
		}

		if err := c.Next(); err != nil {
			return err
		}

		statusCode := c.Response().StatusCode()
		if statusCode >= 500 {
			idempotencyLogger.Warn("idempotency_skip_server_error",
				slog.String("idempotency_key", key),
				slog.String("scope", scope),
				slog.Int("status", statusCode),
			)
			return nil
		}

		body := c.Response().Body()
		var jsonBody json.RawMessage
		if json.Valid(body) {
			jsonBody = append(json.RawMessage(nil), body...)
		} else {
			wrapper, _ := json.Marshal(fiber.Map{"raw": string(body)})
			jsonBody = wrapper
		}

		_ = storage.SaveIdempotencyKey(c.Context(), db, storage.IdempotencyRecord{
			TenantID:     tenantID,
			Scope:        scope,
			Key:          key,
			RequestHash:  requestHash,
			ResponseCode: statusCode,
			ResponseBody: jsonBody,
		})

		return nil
	}
}
