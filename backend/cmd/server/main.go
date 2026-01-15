package main

import (
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

	if err := storage.RunMigrations(db, "file://migrations"); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	app := server.NewApp()
	log.Fatal(app.Listen(fmt.Sprintf(":%s", cfg.AppPort)))
}
