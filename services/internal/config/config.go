package config

import "os"

type ServiceConfig struct {
	ServiceName string
	HTTPAddr    string
	NatsURL     string
	PostgresDSN string
}

func GetEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func Load(serviceName string) ServiceConfig {
	return ServiceConfig{
		ServiceName: serviceName,
		HTTPAddr:    GetEnv("HTTP_ADDR", ":8080"),
		NatsURL:     GetEnv("NATS_URL", "nats://nats:4222"),
		PostgresDSN: GetEnv("POSTGRES_DSN", "postgres://asoc:asoc@postgres:5432/asoc?sslmode=disable"),
	}
}
