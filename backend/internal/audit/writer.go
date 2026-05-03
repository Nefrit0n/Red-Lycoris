package audit

import (
	"context"
	"errors"
	"sync"

	"redlycoris/internal/storage"
)

type Writer struct {
	repo *storage.AuditLogRepo
	ch   chan storage.AuditRecord
	wg   sync.WaitGroup
	mu   sync.RWMutex
	dead bool
}

func NewWriter(repo *storage.AuditLogRepo) *Writer {
	w := &Writer{repo: repo, ch: make(chan storage.AuditRecord, 1024)}
	w.wg.Add(1)
	//nolint:contextcheck
	go func() {
		defer w.wg.Done()
		for rec := range w.ch {
			_ = w.repo.Create(context.Background(), &rec)
		}
	}()
	return w
}

func (w *Writer) Submit(record storage.AuditRecord) {
	if w == nil || w.repo == nil {
		return
	}
	w.mu.RLock()
	if w.dead {
		w.mu.RUnlock()
		return
	}
	w.mu.RUnlock()

	select {
	case w.ch <- record:
	default:
		//nolint:contextcheck
		go func() {
			_ = w.repo.Create(context.Background(), &record)
		}()
	}
}

func (w *Writer) Close(ctx context.Context) error {
	if w == nil {
		return nil
	}
	w.mu.Lock()
	if w.dead {
		w.mu.Unlock()
		return nil
	}
	w.dead = true
	close(w.ch)
	w.mu.Unlock()

	done := make(chan struct{})
	go func() {
		defer close(done)
		w.wg.Wait()
	}()

	select {
	case <-ctx.Done():
		return errors.New("audit writer close timeout")
	case <-done:
		return nil
	}
}
