package config

import "os"

type Config struct {
	AppPort  string
	DBHost   string
	DBPort   string
	DBUser   string
	DBPass   string
	DBName   string
	DBSSL    string
	RedisURL string
	JWTSecret string
}

func Load() Config {
	return Config{
		AppPort:  getEnv("APP_PORT", "8080"),
		DBHost:   getEnv("DB_HOST", "localhost"),
		DBPort:   getEnv("DB_PORT", "5432"),
		DBUser:   getEnv("DB_USER", "postgres"),
		DBPass:   getEnv("DB_PASSWORD", "postgres"),
		DBName:   getEnv("DB_NAME", "lotus_warden"),
		DBSSL:    getEnv("DB_SSLMODE", "disable"),
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret: getEnv("JWT_SECRET", "change-me"),
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
