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
			log.Printf("postgres ready (attempt %d)", i)
			return db, nil
		}

		lastErr = err
		log.Printf("waiting for postgres (%d/10): %v", i, err)
		time.Sleep(2 * time.Second)
	}

	return nil, fmt.Errorf("postgres not ready after retries: %w", lastErr)
}
