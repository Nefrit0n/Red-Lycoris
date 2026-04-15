package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditRecord struct {
	ID           uuid.UUID  `json:"id"`
	RequestID    string     `json:"request_id,omitempty"`
	Method       string     `json:"method"`
	Path         string     `json:"path"`
	StatusCode   int        `json:"status_code"`
	UserAgent    string     `json:"user_agent,omitempty"`
	DurationMs   int        `json:"duration_ms"`
	CreatedAt    time.Time  `json:"created_at"`
	IP           *string    `json:"ip,omitempty"`
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	ResourceType *string    `json:"resource_type,omitempty"`
	ResourceID   *string    `json:"resource_id,omitempty"`
	Action       *string    `json:"action,omitempty"`
	UserEmail    *string    `json:"user_email,omitempty"`
}

type AuditListFilter struct {
	From         *time.Time
	To           *time.Time
	UserID       *uuid.UUID
	ResourceType string
	ResourceID   string
	Action       string
	Q            string
	RequestID    string
	Cursor       string
	Limit        int
}

type auditCursor struct {
	CreatedAt time.Time `json:"created_at"`
	ID        uuid.UUID `json:"id"`
}

type AuditLogRepo struct {
	pool *pgxpool.Pool
}

func NewAuditLogRepo(pool *pgxpool.Pool) *AuditLogRepo {
	return &AuditLogRepo{pool: pool}
}

func (r *AuditLogRepo) Create(ctx context.Context, rec *AuditRecord) error {
	const q = `
		INSERT INTO audit_log (
			id, request_id, method, path, status_code,
			user_agent, duration_ms, created_at, ip, user_id,
			resource_type, resource_id, action
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	if rec.ID == uuid.Nil {
		rec.ID = uuid.New()
	}
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = time.Now().UTC()
	}
	if _, err := r.pool.Exec(ctx, q,
		rec.ID, rec.RequestID, rec.Method, rec.Path, rec.StatusCode,
		rec.UserAgent, rec.DurationMs, rec.CreatedAt, rec.IP, rec.UserID,
		rec.ResourceType, rec.ResourceID, rec.Action,
	); err != nil {
		return fmt.Errorf("storage.AuditLogRepo.Create: %w", err)
	}
	return nil
}

func (r *AuditLogRepo) EnsurePartition(ctx context.Context, month time.Time) error {
	monthStart := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	nextMonth := monthStart.AddDate(0, 1, 0)
	name := fmt.Sprintf("audit_log_%04d_%02d", monthStart.Year(), monthStart.Month())
	q := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s PARTITION OF audit_log
		FOR VALUES FROM ('%s') TO ('%s')`, name,
		monthStart.Format(time.RFC3339),
		nextMonth.Format(time.RFC3339),
	)
	if _, err := r.pool.Exec(ctx, q); err != nil {
		return fmt.Errorf("storage.AuditLogRepo.EnsurePartition: %w", err)
	}
	return nil
}

func encodeAuditCursor(c auditCursor) string {
	b, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(b)
}

func decodeAuditCursor(raw string) (auditCursor, error) {
	b, err := base64.URLEncoding.DecodeString(raw)
	if err != nil {
		return auditCursor{}, err
	}
	var c auditCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return auditCursor{}, err
	}
	return c, nil
}

func (r *AuditLogRepo) List(ctx context.Context, filter AuditListFilter) ([]AuditRecord, string, error) {
	if filter.Limit <= 0 || filter.Limit > 200 {
		filter.Limit = 50
	}
	args := make([]any, 0, 16)
	where := []string{"1=1"}

	if filter.From != nil {
		args = append(args, *filter.From)
		where = append(where, fmt.Sprintf("a.created_at >= $%d", len(args)))
	}
	if filter.To != nil {
		args = append(args, *filter.To)
		where = append(where, fmt.Sprintf("a.created_at <= $%d", len(args)))
	}
	if filter.UserID != nil {
		args = append(args, *filter.UserID)
		where = append(where, fmt.Sprintf("a.user_id = $%d", len(args)))
	}
	if filter.ResourceType != "" {
		args = append(args, filter.ResourceType)
		where = append(where, fmt.Sprintf("a.resource_type = $%d", len(args)))
	}
	if filter.ResourceID != "" {
		args = append(args, filter.ResourceID)
		where = append(where, fmt.Sprintf("a.resource_id = $%d", len(args)))
	}
	if filter.Action != "" {
		args = append(args, filter.Action)
		where = append(where, fmt.Sprintf("a.action = $%d", len(args)))
	}
	if filter.RequestID != "" {
		args = append(args, filter.RequestID)
		where = append(where, fmt.Sprintf("a.request_id = $%d", len(args)))
	}
	if filter.Q != "" {
		args = append(args, "%"+filter.Q+"%")
		where = append(where, fmt.Sprintf("(a.path ILIKE $%d OR COALESCE(a.user_agent,'') ILIKE $%d OR COALESCE(a.request_id,'') ILIKE $%d)", len(args), len(args), len(args)))
	}
	if strings.TrimSpace(filter.Cursor) != "" {
		cursor, err := decodeAuditCursor(filter.Cursor)
		if err != nil {
			return nil, "", fmt.Errorf("storage.AuditLogRepo.List: invalid cursor: %w", err)
		}
		args = append(args, cursor.CreatedAt, cursor.ID)
		where = append(where, fmt.Sprintf("(a.created_at, a.id) < ($%d, $%d)", len(args)-1, len(args)))
	}

	args = append(args, filter.Limit+1)
	q := fmt.Sprintf(`
		SELECT a.id, a.request_id, a.method, a.path, a.status_code,
		       a.user_agent, a.duration_ms, a.created_at, a.ip, a.user_id,
		       a.resource_type, a.resource_id, a.action,
		       u.email
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $%d`, strings.Join(where, " AND "), len(args))

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", fmt.Errorf("storage.AuditLogRepo.List: %w", err)
	}
	defer rows.Close()

	out := make([]AuditRecord, 0, filter.Limit)
	for rows.Next() {
		var rec AuditRecord
		if err := rows.Scan(
			&rec.ID, &rec.RequestID, &rec.Method, &rec.Path, &rec.StatusCode,
			&rec.UserAgent, &rec.DurationMs, &rec.CreatedAt, &rec.IP, &rec.UserID,
			&rec.ResourceType, &rec.ResourceID, &rec.Action,
			&rec.UserEmail,
		); err != nil {
			return nil, "", fmt.Errorf("storage.AuditLogRepo.List: scan: %w", err)
		}
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("storage.AuditLogRepo.List: rows: %w", err)
	}

	next := ""
	if len(out) > filter.Limit {
		last := out[filter.Limit-1]
		next = encodeAuditCursor(auditCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		out = out[:filter.Limit]
	}
	return out, next, nil
}
