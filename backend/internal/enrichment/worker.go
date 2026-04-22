package enrichment

import (
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const (
	StreamName    = "enrichment:pending"
	ConsumerGroup = "enrichment-workers"
)

var streamBaseline atomic.Int64

// PublishEnrichment добавляет finding ID в Redis Stream для асинхронного обогащения.
func PublishEnrichment(ctx context.Context, rdb *redis.Client, findingIDs ...uuid.UUID) error {
	pipe := rdb.Pipeline()
	for _, id := range findingIDs {
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: StreamName,
			Values: map[string]any{"finding_id": id.String()},
		})
	}
	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("enrichment.PublishEnrichment: %w", err)
	}
	return nil
}

// Worker обрабатывает сообщения из Redis Stream и обогащает findings.
type Worker struct {
	pool         *pgxpool.Pool
	rdb          *redis.Client
	consumerName string
}

// StartWorkers запускает N воркеров в горутинах. Создаёт consumer group если её нет.
func StartWorkers(ctx context.Context, pool *pgxpool.Pool, rdb *redis.Client, count int) {
	streamBaseline.Store(readStreamLength(ctx, rdb))

	// Создаём consumer group (игнорируем BUSYGROUP если уже существует)
	err := rdb.XGroupCreateMkStream(ctx, StreamName, ConsumerGroup, "0").Err()
	if err != nil && !isBusyGroup(err) {
		slog.Error("failed to create consumer group", "error", err)
		return
	}

	for i := range count {
		w := &Worker{
			pool:         pool,
			rdb:          rdb,
			consumerName: fmt.Sprintf("worker-%d", i),
		}
		go w.run(ctx)
	}

	slog.Info("enrichment workers started", "count", count)
}

func readStreamLength(ctx context.Context, rdb *redis.Client) int64 {
	n, err := rdb.XLen(ctx, StreamName).Result()
	if err != nil {
		return 0
	}
	return n
}

func streamLagBaseline() int64 {
	return streamBaseline.Load()
}

func (w *Worker) run(ctx context.Context) {
	slog.Info("enrichment worker started", "consumer", w.consumerName)

	// Сначала обработать pending (незакоммиченные) сообщения
	w.processPending(ctx)

	for {
		select {
		case <-ctx.Done():
			slog.Info("enrichment worker stopping", "consumer", w.consumerName)
			return
		default:
		}

		// Читаем новые сообщения (блокируемся на 5 секунд)
		streams, err := w.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    ConsumerGroup,
			Consumer: w.consumerName,
			Streams:  []string{StreamName, ">"},
			Count:    10,
			Block:    5 * time.Second,
		}).Result()

		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			slog.Error("enrichment worker: xreadgroup error", "consumer", w.consumerName, "error", err)
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				w.processMessage(ctx, msg)
			}
		}
	}
}

// processPending обрабатывает сообщения, которые были получены но не подтверждены (crash recovery).
func (w *Worker) processPending(ctx context.Context) {
	for {
		streams, err := w.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    ConsumerGroup,
			Consumer: w.consumerName,
			Streams:  []string{StreamName, "0"},
			Count:    10,
		}).Result()
		if err != nil || len(streams) == 0 {
			return
		}

		messages := streams[0].Messages
		if len(messages) == 0 {
			return
		}

		for _, msg := range messages {
			w.processMessage(ctx, msg)
		}
	}
}

func (w *Worker) processMessage(ctx context.Context, msg redis.XMessage) {
	findingIDStr, ok := msg.Values["finding_id"].(string)
	if !ok {
		slog.Warn("enrichment worker: invalid message", "id", msg.ID)
		w.ack(ctx, msg.ID)
		return
	}

	findingID, err := uuid.Parse(findingIDStr)
	if err != nil {
		slog.Warn("enrichment worker: invalid finding_id", "value", findingIDStr)
		w.ack(ctx, msg.ID)
		return
	}

	if err := EnrichFinding(ctx, w.pool, findingID); err != nil {
		slog.Error("enrichment worker: enrich failed",
			"finding_id", findingID,
			"msg_id", msg.ID,
			"error", err,
		)
		// Не делаем XACK — сообщение останется в pending для retry
		return
	}

	w.ack(ctx, msg.ID)
}

func (w *Worker) ack(ctx context.Context, msgID string) {
	if err := w.rdb.XAck(ctx, StreamName, ConsumerGroup, msgID).Err(); err != nil {
		slog.Error("enrichment worker: xack failed", "msg_id", msgID, "error", err)
	}
}

func isBusyGroup(err error) bool {
	return err != nil && err.Error() == "BUSYGROUP Consumer Group name already exists"
}
