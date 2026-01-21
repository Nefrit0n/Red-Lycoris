package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/storage"
)

const migrationsLockKey int64 = 719273194 // любое фиксированное число

func main() {
	cfg := config.Load()

	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := withAdvisoryLock(ctx, db, migrationsLockKey, func() error {
		if err := storage.RunMigrations(db); err != nil {
			return err
		}
		// root user — это тоже init
		if err := storage.EnsureRootUserExists(ctx, db, cfg.RootEmail, cfg.RootPassword); err != nil {
			return fmt.Errorf("root user initialization failed: %w", err)
		}
		return nil
	}); err != nil {
		log.Fatalf("init failed: %v", err)
	}

	log.Printf("migrations OK")
}

func withAdvisoryLock(ctx context.Context, db *sql.DB, key int64, fn func() error) error {
	if _, err := db.ExecContext(ctx, "SELECT pg_advisory_lock($1)", key); err != nil {
		return err
	}
	defer func() { _, _ = db.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", key) }()
	return fn()
}
