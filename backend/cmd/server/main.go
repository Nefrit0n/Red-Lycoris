package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/api"
	"redlycoris/internal/config"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/enrichment/bdu"
	"redlycoris/internal/enrichment/cpe"
	"redlycoris/internal/enrichment/cwe"
	"redlycoris/internal/enrichment/epss"
	"redlycoris/internal/enrichment/kev"
	"redlycoris/internal/enrichment/nvd"
	"redlycoris/internal/enrichment/osv"
	"redlycoris/internal/storage"
)

var version = "dev"

func main() {
	startTime := time.Now()

	cfg := config.Load()

	var logLevel slog.Level
	switch cfg.LogLevel {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// PostgreSQL
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to create pgx pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to PostgreSQL")

	// Migrations
	m, err := migrate.New("file://migrations", cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to init migrations", "error", err)
		os.Exit(1)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		slog.Error("failed to close migration source", "error", srcErr)
	}
	if dbErr != nil {
		slog.Error("failed to close migration db", "error", dbErr)
	}
	slog.Info("migrations applied")

	usersRepo := storage.NewUsersRepo(pool)
	sessionsRepo := storage.NewSessionsRepo(pool)
	count, err := usersRepo.Count(ctx)
	if err == nil && count == 0 {
		slog.Warn("no users found in database",
			"hint", "create first admin: docker compose exec backend /app/admin create-user --admin --email=you@company --password=...",
		)
	}

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				n, err := sessionsRepo.DeleteExpired(ctx)
				if err == nil && n > 0 {
					slog.Info("expired sessions cleaned", "count", n)
				}
			}
		}
	}()

	// Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to parse redis URL", "error", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(redisOpts)
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Error("failed to ping redis", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to Redis")

	// Enrichment workers (Redis Streams consumer group)
	enrichment.StartWorkers(ctx, pool, rdb, 3)

	// Enrichment scheduler
	routerOpts := []api.RouterOption{
		api.WithEnv(cfg.Env),
		api.WithVersion(version),
		api.WithStartTime(startTime),
		api.WithTrustProxy(cfg.TrustProxy),
		api.WithCookieSecure(cfg.CookieSecure),
		api.WithSessionDuration(cfg.SessionDuration),
	}
	if cfg.EnrichmentEnabled {
		scheduler := enrichment.NewScheduler(pool)
		scheduler.Register(nvd.NewSyncer(pool, cfg.NVDAPIKey), 2*time.Hour)
		scheduler.Register(epss.NewSyncer(pool), 24*time.Hour)
		scheduler.Register(kev.NewSyncer(pool), 6*time.Hour)
		scheduler.Register(cwe.NewSyncer(pool), 30*24*time.Hour)
		scheduler.Register(cpe.NewSyncer(pool, cfg.NVDAPIKey), 7*24*time.Hour)
		scheduler.Register(bdu.NewSyncer(pool), 7*24*time.Hour)
		scheduler.Register(osv.NewSyncer(pool), 24*time.Hour)
		scheduler.Start(ctx)

		routerOpts = append(routerOpts, api.WithScheduler(scheduler))
	}

	// Materialized view refresher (every 5 minutes)
	storage.StartMatViewRefresher(ctx, pool, 5*time.Minute)

	// Router
	handler := api.NewRouter(pool, rdb, cfg.CORSOrigins, routerOpts...)

	// HTTP server
	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("starting server", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}
	slog.Info("server stopped")
}
