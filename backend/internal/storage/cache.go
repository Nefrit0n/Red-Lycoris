package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	CacheDashboardStats = "cache:dashboard:stats"
	CacheSyncStatus     = "cache:enrichment:sync_status"
	CacheEnrichmentPfx  = "cache:enrichment:finding:"

	TTLDashboardStats = 60 * time.Second
	TTLSyncStatus     = 30 * time.Second
	TTLEnrichment     = 5 * time.Minute
)

// CacheGet пытается прочитать значение из Redis-кэша. Возвращает false если кэш пуст или ошибка.
func CacheGet(ctx context.Context, rdb *redis.Client, key string, dest any) bool {
	data, err := rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	if err := json.Unmarshal(data, dest); err != nil {
		slog.Error("cache unmarshal failed", "key", key, "error", err)
		return false
	}
	return true
}

// CacheSet сохраняет значение в Redis-кэш с заданным TTL.
func CacheSet(ctx context.Context, rdb *redis.Client, key string, val any, ttl time.Duration) {
	data, err := json.Marshal(val)
	if err != nil {
		slog.Error("cache marshal failed", "key", key, "error", err)
		return
	}
	if err := rdb.Set(ctx, key, data, ttl).Err(); err != nil {
		slog.Error("cache set failed", "key", key, "error", err)
	}
}

// CacheInvalidateEnrichment удаляет кэш enrichment для конкретного finding.
func CacheInvalidateEnrichment(ctx context.Context, rdb *redis.Client, findingID string) {
	key := CacheEnrichmentPfx + findingID
	if err := rdb.Del(ctx, key).Err(); err != nil {
		slog.Error("cache invalidate failed", "key", key, "error", err)
	}
}

// EnrichmentCacheKey возвращает ключ кэша для enrichment конкретного finding.
func EnrichmentCacheKey(findingID string) string {
	return fmt.Sprintf("%s%s", CacheEnrichmentPfx, findingID)
}
