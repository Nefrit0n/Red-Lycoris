package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"hash/fnv"
	"log"
	"math/big"
	"os"
	"strconv"
	"time"

	"red-lycoris/backend/internal/config"
	"red-lycoris/backend/internal/events"
	"red-lycoris/backend/internal/intel"
	"red-lycoris/backend/internal/storage"

	"github.com/nats-io/nats.go"
)

const intelConsumer = "intel-worker-enrich-v1"
const intelBackoffCap = 6

const maxInt64 = int64(^uint64(0) >> 1)

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

	if err := events.EnsureIntelConsumer(js, intelConsumer); err != nil {
		log.Fatalf("failed to ensure intel consumer: %v", err)
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
	var epssTouched int
	var kevTouched int
	var nvdTouched int
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

			record, skipped, err := service.Enrich(ctx, identifier)
			if err != nil {
				failCount := 1
				if status != nil {
					failCount = status.FailCount + 1
				}
				backoff := computeBackoff(parseDuration(cfg.IntelRetryBase, 30*time.Minute), failCount)
				nextRetry := now.Add(backoff)
				log.Printf("intel enrich failed for %s: %v (fail_count=%d retry_in=%s)", identifier, err, failCount, backoff)
				_ = storage.UpdateVulnIntelError(ctx, db, identifier, record.SourceVersion, err.Error(), nextRetry, failCount)
				return
			}
			if skipped {
				log.Printf("intel enrich skipped for %s (unsupported identifier)", identifier)
			}
			record.LastRefreshedAt = &now
			record.NextRetryAt = nil
			record.LastError = nil
			record.FailCount = 0
			if err := storage.UpsertVulnIntel(ctx, db, record); err != nil {
				log.Printf("intel upsert error: %v", err)
				return
			}
			if record.NVDPayload != nil {
				nvdTouched++
			}
			if record.EPSSPayload != nil {
				epssTouched++
			}
			if record.KEVPayload != nil {
				kevTouched++
			}
		}()
	}
	if publisher != nil && (epssTouched > 0 || kevTouched > 0 || nvdTouched > 0) {
		updatedAt := time.Now().UTC()
		date := updatedAt.Format("2006-01-02")
		if epssTouched > 0 {
			_ = publisher.PublishJSON(ctx, events.IntelEPSSRefreshedSubject, events.IntelEPSSRefreshedEvent{
				Date:             date,
				UpdatedAt:        updatedAt,
				CountRowsTouched: epssTouched,
			})
		}
		if kevTouched > 0 {
			_ = publisher.PublishJSON(ctx, events.IntelKEVRefreshedSubject, events.IntelKEVRefreshedEvent{
				Date:             date,
				UpdatedAt:        updatedAt,
				CountRowsTouched: kevTouched,
			})
		}
		if nvdTouched > 0 {
			_ = publisher.PublishJSON(ctx, events.IntelNVDRefreshedSubject, events.IntelNVDRefreshedEvent{
				From:             updatedAt,
				To:               updatedAt,
				UpdatedAt:        updatedAt,
				CountRowsTouched: nvdTouched,
			})
		}
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
	sum := hasher.Sum64() & uint64(maxInt64)
	parsed, err := strconv.ParseInt(strconv.FormatUint(sum, 10), 10, 64)
	if err != nil {
		return 0
	}
	return parsed
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

func computeBackoff(base time.Duration, failCount int) time.Duration {
	if base <= 0 {
		return 0
	}
	if failCount < 1 {
		failCount = 1
	}
	exp := failCount
	if exp > intelBackoffCap {
		exp = intelBackoffCap
	}
	backoff := base * time.Duration(1<<exp)
	jitter := randomDuration(base)
	return backoff + jitter
}

func randomDuration(max time.Duration) time.Duration {
	if max <= 0 {
		return 0
	}
	value, err := rand.Int(rand.Reader, big.NewInt(max.Nanoseconds()))
	if err != nil {
		return 0
	}
	return time.Duration(value.Int64())
}

func init() {
	if os.Getenv("GODEBUG") == "" {
		_ = os.Setenv("GODEBUG", "http2client=0")
	}
}
