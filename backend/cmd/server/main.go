package main

import (
	"context"
	"fmt"
	"log"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/objectstore"
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

	store, err := objectstore.NewMinioStore(cfg)
	if err != nil {
		log.Fatalf("object store init failed: %v", err)
	}

	publisher, err := events.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Printf("nats connection failed: %v", err)
	} else {
		defer publisher.Close()
	}

	app := server.NewApp(cfg, db, publisher, store)
	log.Fatal(app.Listen(fmt.Sprintf(":%s", cfg.AppPort)))
}
