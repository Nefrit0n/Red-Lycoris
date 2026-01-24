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
	defer func() { _ = db.Close() }()

	store, err := objectstore.NewMinioStore(cfg)
	if err != nil {
		log.Fatalf("object store init failed: %v", err)
	}

	publisher, err := events.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Printf("nats connection failed: %v", err)
		publisher = nil
	} else {
		defer publisher.Close() // лучше Drain() на shutdown, см. ниже
	}

	app := server.NewApp(cfg, db, publisher, store)

	// Контекст завершения по SIGINT/SIGTERM (docker stop -> SIGTERM)
	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go runSLABreachUpdater(stopCtx, db, parseDuration(cfg.SLABreachCheckInterval, 15*time.Minute))

	addr := fmt.Sprintf(":%s", cfg.AppPort)

	// Запускаем сервер асинхронно, чтобы main мог ждать сигнал
	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Listen(addr)
	}()

	select {
	case <-stopCtx.Done():
		log.Printf("shutdown signal received")
	case err := <-errCh:
		// Сервер упал сам по себе
		if err != nil {
			log.Printf("server stopped with error: %v", err)
		}
	}

	// Даём время на graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Fiber рекомендует shutdown через Shutdown/ShutdownWithContext
	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func runSLABreachUpdater(ctx context.Context, db *sql.DB, interval time.Duration) {
	if interval <= 0 {
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		now := time.Now().UTC()
		if _, err := storage.MarkSLABreaches(ctx, db, now); err != nil {
			log.Printf("sla breach update failed: %v", err)
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
