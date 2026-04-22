package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"redlycoris/internal/api"
	"redlycoris/internal/audit"
	"redlycoris/internal/auth"
	"redlycoris/internal/config"
	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/enrichment/bdu"
	"redlycoris/internal/enrichment/cpe"
	"redlycoris/internal/enrichment/cwe"
	"redlycoris/internal/enrichment/epss"
	"redlycoris/internal/enrichment/kev"
	"redlycoris/internal/enrichment/nvd"
	"redlycoris/internal/enrichment/osv"
	"redlycoris/internal/observability"
	"redlycoris/internal/storage"
	buildversion "redlycoris/internal/version"
)

var version = "dev"
var commit = "unknown"
var date = "unknown"

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

	resolvedVersion := buildversion.Version
	if version != "dev" {
		resolvedVersion = version
	}
	resolvedCommit := buildversion.Commit
	if commit != "unknown" {
		resolvedCommit = commit
	}
	resolvedDate := buildversion.Date
	if date != "unknown" {
		resolvedDate = date
	}
	obs := observability.New(resolvedVersion, resolvedCommit, resolvedDate)

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
	obs.StartDBPoolMetrics(ctx.Done(), pool, 15*time.Second)

	auditRepo := storage.NewAuditLogRepo(pool)
	auditWriter := audit.NewWriter(auditRepo)

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

	ensurePartitions := func() {
		now := time.Now().UTC()
		for _, m := range []time.Time{now, now.AddDate(0, 1, 0)} {
			if err := auditRepo.EnsurePartition(ctx, m); err != nil {
				slog.Error("audit: ensure partition failed", "error", err, "month", m)
				os.Exit(1)
			}
		}
	}
	ensurePartitions()

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ensurePartitions()
			}
		}
	}()

	usersRepo := storage.NewUsersRepo(pool)
	sessionsRepo := storage.NewSessionsRepo(pool)
	if err := ensureBootstrapAdmin(ctx, usersRepo, cfg); err != nil {
		slog.Error("bootstrap admin ensure failed", "error", err)
		os.Exit(1)
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
	enrichment.StartMetricsCollector(ctx, pool, rdb, obs)

	// Enrichment scheduler
	routerOpts := []api.RouterOption{
		api.WithEnv(cfg.Env),
		api.WithVersion(resolvedVersion),
		api.WithStartTime(startTime),
		api.WithAuditRepo(auditRepo),
		api.WithAuditWriter(auditWriter),
		api.WithTrustProxy(cfg.TrustProxy),
		api.WithCookieSecure(cfg.CookieSecure),
		api.WithSessionDuration(cfg.SessionDuration),
		api.WithObservability(obs),
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
	writerCloseCtx, writerCloseCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer writerCloseCancel()
	if err := auditWriter.Close(writerCloseCtx); err != nil {
		slog.Error("audit writer close", "error", err)
	}
	slog.Info("server stopped")
}

func ensureBootstrapAdmin(ctx context.Context, usersRepo *storage.UsersRepo, cfg *config.Config) error {
	count, err := usersRepo.Count(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	email := strings.ToLower(strings.TrimSpace(cfg.BootstrapAdminEmail))
	password := strings.TrimSpace(cfg.BootstrapAdminPassword)
	fullName := strings.TrimSpace(cfg.BootstrapAdminFullName)
	if fullName == "" {
		fullName = "Administrator"
	}

	if email == "" || password == "" {
		slog.Warn("bootstrap admin skipped: empty email or password with empty users table")
		return nil
	}

	existing, err := usersRepo.GetByEmail(ctx, email)
	if err == nil {
		slog.Info("bootstrap admin already exists, skip create",
			"email", email,
			"user_id", existing.ID.String(),
		)
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	passwordHash, err := auth.Hash(password)
	if err != nil {
		return err
	}

	u := &domain.User{
		Email:        email,
		PasswordHash: passwordHash,
		FullName:     fullName,
		IsActive:     true,
		GlobalRole:   domain.RoleAdmin,
	}
	if err := usersRepo.Create(ctx, u); err != nil {
		return err
	}

	slog.Info("bootstrap admin created",
		"email", email,
		"user_id", u.ID.String(),
		"force_password_change", cfg.BootstrapAdminForcePasswordChange,
	)
	return nil
}
