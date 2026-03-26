package handlers

import (
	"log/slog"
	"os"

	"github.com/gofiber/fiber/v2"
)

// handlerLogger is a shared structured logger for handler-level error logging.
var handlerLogger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

// respondError sends a uniform error response and logs the error with request context.
// All error responses use the shape: {"success": false, "error": "<message>"}.
func respondError(c *fiber.Ctx, status int, msg string) error {
	handlerLogger.Error("handler_error",
		slog.String("request_id", requestIDFromCtx(c)),
		slog.String("method", c.Method()),
		slog.String("path", c.Path()),
		slog.Int("status", status),
		slog.String("error", msg),
	)
	return c.Status(status).JSON(fiber.Map{"success": false, "error": msg})
}

// respondOK sends a uniform success response: {"success": true, "data": data}.
func respondOK(c *fiber.Ctx, data any) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true, "data": data})
}

// respondList sends a paginated list response: {"success": true, "data": items, "meta": meta}.
func respondList(c *fiber.Ctx, items any, meta any) error {
	resp := fiber.Map{"success": true, "data": items}
	if meta != nil {
		resp["meta"] = meta
	}
	return c.JSON(resp)
}

func requestIDFromCtx(c *fiber.Ctx) string {
	if rid, ok := c.Locals("requestid").(string); ok {
		return rid
	}
	return ""
}
