package storage

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type closureReasonsSnapshot struct {
	all    []domain.ClosureReason
	byID   map[int16]domain.ClosureReason
	byCode map[string]domain.ClosureReason
}

type ClosureReasonsRepo struct {
	pool      *pgxpool.Pool
	once      sync.Once
	snapshot  atomic.Pointer[closureReasonsSnapshot]
	reloadErr atomic.Pointer[error]
}

func NewClosureReasonsRepo(pool *pgxpool.Pool) *ClosureReasonsRepo {
	return &ClosureReasonsRepo{pool: pool}
}

func (r *ClosureReasonsRepo) EnsureLoaded(ctx context.Context) error {
	var onceErr error
	r.once.Do(func() {
		onceErr = r.reload(ctx)
		if onceErr == nil {
			go r.runReloader()
		}
	})
	if onceErr != nil {
		return onceErr
	}
	if snap := r.snapshot.Load(); snap == nil {
		return fmt.Errorf("storage.ClosureReasonsRepo.EnsureLoaded: snapshot not ready")
	}
	return nil
}

func (r *ClosureReasonsRepo) runReloader() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_ = r.reload(ctx)
		cancel()
	}
}

func (r *ClosureReasonsRepo) reload(ctx context.Context) error {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, label, target_status, requires_note, is_active
		FROM closure_reasons
		WHERE is_active = true
		ORDER BY id`)
	if err != nil {
		return fmt.Errorf("storage.ClosureReasonsRepo.reload: query: %w", err)
	}
	defer rows.Close()

	snap := &closureReasonsSnapshot{
		all:    make([]domain.ClosureReason, 0),
		byID:   make(map[int16]domain.ClosureReason),
		byCode: make(map[string]domain.ClosureReason),
	}

	for rows.Next() {
		var cr domain.ClosureReason
		if err := rows.Scan(&cr.ID, &cr.Code, &cr.Label, &cr.TargetStatus, &cr.RequiresNote, &cr.IsActive); err != nil {
			return fmt.Errorf("storage.ClosureReasonsRepo.reload: scan: %w", err)
		}
		snap.all = append(snap.all, cr)
		snap.byID[cr.ID] = cr
		snap.byCode[cr.Code] = cr
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("storage.ClosureReasonsRepo.reload: rows: %w", err)
	}

	r.snapshot.Store(snap)
	return nil
}

func (r *ClosureReasonsRepo) ListActive(ctx context.Context) ([]domain.ClosureReason, error) {
	if err := r.EnsureLoaded(ctx); err != nil {
		return nil, err
	}
	snap := r.snapshot.Load()
	out := make([]domain.ClosureReason, len(snap.all))
	copy(out, snap.all)
	return out, nil
}

func (r *ClosureReasonsRepo) GetByID(ctx context.Context, id int16) (*domain.ClosureReason, bool, error) {
	if err := r.EnsureLoaded(ctx); err != nil {
		return nil, false, err
	}
	snap := r.snapshot.Load()
	cr, ok := snap.byID[id]
	if !ok {
		return nil, false, nil
	}
	copy := cr
	return &copy, true, nil
}

func (r *ClosureReasonsRepo) GetByCode(ctx context.Context, code string) (*domain.ClosureReason, bool, error) {
	if err := r.EnsureLoaded(ctx); err != nil {
		return nil, false, err
	}
	snap := r.snapshot.Load()
	cr, ok := snap.byCode[code]
	if !ok {
		return nil, false, nil
	}
	copy := cr
	return &copy, true, nil
}

func (r *ClosureReasonsRepo) ByCode(code string) (*domain.ClosureReason, bool) {
	snap := r.snapshot.Load()
	if snap == nil {
		return nil, false
	}
	cr, ok := snap.byCode[code]
	if !ok {
		return nil, false
	}
	copy := cr
	return &copy, true
}
