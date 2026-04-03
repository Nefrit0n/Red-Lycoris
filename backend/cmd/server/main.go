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

	"vulnscope/internal/api"
	"vulnscope/internal/config"
	"vulnscope/internal/enrichment"
	"vulnscope/internal/enrichment/cpe"
	"vulnscope/internal/enrichment/cwe"
	"vulnscope/internal/enrichment/epss"
	"vulnscope/internal/enrichment/kev"
	"vulnscope/internal/enrichment/nvd"
)

func main() {
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

	// Enrichment scheduler
	var routerOpts []api.RouterOption
	if cfg.EnrichmentEnabled {
		scheduler := enrichment.NewScheduler(pool)
		scheduler.Register(nvd.NewSyncer(pool, cfg.NVDAPIKey), 2*time.Hour)
		scheduler.Register(epss.NewSyncer(pool), 24*time.Hour)
		scheduler.Register(kev.NewSyncer(pool), 6*time.Hour)
		scheduler.Register(cwe.NewSyncer(pool), 30*24*time.Hour)
		scheduler.Register(cpe.NewSyncer(pool, cfg.NVDAPIKey), 7*24*time.Hour)
		scheduler.Start(ctx)
		slog.Info("enrichment scheduler started")
		routerOpts = append(routerOpts, api.WithScheduler(scheduler))
	}

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
