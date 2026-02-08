package models

import "testing"

func TestValidateRequired(t *testing.T) {
	if err := validateRequired("value", "field"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := validateRequired(" ", "field"); err == nil {
		t.Fatal("expected error for required field")
	}
}

func TestValidateMaxLen(t *testing.T) {
	if err := validateMaxLen("abc", 3, "field"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := validateMaxLen("abcd", 3, "field"); err == nil {
		t.Fatal("expected error for max length")
	}
}

func TestValidateMinLen(t *testing.T) {
	if err := validateMinLen("abc", 2, "field"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := validateMinLen("a", 2, "field"); err == nil {
		t.Fatal("expected error for min length")
	}
}

func TestValidateEmail(t *testing.T) {
	if err := validateEmail("user@example.com"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := validateEmail("invalid-email"); err == nil {
		t.Fatal("expected error for invalid email")
	}
}

func TestValidateSlug(t *testing.T) {
	if err := validateSlug("valid-slug-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := validateSlug("InvalidSlug"); err == nil {
		t.Fatal("expected error for invalid slug")
	}
}
