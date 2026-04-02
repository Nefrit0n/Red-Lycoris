package config

import "os"

type Config struct {
	DatabaseURL string
	RedisURL    string
	ServerHost  string
	ServerPort  string
	LogLevel    string
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://vulnscope:vulnscope@localhost:5432/vulnscope?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),
		ServerHost:  getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
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
