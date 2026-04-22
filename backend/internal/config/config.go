package config

import (
	"os"
	"strconv"
	"time"
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
