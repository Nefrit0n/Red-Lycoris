package config

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"time"

	"redlycoris/internal/domain"
)

type Config struct {
	Env                               string
	DatabaseURL                       string
	RedisURL                          string
	ServerHost                        string
	ServerPort                        string
	LogLevel                          string
	CORSOrigins                       string
	TrustProxy                        bool
	CookieSecure                      bool
	SessionDuration                   time.Duration
	EnrichmentEnabled                 bool
	NVDAPIKey                         string
	BootstrapAdminEmail               string
	BootstrapAdminPassword            string
	BootstrapAdminFullName            string
	BootstrapAdminForcePasswordChange bool
	ScannerKindOverrides              map[string]domain.FindingKind
}

func Load() *Config {
	env := getEnv("ENV", "dev")
	cookieSecureDefault := env != "dev"

	return &Config{
		Env:                               env,
		DatabaseURL:                       getEnv("DATABASE_URL", "postgres://redlycoris:redlycoris@localhost:5432/redlycoris?sslmode=disable"),
		RedisURL:                          getEnv("REDIS_URL", "redis://localhost:6379/0"),
		ServerHost:                        getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:                        getEnv("SERVER_PORT", "8080"),
		LogLevel:                          getEnv("LOG_LEVEL", "info"),
		CORSOrigins:                       getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"),
		TrustProxy:                        getEnvBool("TRUST_PROXY", false),
		CookieSecure:                      getEnvBool("COOKIE_SECURE", cookieSecureDefault),
		SessionDuration:                   getEnvDuration("SESSION_DURATION", 168*time.Hour),
		EnrichmentEnabled:                 getEnv("ENRICHMENT_ENABLED", "true") == "true",
		NVDAPIKey:                         getEnv("NVD_API_KEY", ""),
		BootstrapAdminEmail:               getEnv("BOOTSTRAP_ADMIN_EMAIL", "admin@localhost"),
		BootstrapAdminPassword:            getEnv("BOOTSTRAP_ADMIN_PASSWORD", "admin"),
		BootstrapAdminFullName:            getEnv("BOOTSTRAP_ADMIN_FULL_NAME", "Administrator"),
		BootstrapAdminForcePasswordChange: getEnvBool("BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE", true),
		ScannerKindOverrides:              parseScannerKindOverrides(getEnv("RL_SCANNER_KIND_OVERRIDES", "")),
	}
}

func (c *Config) Addr() string {
	return c.ServerHost + ":" + c.ServerPort
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func parseScannerKindOverrides(raw string) map[string]domain.FindingKind {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	if strings.HasPrefix(raw, "{") {
		var values map[string]string
		if err := json.Unmarshal([]byte(raw), &values); err != nil {
			return nil
		}
		return parseScannerKindPairs(values)
	}

	values := make(map[string]string)
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key, value, ok := strings.Cut(item, "=")
		if !ok {
			key, value, ok = strings.Cut(item, ":")
		}
		if !ok {
			continue
		}
		values[key] = value
	}
	return parseScannerKindPairs(values)
}

func parseScannerKindPairs(values map[string]string) map[string]domain.FindingKind {
	if len(values) == 0 {
		return nil
	}

	out := make(map[string]domain.FindingKind, len(values))
	for scanner, rawKind := range values {
		key := domain.NormalizeScannerName(scanner)
		kind, ok := domain.ParseFindingKind(rawKind)
		if key == "" || !ok {
			continue
		}
		out[key] = kind
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
