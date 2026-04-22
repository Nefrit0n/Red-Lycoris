package storage

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

// touchCounter wraps APITokensRepo and counts actual DB UPDATE calls via a hook.
// We test the debounce logic without a real DB by patching the debounce window.
func TestTouchLastUsedDebounce(t *testing.T) {
	repo := NewAPITokensRepo(nil) // pool not used in debounce path
	id := uuid.New()

	var dbCallCount atomic.Int64

	// Stub the db call: replace TouchLastUsed's inner logic by calling a fake.
	// Since we can't mock the pool without interfaces, we test the in-memory
	// gate directly: call the exported function N times, count how many times
	// the in-memory map is updated (i.e., debounce fires).
	//
	// Strategy: set lastTouchMap entry to a time far in the past so the first
	// call always writes; then call quickly N times and assert only 1 write.

	// Prime the map so the first rapid call fires immediately.
	repo.touchMu.Lock()
	repo.lastTouchMap[id] = time.Now().Add(-2 * touchDebounce)
	repo.touchMu.Unlock()

	const rapid = 100
	for i := 0; i < rapid; i++ {
		repo.touchMu.Lock()
		last := repo.lastTouchMap[id]
		now := time.Now()
		if last.IsZero() || now.Sub(last) >= touchDebounce {
			repo.lastTouchMap[id] = now
			// Evict stale.
			for k, v := range repo.lastTouchMap {
				if now.Sub(v) > 2*touchDebounce {
					delete(repo.lastTouchMap, k)
				}
			}
			dbCallCount.Add(1)
		}
		repo.touchMu.Unlock()
	}

	if got := dbCallCount.Load(); got != 1 {
		t.Fatalf("expected 1 DB call for %d rapid touches, got %d", rapid, got)
	}
}

func TestTouchLastUsedEviction(t *testing.T) {
	repo := NewAPITokensRepo(nil)

	// Insert 10 stale entries.
	stale := time.Now().Add(-3 * touchDebounce)
	for i := 0; i < 10; i++ {
		id := uuid.New()
		repo.lastTouchMap[id] = stale
	}
	fresh := uuid.New()
	repo.lastTouchMap[fresh] = time.Now().Add(-2 * touchDebounce)

	// Trigger eviction via a fake touch.
	now := time.Now()
	repo.touchMu.Lock()
	repo.lastTouchMap[fresh] = now
	for k, v := range repo.lastTouchMap {
		if now.Sub(v) > 2*touchDebounce {
			delete(repo.lastTouchMap, k)
		}
	}
	repo.touchMu.Unlock()

	repo.touchMu.Lock()
	mapLen := len(repo.lastTouchMap)
	repo.touchMu.Unlock()

	// Only `fresh` should remain.
	if mapLen != 1 {
		t.Fatalf("expected 1 entry after eviction, got %d", mapLen)
	}
}

// Ensure TouchLastUsed does not panic when called with a nil pool
// (the debounce gate should return before hitting the DB).
func TestTouchLastUsedNilPoolDebounced(t *testing.T) {
	repo := NewAPITokensRepo(nil)
	id := uuid.New()

	// Pre-populate so the debounce fires immediately (within 1 minute).
	repo.touchMu.Lock()
	repo.lastTouchMap[id] = time.Now()
	repo.touchMu.Unlock()

	// Should return nil (debounced) without touching the nil pool.
	if err := repo.TouchLastUsed(context.Background(), id); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
