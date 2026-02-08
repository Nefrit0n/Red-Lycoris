package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppPort                  string
	DBHost                   string
	DBPort                   string
	DBUser                   string
	DBPass                   string
	DBName                   string
	DBSSL                    string
	DBMaxOpenConns           int
	DBMaxIdleConns           int
	DBConnMaxLifetimeMinutes int
	DBConnMaxIdleMinutes     int
	RedisURL                 string
	NatsURL                  string
	ObjectStoreEndpoint      string
	ObjectStoreAccessKey     string
	ObjectStoreSecretKey     string
	ObjectStoreBucket        string
	ObjectStoreUseSSL        string
	JWTSecret                string
	RootEmail                string
	RootPassword             string
	AnalysisMaxArchiveBytes  string
	AnalysisMaxExtractBytes  string
	AnalysisTempDir          string
	AnalysisScannerTimeout   string
	AnalysisCleanupInterval  string
	AnalysisCleanupTTL       string
	AnalysisOpenGrepBinary   string
	AnalysisOpenGrepImage    string
	AnalysisTrivyImage       string
	AnalysisCheckovImage     string
	AnalysisKICSImage        string
	AnalysisGitleaksImage    string
	AnalysisGrypeImage       string
	AnalysisContainerNetwork string
	NVDAPIKey                string
	EPSSEnabled              bool
	KEVURL                   string
	KEVMirrorURL             string
	IntelRefreshInterval     string
	IntelWorkerConcurrency   int
	IntelRetryBase           string
	SLACriticalDuration      string
	SLAHighDuration          string
	SLAMediumDuration        string
	SLALowDuration           string
	SLABreachInterval        string
}

func Load() Config {
	return Config{
		AppPort:                  getEnv("APP_PORT", "8080"),
		DBHost:                   getEnv("DB_HOST", "localhost"),
		DBPort:                   getEnv("DB_PORT", "5432"),
		DBUser:                   getEnv("DB_USER", "postgres"),
		DBPass:                   getEnv("DB_PASSWORD", "postgres"),
		DBName:                   getEnv("DB_NAME", "lotus_warden"),
		DBSSL:                    getEnv("DB_SSLMODE", "disable"),
		DBMaxOpenConns:           getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:           getEnvAsInt("DB_MAX_IDLE_CONNS", 5),
		DBConnMaxLifetimeMinutes: getEnvAsInt("DB_CONN_MAX_LIFETIME_MINUTES", 5),
		DBConnMaxIdleMinutes:     getEnvAsInt("DB_CONN_MAX_IDLE_MINUTES", 1),
		RedisURL:                 getEnv("REDIS_URL", "redis://localhost:6379"),
		NatsURL:                  getEnv("NATS_URL", "nats://localhost:4222"),
		ObjectStoreEndpoint:      getEnv("OBJECT_STORE_ENDPOINT", "localhost:9000"),
		ObjectStoreAccessKey:     getEnv("OBJECT_STORE_ACCESS_KEY", "minioadmin"),
		ObjectStoreSecretKey:     getEnv("OBJECT_STORE_SECRET_KEY", "minioadmin"),
		ObjectStoreBucket:        getEnv("OBJECT_STORE_BUCKET", "lotus-warden"),
		ObjectStoreUseSSL:        getEnv("OBJECT_STORE_USE_SSL", "false"),
		JWTSecret:                getSecureEnv("JWT_SECRET"),
		RootEmail:                getEnv("ROOT_EMAIL", "root@localhost"),
		RootPassword:             getSecureEnvWithDefault("ROOT_PASSWORD", "root"),
		AnalysisMaxArchiveBytes:  getEnv("ANALYSIS_MAX_ARCHIVE_BYTES", "209715200"),
		AnalysisMaxExtractBytes:  getEnv("ANALYSIS_MAX_EXTRACT_BYTES", "524288000"),
		AnalysisTempDir:          getEnv("ANALYSIS_TEMP_DIR", "/tmp/lotus-warden-analysis"),
		AnalysisScannerTimeout:   getEnv("ANALYSIS_SCANNER_TIMEOUT", "20m"),
		AnalysisCleanupInterval:  getEnv("ANALYSIS_CLEANUP_INTERVAL", "1h"),
		AnalysisCleanupTTL:       getEnv("ANALYSIS_CLEANUP_TTL", "24h"),
		AnalysisOpenGrepBinary:   getEnv("ANALYSIS_OPENGREP_BINARY", ""),
		AnalysisOpenGrepImage:    getEnv("ANALYSIS_OPENGREP_IMAGE", ""),
		AnalysisTrivyImage:       getEnv("ANALYSIS_TRIVY_IMAGE", "aquasec/trivy:latest"),
		AnalysisCheckovImage:     getEnv("ANALYSIS_CHECKOV_IMAGE", "bridgecrew/checkov:latest"),
		AnalysisKICSImage:        getEnv("ANALYSIS_KICS_IMAGE", "checkmarx/kics:latest"),
		AnalysisGitleaksImage:    getEnv("ANALYSIS_GITLEAKS_IMAGE", "zricethezav/gitleaks:latest"),
		AnalysisGrypeImage:       getEnv("ANALYSIS_GRYPE_IMAGE", "anchore/grype:latest"),
		AnalysisContainerNetwork: getEnv("ANALYSIS_CONTAINER_NETWORK", "bridge"),
		NVDAPIKey:                getEnv("NVD_API_KEY", ""),
		EPSSEnabled:              getEnvAsBool("EPSS_ENABLED", true),
		KEVURL:                   getEnv("KEV_URL", ""),
		KEVMirrorURL:             getEnv("KEV_MIRROR_URL", ""),
		IntelRefreshInterval:     getEnv("INTEL_REFRESH_INTERVAL", "24h"),
		IntelWorkerConcurrency:   getEnvAsInt("INTEL_WORKER_CONCURRENCY", 4),
		IntelRetryBase:           getEnv("INTEL_RETRY_BASE", "30m"),
		SLACriticalDuration:      getEnv("SLA_CRITICAL_DURATION", "168h"),
		SLAHighDuration:          getEnv("SLA_HIGH_DURATION", "720h"),
		SLAMediumDuration:        getEnv("SLA_MEDIUM_DURATION", "2160h"),
		SLALowDuration:           getEnv("SLA_LOW_DURATION", "4320h"),
		SLABreachInterval:        getEnv("SLA_BREACH_INTERVAL", getEnv("SLA_BREACH_CHECK_INTERVAL", "15m")),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

// getSecureEnv returns env value or generates a random value if not set.
// It logs a warning when using generated values in production.
func getSecureEnv(key string) string {
	value := os.Getenv(key)
	if value != "" {
		return value
	}
	generated := generateRandomString(32)
	log.Printf("WARNING: %s not set, using generated value. Set this in production!", key)
	return generated
}

// getSecureEnvWithDefault returns env value or default, but warns if default is insecure.
func getSecureEnvWithDefault(key, insecureDefault string) string {
	value := os.Getenv(key)
	if value != "" {
		return value
	}
	log.Printf("WARNING: %s not set, using insecure default '%s'. Set this in production!", key, insecureDefault)
	return insecureDefault
}

func generateRandomString(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		panic(fmt.Sprintf("failed to generate random string: %v", err))
	}
	return hex.EncodeToString(bytes)[:length]
}

func getEnvAsBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvAsInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
