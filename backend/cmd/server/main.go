package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"red-lycoris/backend/internal/config"
	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/metrics"
	"red-lycoris/backend/internal/objectstore"
	"red-lycoris/backend/internal/server"
	"red-lycoris/backend/internal/storage"
)

func main() {
	cfg := config.Load()

	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer func() { _ = db.Close() }()

	store, err := objectstore.NewMinioStore(cfg)
	if err != nil {
		log.Fatalf("object store init failed: %v", err)
	}

	publisher, err := events.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Printf("WARNING: nats connection failed: %v — event-driven workflows will be unavailable", err)
		publisher = nil
	}

	app := server.NewApp(cfg, db, publisher, store)

	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go runSLABreachUpdater(stopCtx, db, parseDuration(cfg.SLABreachInterval, 15*time.Minute))

	addr := fmt.Sprintf(":%s", cfg.AppPort)

	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Listen(addr)
	}()

	select {
	case <-stopCtx.Done():
		log.Printf("shutdown signal received")
	case err := <-errCh:
		if err != nil {
			log.Printf("server stopped with error: %v", err)
		}
	}

	// Graceful shutdown: first stop accepting new requests, then drain NATS.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}

	// Drain NATS after server shutdown so in-flight handlers can finish publishing.
	if publisher != nil {
		if err := publisher.Drain(); err != nil {
			log.Printf("nats drain error: %v", err)
		}
	}
}

func runSLABreachUpdater(ctx context.Context, db *sql.DB, interval time.Duration) {
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	const maxBackoff = 5 * time.Minute
	consecutiveErrors := 0

	for {
		now := time.Now()
		updated, err := storage.MarkSLABreaches(ctx, db, now)
		if err != nil {
			consecutiveErrors++
			backoff := time.Duration(consecutiveErrors) * 30 * time.Second
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			log.Printf("sla breach update failed (attempt %d, backoff %s): %v", consecutiveErrors, backoff, err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
				continue
			}
		} else {
			consecutiveErrors = 0
			metrics.RecordSLABreachUpdate(updated, now)
			if updated > 0 {
				log.Printf("sla breach updater marked %d findings", updated)
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func parseDuration(value string, fallback time.Duration) time.Duration {
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
