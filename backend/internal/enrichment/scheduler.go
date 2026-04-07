package enrichment

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// Достаточно большой таймаут, чтобы не убивать длинные full sync'и,
	// но при этом не держать зависшую задачу вечно.
	defaultRunTimeout = 4 * time.Hour
)

var ErrAlreadyRunning = errors.New("sync already running")

type syncerConfig struct {
	syncer   Syncer
	interval time.Duration
}

// Scheduler управляет периодическим запуском синхронизаторов.
type Scheduler struct {
	pool    *pgxpool.Pool
	syncers []syncerConfig

	mu           sync.Mutex
	running      map[string]bool
	runningSince map[string]time.Time
}

func NewScheduler(pool *pgxpool.Pool) *Scheduler {
	return &Scheduler{
		pool:         pool,
		running:      make(map[string]bool),
		runningSince: make(map[string]time.Time),
	}
}

// Register добавляет синхронизатор с заданным интервалом.
func (s *Scheduler) Register(syncer Syncer, interval time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.syncers = append(s.syncers, syncerConfig{
		syncer:   syncer,
		interval: interval,
	})
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

// Start запускает периодические sync loop-и.
// ВАЖНО: на старте немедленный sync не выполняется.
// Первый запуск произойдёт только по тикеру или вручную через TriggerSync.
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
	slog.Info("scheduler: registered syncer", "source", name, "interval", sc.interval)

	ticker := time.NewTicker(sc.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler: stopping syncer", "source", name)
			return

		case <-ticker.C:
			if err := s.runIfNotRunning(ctx, sc.syncer); err != nil {
				if errors.Is(err, ErrAlreadyRunning) {
					slog.Warn("scheduler: periodic sync skipped because already running", "source", name)
					continue
				}

				slog.Error("scheduler: sync failed", "source", name, "error", err)
			}
		}
	}
}

// TriggerSync запускает sync вручную по имени источника.
// Если sync уже выполняется, возвращает ErrAlreadyRunning.
func (s *Scheduler) TriggerSync(ctx context.Context, name string) error {
	s.mu.Lock()
	var syncer Syncer
	for _, sc := range s.syncers {
		if sc.syncer.Name() == name {
			syncer = sc.syncer
			break
		}
	}
	s.mu.Unlock()

	if syncer == nil {
		return fmt.Errorf("unknown sync source: %s", name)
	}

	return s.runIfNotRunning(ctx, syncer)
}

func (s *Scheduler) runIfNotRunning(ctx context.Context, syncer Syncer) (err error) {
	name := syncer.Name()
	now := time.Now()

	s.mu.Lock()
	if s.running[name] {
		startedAt := s.runningSince[name]
		s.mu.Unlock()

		fields := []any{"source", name}
		if !startedAt.IsZero() {
			fields = append(fields, "running_for", time.Since(startedAt).String())
		}

		slog.Warn("scheduler: sync already running", fields...)
		return ErrAlreadyRunning
	}

	s.running[name] = true
	s.runningSince[name] = now
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.running, name)
		delete(s.runningSince, name)
		s.mu.Unlock()
	}()

	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic in sync %s: %v", name, r)
			slog.Error("scheduler: panic recovered", "source", name, "panic", r)
		}
	}()

	runCtx, cancel := context.WithTimeout(ctx, defaultRunTimeout)
	defer cancel()

	startedAt := time.Now()
	slog.Info("scheduler: sync started", "source", name, "timeout", defaultRunTimeout.String())

	err = RunSync(runCtx, syncer, s.pool)
	duration := time.Since(startedAt)

	switch {
	case err == nil:
		slog.Info("scheduler: sync finished", "source", name, "duration", duration.String())

	case errors.Is(err, context.DeadlineExceeded):
		slog.Error("scheduler: sync timed out", "source", name, "duration", duration.String(), "error", err)

	case errors.Is(err, context.Canceled):
		slog.Warn("scheduler: sync canceled", "source", name, "duration", duration.String(), "error", err)

	default:
		slog.Error("scheduler: sync finished with error", "source", name, "duration", duration.String(), "error", err)
	}

	return err
}
