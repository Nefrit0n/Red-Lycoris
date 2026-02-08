package config

import (
	"bytes"
	"log"
	"regexp"
	"testing"
)

func TestGetEnvAsBool(t *testing.T) {
	t.Setenv("BOOL_VAL", "")
	if value := getEnvAsBool("BOOL_VAL", true); value != true {
		t.Fatalf("expected fallback true, got %v", value)
	}

	t.Setenv("BOOL_VAL", "false")
	if value := getEnvAsBool("BOOL_VAL", true); value != false {
		t.Fatalf("expected false, got %v", value)
	}

	t.Setenv("BOOL_VAL", "not-bool")
	if value := getEnvAsBool("BOOL_VAL", false); value != false {
		t.Fatalf("expected fallback false on invalid input, got %v", value)
	}
}

func TestGetEnvAsInt(t *testing.T) {
	t.Setenv("INT_VAL", "")
	if value := getEnvAsInt("INT_VAL", 7); value != 7 {
		t.Fatalf("expected fallback 7, got %d", value)
	}

	t.Setenv("INT_VAL", "42")
	if value := getEnvAsInt("INT_VAL", 7); value != 42 {
		t.Fatalf("expected 42, got %d", value)
	}

	t.Setenv("INT_VAL", "invalid")
	if value := getEnvAsInt("INT_VAL", 9); value != 9 {
		t.Fatalf("expected fallback 9 on invalid input, got %d", value)
	}
}

func TestGetSecureEnv(t *testing.T) {
	var buffer bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&buffer)
	t.Cleanup(func() { log.SetOutput(previous) })

	t.Setenv("JWT_SECRET", "")
	value := getSecureEnv("JWT_SECRET")
	if len(value) != 32 {
		t.Fatalf("expected generated secret length 32, got %d", len(value))
	}
	matched, err := regexp.MatchString("^[0-9a-f]{32}$", value)
	if err != nil {
		t.Fatalf("regexp error: %v", err)
	}
	if !matched {
		t.Fatalf("expected hex value, got %s", value)
	}
	if buffer.Len() == 0 {
		t.Fatal("expected warning log output when env missing")
	}
}

func TestGetSecureEnvWithDefault(t *testing.T) {
	var buffer bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&buffer)
	t.Cleanup(func() { log.SetOutput(previous) })

	t.Setenv("ROOT_PASSWORD", "")
	value := getSecureEnvWithDefault("ROOT_PASSWORD", "root")
	if value != "root" {
		t.Fatalf("expected default root, got %s", value)
	}
	if buffer.Len() == 0 {
		t.Fatal("expected warning log output when using insecure default")
	}
}
