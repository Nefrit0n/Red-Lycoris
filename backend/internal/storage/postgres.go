package storage

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"lotus-warden/backend/internal/config"

	_ "github.com/lib/pq"
)

func Connect(cfg config.Config) (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBUser,
		cfg.DBPass,
		cfg.DBName,
		cfg.DBSSL,
	)

	var lastErr error

	for i := 1; i <= 10; i++ {
		db, err := sql.Open("postgres", dsn)
		if err != nil {
			lastErr = err
			log.Printf("postgres open failed (%d/10): %v", i, err)
			time.Sleep(2 * time.Second)
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err = db.PingContext(ctx)
		cancel()

		if err == nil {
			// Configure connection pool
			db.SetMaxOpenConns(cfg.DBMaxOpenConns)
			db.SetMaxIdleConns(cfg.DBMaxIdleConns)
			db.SetConnMaxLifetime(time.Duration(cfg.DBConnMaxLifetimeMinutes) * time.Minute)
			db.SetConnMaxIdleTime(time.Duration(cfg.DBConnMaxIdleMinutes) * time.Minute)

			log.Printf("postgres ready (attempt %d), pool: maxOpen=%d, maxIdle=%d, maxLifetime=%dm, maxIdleTime=%dm",
				i, cfg.DBMaxOpenConns, cfg.DBMaxIdleConns, cfg.DBConnMaxLifetimeMinutes, cfg.DBConnMaxIdleMinutes)
			return db, nil
		}

		lastErr = err
		log.Printf("waiting for postgres (%d/10): %v", i, err)
		time.Sleep(2 * time.Second)
	}

	return nil, fmt.Errorf("postgres not ready after retries: %w", lastErr)
}

// DBHealth contains database health check results.
type DBHealth struct {
	Status            string `json:"status"`
	Latency           string `json:"latency"`
	OpenConns         int    `json:"open_connections"`
	InUse             int    `json:"in_use"`
	Idle              int    `json:"idle"`
	MaxOpen           int    `json:"max_open"`
	WaitCount         int64  `json:"wait_count"`
	WaitTime          string `json:"wait_time"`
	MaxIdleClosed     int64  `json:"max_idle_closed"`
	MaxLifetimeClosed int64  `json:"max_lifetime_closed"`
}

// HealthCheck performs a database health check and returns stats.
func HealthCheck(ctx context.Context, db *sql.DB) (*DBHealth, error) {
	start := time.Now()

	// Perform a simple query to check connectivity
	var result int
	err := db.QueryRowContext(ctx, "SELECT 1").Scan(&result)
	latency := time.Since(start)

	stats := db.Stats()

	health := &DBHealth{
		Latency:           latency.String(),
		OpenConns:         stats.OpenConnections,
		InUse:             stats.InUse,
		Idle:              stats.Idle,
		MaxOpen:           stats.MaxOpenConnections,
		WaitCount:         stats.WaitCount,
		WaitTime:          stats.WaitDuration.String(),
		MaxIdleClosed:     stats.MaxIdleClosed,
		MaxLifetimeClosed: stats.MaxLifetimeClosed,
	}

	if err != nil {
		health.Status = "unhealthy"
		return health, err
	}

	health.Status = "healthy"
	return health, nil
}

// GetPoolStats returns current connection pool statistics.
func GetPoolStats(db *sql.DB) map[string]interface{} {
	stats := db.Stats()
	return map[string]interface{}{
		"open_connections":    stats.OpenConnections,
		"in_use":              stats.InUse,
		"idle":                stats.Idle,
		"max_open":            stats.MaxOpenConnections,
		"wait_count":          stats.WaitCount,
		"wait_duration_ms":    stats.WaitDuration.Milliseconds(),
		"max_idle_closed":     stats.MaxIdleClosed,
		"max_lifetime_closed": stats.MaxLifetimeClosed,
	}
}
