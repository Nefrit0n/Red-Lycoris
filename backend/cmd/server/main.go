package main

import (
	"context"
	"fmt"
	"log"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/server"
	"lotus-warden/backend/internal/storage"
)

func main() {
	cfg := config.Load()

	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	if err := storage.RunMigrations(db); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	if err := storage.EnsureRootUserExists(context.Background(), db, cfg.RootEmail, cfg.RootPassword); err != nil {
		log.Fatalf("root user initialization failed: %v", err)
	}

	app := server.NewApp(cfg, db)
	log.Fatal(app.Listen(fmt.Sprintf(":%s", cfg.AppPort)))
}
