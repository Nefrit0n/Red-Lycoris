package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"hash/fnv"
	"log"
	"os"
	"strconv"
	"time"

	"lotus-warden/backend/internal/config"
	"lotus-warden/backend/internal/events"
	"lotus-warden/backend/internal/intel"
	"lotus-warden/backend/internal/storage"

	"github.com/nats-io/nats.go"
)

const intelConsumer = "intel-worker"

func main() {
	cfg := config.Load()

	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	publisher, err := events.NewPublisher(cfg.NatsURL)
	if err != nil {
		log.Fatalf("nats connection failed: %v", err)
	}
	defer publisher.Close()

	js := publisher.JetStream()
	if js == nil {
		log.Fatalf("jetstream unavailable")
	}

	sub, err := js.PullSubscribe(events.IntelEnrichRequested, intelConsumer)
	if err != nil {
		log.Fatalf("failed to subscribe: %v", err)
	}

	service := intel.NewService(intel.Config{
		NVDAPIKey:           cfg.NVDAPIKey,
		EPSSDisabled:        !cfg.EPSSEnabled,
		KEVURL:              cfg.KEVURL,
		KEVMirrorURL:        cfg.KEVMirrorURL,
		RefreshInterval:     parseDuration(cfg.IntelRefreshInterval, 24*time.Hour),
		ProviderConcurrency: cfg.IntelWorkerConcurrency,
	})

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
			if err := handleIntelMessage(context.Background(), msg, db, publisher, service, cfg); err != nil {
				log.Printf("intel job failed: %v", err)
			}
		}
	}
}

func handleIntelMessage(ctx context.Context, msg *nats.Msg, db *sql.DB, publisher *events.Publisher, service *intel.Service, cfg config.Config) error {
	defer func() { _ = msg.Ack() }()

	var payload events.IntelEnrichRequest
	if err := json.Unmarshal(msg.Data, &payload); err != nil {
		return err
	}
	if len(payload.Identifiers) == 0 {
		return nil
	}

	now := time.Now().UTC()
	for _, identifier := range payload.Identifiers {
		if identifier == "" {
			continue
		}
		locked, err := tryAdvisoryLock(ctx, db, identifier)
		if err != nil || !locked {
			continue
		}
		func() {
			defer func() { _ = releaseAdvisoryLock(ctx, db, identifier) }()

			status, err := storage.GetVulnIntelStatus(ctx, db, identifier)
			if err != nil {
				log.Printf("intel status error: %v", err)
				return
			}
			if !service.ShouldRefresh(status, now) {
				return
			}

			record, err := service.Enrich(ctx, identifier)
			if err != nil {
				nextRetry := now.Add(parseDuration(cfg.IntelRetryBase, 30*time.Minute))
				_ = storage.UpdateVulnIntelError(ctx, db, identifier, record.SourceVersion, err.Error(), nextRetry)
				return
			}
			record.LastRefreshedAt = &now
			record.NextRetryAt = nil
			record.LastError = nil
			if err := storage.UpsertVulnIntel(ctx, db, record); err != nil {
				log.Printf("intel upsert error: %v", err)
				return
			}
			if publisher != nil {
				_ = publisher.PublishJSON(ctx, events.IntelEnriched, map[string]any{
					"identifier": identifier,
					"updated_at": now.Format(time.RFC3339),
				})
			}
		}()
	}
	return nil
}

func tryAdvisoryLock(ctx context.Context, db *sql.DB, identifier string) (bool, error) {
	var locked bool
	if err := db.QueryRowContext(ctx, "SELECT pg_try_advisory_lock($1)", hashIdentifier(identifier)).Scan(&locked); err != nil {
		return false, err
	}
	return locked, nil
}

func releaseAdvisoryLock(ctx context.Context, db *sql.DB, identifier string) error {
	_, err := db.ExecContext(ctx, "SELECT pg_advisory_unlock($1)", hashIdentifier(identifier))
	return err
}

func hashIdentifier(identifier string) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(identifier))
	return int64(hasher.Sum64())
}

func parseDuration(raw string, fallback time.Duration) time.Duration {
	if raw == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(raw)
	if err == nil {
		return parsed
	}
	if seconds, err := strconv.Atoi(raw); err == nil {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}

func init() {
	if os.Getenv("GODEBUG") == "" {
		_ = os.Setenv("GODEBUG", "http2client=0")
	}
}
