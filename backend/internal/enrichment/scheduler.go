package enrichment

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type syncerConfig struct {
	syncer   Syncer
	interval time.Duration
}

// Scheduler управляет периодическим запуском синхронизаторов.
type Scheduler struct {
	pool    *pgxpool.Pool
	syncers []syncerConfig
	mu      sync.Mutex
}

func NewScheduler(pool *pgxpool.Pool) *Scheduler {
	return &Scheduler{pool: pool}
}

// Register добавляет синхронизатор с заданным интервалом.
func (s *Scheduler) Register(syncer Syncer, interval time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.syncers = append(s.syncers, syncerConfig{syncer: syncer, interval: interval})
}

// GetSyncer возвращает синхронизатор по имени.
func (s *Scheduler) GetSyncer(name string) Syncer {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, sc := range s.syncers {
		if sc.syncer.Name() == name {
			return sc.syncer
		}
	}
	return nil
}

// Start запускает все синхронизаторы в горутинах.
// Первый запуск происходит немедленно, затем по тикеру.
// Останавливается при отмене контекста.
func (s *Scheduler) Start(ctx context.Context) {
	s.mu.Lock()
	configs := make([]syncerConfig, len(s.syncers))
	copy(configs, s.syncers)
	s.mu.Unlock()

	for _, sc := range configs {
		go s.runLoop(ctx, sc)
	}

	slog.Info("enrichment scheduler started", "syncers", len(configs))
}

func (s *Scheduler) runLoop(ctx context.Context, sc syncerConfig) {
	name := sc.syncer.Name()
	slog.Info("scheduler: starting syncer", "source", name, "interval", sc.interval)

	// Первый запуск сразу
	if err := RunSync(ctx, sc.syncer, s.pool); err != nil {
		slog.Error("scheduler: initial sync failed", "source", name, "error", err)
	}

	ticker := time.NewTicker(sc.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler: stopping syncer", "source", name)
			return
		case <-ticker.C:
			if err := RunSync(ctx, sc.syncer, s.pool); err != nil {
				slog.Error("scheduler: sync failed", "source", name, "error", err)
			}
		}
	}
}
