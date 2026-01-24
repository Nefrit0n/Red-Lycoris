package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/objectstore"
	"lotus-warden/backend/internal/sbomindex"
	"lotus-warden/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const sbomConsumer = "sbom-worker"

type sbomMessage struct {
	SbomID string `json:"sbom_id"`
}

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
		log.Fatalf("nats connection failed: %v", err)
	}
	defer publisher.Close()

	js := publisher.JetStream()
	if js == nil {
		log.Fatalf("jetstream unavailable")
	}

	sub, err := js.PullSubscribe(events.SbomIndexRequestedSubject, sbomConsumer)
	if err != nil {
		log.Fatalf("failed to subscribe: %v", err)
	}

	for {
		msgs, err := sub.Fetch(1, nats.MaxWait(5*time.Second))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				continue
			}
			log.Printf("fetch error: %v", err)
			continue
		}
		for _, msg := range msgs {
			if err := handleMessage(context.Background(), msg, db, store); err != nil {
				log.Printf("sbom index failed: %v", err)
			}
		}
	}
}

func handleMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store) error {
	var payload sbomMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return err
	}
	defer func() { _ = msg.Ack() }()

	sbomID, err := uuid.Parse(payload.SbomID)
	if err != nil {
		return err
	}

	return sbomindex.IndexSbom(ctx, db, store, sbomID)
}
