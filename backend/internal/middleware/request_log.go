package middleware

import (
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
)

func RequestLogger(log *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		latency := time.Since(start)
		log.Info("http_request",
			slog.String("request_id", toString(c.Locals("requestid"))),
			slog.String("method", c.Method()),
			slog.String("path", c.Path()),
			slog.Int("status", c.Response().StatusCode()),
			slog.String("latency", latency.String()),
			slog.String("ip", c.IP()),
		)
		return err
	}
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
