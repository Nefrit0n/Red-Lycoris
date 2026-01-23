package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"
	"lotus-warden/backend/internal/storage"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// parseIntWithDefault parses an integer from string with a fallback value
func parseIntWithDefault(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

// parseBoolWithDefault parses a boolean from string with a fallback value
func parseBoolWithDefault(raw string, fallback bool) bool {
	if raw == "" {
		return fallback
	}
	normalized := strings.ToLower(strings.TrimSpace(raw))
	switch normalized {
	case "true", "1", "yes":
		return true
	case "false", "0", "no":
		return false
	default:
		return fallback
	}
}

// firstNonEmpty returns the first non-empty string from the provided values
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

// stringPointer returns a pointer to the given string
func stringPointer(value string) *string {
	return &value
}

// timeFormatRFC3339 returns the RFC3339 time format constant
func timeFormatRFC3339() string {
	return time.RFC3339
}

// validateFindingSeverity validates that the severity is one of the allowed values
func validateFindingSeverity(severity string) error {
	switch severity {
	case "low", "medium", "high", "critical":
		return nil
	default:
		return fmt.Errorf("invalid severity")
	}
}

// validateFindingStatus validates that the status is one of the allowed values
func validateFindingStatus(status string) error {
	switch status {
	case "new",
		"under_review",
		"confirmed",
		"false_positive",
		"out_of_scope",
		"risk_accepted",
		"mitigated",
		"duplicate":
		return nil
	default:
		return fmt.Errorf("invalid status")
	}
}

func validateFindingCategory(category string) error {
	switch category {
	case models.CategorySAST, models.CategorySCA, models.CategorySecrets, models.CategoryConfig:
		return nil
	default:
		return fmt.Errorf("invalid category")
	}
}

// parseIDs converts string IDs to UUIDs with validation
func parseIDs(rawIDs []string) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("invalid id in ids")
		}
		ids = append(ids, parsed)
	}
	return ids, nil
}

// resolveProductFilter resolves product ID from various input formats
func resolveProductFilter(ctx context.Context, db *sql.DB, productIDParam string, productParam string) (*uuid.UUID, error) {
	if productIDParam != "" {
		parsed, err := uuid.Parse(productIDParam)
		if err != nil {
			return nil, fmt.Errorf("invalid product id")
		}
		return &parsed, nil
	}

	if productParam == "" {
		return nil, nil
	}

	if parsed, err := uuid.Parse(productParam); err == nil {
		return &parsed, nil
	}

	if product, err := storage.FindProductByIdentifier(ctx, db, productParam, nil); err != nil {
		return nil, err
	} else if product != nil {
		return &product.ID, nil
	}

	if product, err := storage.FindProductBySlug(ctx, db, productParam, nil); err != nil {
		return nil, err
	} else if product != nil {
		return &product.ID, nil
	}

	return nil, fmt.Errorf("product not found")
}

// userIDFromContext extracts user ID from fiber context
func userIDFromContext(c *fiber.Ctx) *uuid.UUID {
	// основной кейс: middleware кладет "user_id"
	if v := c.Locals("user_id"); v != nil {
		switch t := v.(type) {
		case uuid.UUID:
			return &t
		case string:
			if id, err := uuid.Parse(t); err == nil {
				return &id
			}
		}
	}

	// fallback: если где-то остался старый ключ
	if v := c.Locals("userID"); v != nil {
		switch t := v.(type) {
		case uuid.UUID:
			return &t
		case string:
			if id, err := uuid.Parse(t); err == nil {
				return &id
			}
		}
	}

	return nil
}

func parseDateParam(raw string, endOfDay bool) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02", // ISO date
		"02-01-2006", // DD-MM-YYYY
		"02.01.2006",
		"02/01/2006",
	}

	for _, l := range layouts {
		t, err := time.Parse(l, raw)
		if err != nil {
			continue
		}

		// Date-only layouts → normalize to start/end of day in UTC
		if l != time.RFC3339 {
			base := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
			if endOfDay {
				base = base.Add(24*time.Hour - time.Nanosecond)
			}
			return &base, nil
		}

		// RFC3339 → keep timestamp meaning, normalize to UTC for consistency
		u := t.UTC()
		return &u, nil
	}

	return nil, fmt.Errorf(
		"invalid date format %q: expected RFC3339 or YYYY-MM-DD (also accepts DD-MM-YYYY)",
		raw,
	)
}
