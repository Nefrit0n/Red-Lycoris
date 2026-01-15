package main

import (
	"log"

	"lotus-warden/backend/internal/config"
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

	log.Println("migrations applied")
}
