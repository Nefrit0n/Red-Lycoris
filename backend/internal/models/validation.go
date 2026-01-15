package models

import (
	"fmt"
	"net/mail"
	"regexp"
	"strings"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

func validateRequired(value string, field string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

func validateMaxLen(value string, max int, field string) error {
	if len(value) > max {
		return fmt.Errorf("%s must be at most %d characters", field, max)
	}
	return nil
}

func validateMinLen(value string, min int, field string) error {
	if len(value) < min {
		return fmt.Errorf("%s must be at least %d characters", field, min)
	}
	return nil
}

func validateEmail(value string) error {
	if _, err := mail.ParseAddress(value); err != nil {
		return fmt.Errorf("email is invalid")
	}
	return nil
}

func validateSlug(value string) error {
	if !slugRegex.MatchString(value) {
		return fmt.Errorf("slug must contain only lowercase letters, numbers, and hyphens")
	}
	return nil
}
