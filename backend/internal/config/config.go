package config

import "os"

type Config struct {
	AppPort                  string
	DBHost                   string
	DBPort                   string
	DBUser                   string
	DBPass                   string
	DBName                   string
	DBSSL                    string
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
	AnalysisSemgrepImage     string
	AnalysisTrivyImage       string
	AnalysisContainerNetwork string
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
		RedisURL:                 getEnv("REDIS_URL", "redis://localhost:6379"),
		NatsURL:                  getEnv("NATS_URL", "nats://localhost:4222"),
		ObjectStoreEndpoint:      getEnv("OBJECT_STORE_ENDPOINT", "localhost:9000"),
		ObjectStoreAccessKey:     getEnv("OBJECT_STORE_ACCESS_KEY", "minioadmin"),
		ObjectStoreSecretKey:     getEnv("OBJECT_STORE_SECRET_KEY", "minioadmin"),
		ObjectStoreBucket:        getEnv("OBJECT_STORE_BUCKET", "lotus-warden"),
		ObjectStoreUseSSL:        getEnv("OBJECT_STORE_USE_SSL", "false"),
		JWTSecret:                getEnv("JWT_SECRET", "change-me"),
		RootEmail:                getEnv("ROOT_EMAIL", "root@localhost"),
		RootPassword:             getEnv("ROOT_PASSWORD", "root"),
		AnalysisMaxArchiveBytes:  getEnv("ANALYSIS_MAX_ARCHIVE_BYTES", "104857600"),
		AnalysisMaxExtractBytes:  getEnv("ANALYSIS_MAX_EXTRACT_BYTES", "524288000"),
		AnalysisTempDir:          getEnv("ANALYSIS_TEMP_DIR", "/tmp/lotus-warden-analysis"),
		AnalysisScannerTimeout:   getEnv("ANALYSIS_SCANNER_TIMEOUT", "20m"),
		AnalysisCleanupInterval:  getEnv("ANALYSIS_CLEANUP_INTERVAL", "1h"),
		AnalysisCleanupTTL:       getEnv("ANALYSIS_CLEANUP_TTL", "24h"),
		AnalysisSemgrepImage:     getEnv("ANALYSIS_SEMGREP_IMAGE", "semgrep/semgrep:latest"),
		AnalysisTrivyImage:       getEnv("ANALYSIS_TRIVY_IMAGE", "aquasec/trivy:latest"),
		AnalysisContainerNetwork: getEnv("ANALYSIS_CONTAINER_NETWORK", "none"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
