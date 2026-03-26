package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"red-lycoris/backend/internal/config"
	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/metrics"
	"red-lycoris/backend/internal/objectstore"
	"red-lycoris/backend/internal/sbomindex"
	"red-lycoris/backend/internal/storage"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

const sbomConsumer = "sbom-worker"

type sbomMessage struct {
	SbomID    string `json:"sbom_id"`
	ProductID string `json:"product_id"`
	ObjectKey string `json:"object_key"`
	Format    string `json:"format"`
	SHA256    string `json:"sha256"`
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

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	log.Printf("sbom worker ready, waiting for messages")
	for {
		select {
		case <-ctx.Done():
			log.Printf("sbom worker shutting down")
			return
		default:
		}
		msgs, err := sub.Fetch(1, nats.MaxWait(5*time.Second))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				continue
			}
			log.Printf("fetch error: %v", err)
			continue
		}
		for _, msg := range msgs {
			if err := handleMessage(ctx, msg, db, store); err != nil {
				log.Printf("sbom index failed: %v", err)
			}
		}
	}
}

func handleMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, store objectstore.Store) error {
	var payload sbomMessage
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		_ = msg.Ack()
		return err
	}

	sbomID, err := uuid.Parse(payload.SbomID)
	if err != nil {
		_ = msg.Ack()
		return err
	}

	start := time.Now()
	log.Printf("sbom index processing sbom_id=%s product_id=%s", sbomID.String(), payload.ProductID)
	err = sbomindex.IndexSbom(ctx, db, store, sbomID)
	duration := time.Since(start)

	sbom, sbomErr := storage.GetSbomByID(ctx, db, sbomID)
	componentCount := 0
	status := "unknown"
	if sbomErr == nil && sbom != nil {
		componentCount = sbom.ComponentCount
		status = sbom.IndexStatus
	}
	if err != nil {
		log.Printf("sbom index failed sbom_id=%s status=%s duration=%s err=%v", sbomID.String(), status, duration, err)
	} else {
		log.Printf("sbom index done sbom_id=%s status=%s components=%d duration=%s", sbomID.String(), status, componentCount, duration)
	}

	metrics.RecordSbomIndexResult(duration, componentCount, err)
	_ = msg.Ack()
	return err
}
