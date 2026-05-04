package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
)

type Querier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type findingEventCursor struct {
	CreatedAt time.Time `json:"created_at"`
	ID        uuid.UUID `json:"id"`
}

type FindingEventListItem struct {
	domain.FindingEvent
	UserEmail    *string `json:"user_email,omitempty"`
	UserFullName *string `json:"user_full_name,omitempty"`
}

type FindingEventWithAuthor struct {
	domain.FindingEvent
	Author *domain.User `json:"author,omitempty"`
}

type FindingEventsRepo struct {
	pool *pgxpool.Pool
}

func NewFindingEventsRepo(pool *pgxpool.Pool) *FindingEventsRepo {
	return &FindingEventsRepo{pool: pool}
}

func (r *FindingEventsRepo) Pool() *pgxpool.Pool {
	return r.pool
}

func encodeEventCursor(c findingEventCursor) string {
	b, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(b)
}

func decodeEventCursor(s string) (findingEventCursor, error) {
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return findingEventCursor{}, err
	}
	var c findingEventCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return findingEventCursor{}, err
	}
	return c, nil
}

func (r *FindingEventsRepo) Create(ctx context.Context, q Querier, event domain.FindingEvent) error {
	const iq = `
		INSERT INTO finding_events (id, finding_id, user_id, event_type, payload, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`
	if _, err := q.Exec(ctx, iq, event.ID, event.FindingID, event.UserID, event.EventType, event.Payload, event.CreatedAt); err != nil {
		return fmt.Errorf("storage.FindingEventsRepo.Create: %w", err)
	}
	return nil
}

func (r *FindingEventsRepo) ListForFinding(
	ctx context.Context,
	findingID uuid.UUID,
	cursor string,
	limit int,
) ([]FindingEventListItem, string, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args := []any{findingID}
	where := "WHERE e.finding_id = $1"
	if cursor != "" {
		cur, err := decodeEventCursor(cursor)
		if err != nil {
			return nil, "", fmt.Errorf("storage.FindingEventsRepo.ListForFinding: cursor: %w", err)
		}
		args = append(args, cur.CreatedAt, cur.ID)
		where += fmt.Sprintf(" AND (e.created_at, e.id) < ($%d, $%d)", len(args)-1, len(args))
	}
	args = append(args, limit+1)
	q := fmt.Sprintf(`
		SELECT e.id, e.finding_id, e.user_id, e.event_type, e.payload, e.created_at,
		       u.email, u.full_name
		FROM finding_events e
		LEFT JOIN users u ON u.id = e.user_id
		%s
		ORDER BY e.created_at DESC, e.id DESC
		LIMIT $%d`, where, len(args))

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, "", fmt.Errorf("storage.FindingEventsRepo.ListForFinding: %w", err)
	}
	defer rows.Close()

	items := make([]FindingEventListItem, 0, 32)
	for rows.Next() {
		var item FindingEventListItem
		if err := rows.Scan(
			&item.ID, &item.FindingID, &item.UserID, &item.EventType, &item.Payload, &item.CreatedAt,
			&item.UserEmail, &item.UserFullName,
		); err != nil {
			return nil, "", fmt.Errorf("storage.FindingEventsRepo.ListForFinding: scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("storage.FindingEventsRepo.ListForFinding: rows: %w", err)
	}

	next := ""
	if len(items) > limit {
		last := items[limit-1]
		next = encodeEventCursor(findingEventCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		items = items[:limit]
	}
	return items, next, nil
}

func (r *FindingEventsRepo) GetByID(ctx context.Context, id uuid.UUID) (*FindingEventWithAuthor, error) {
	const q = `
		SELECT e.id, e.finding_id, e.user_id, e.event_type, e.payload, e.created_at,
		       u.id, u.email, u.full_name, u.is_active, u.global_role, u.created_at, u.updated_at, u.last_login_at
		FROM finding_events e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.id = $1`

	var event FindingEventWithAuthor
	var author domain.User
	var authorGlobalRole int16
	var authorID *uuid.UUID
	if err := r.pool.QueryRow(ctx, q, id).Scan(
		&event.ID, &event.FindingID, &event.UserID, &event.EventType, &event.Payload, &event.CreatedAt,
		&authorID, &author.Email, &author.FullName, &author.IsActive, &authorGlobalRole, &author.CreatedAt, &author.UpdatedAt, &author.LastLoginAt,
	); err != nil {
		return nil, fmt.Errorf("storage.FindingEventsRepo.GetByID: %w", err)
	}
	if authorID != nil {
		author.ID = *authorID
		author.GlobalRole = domain.GlobalRole(authorGlobalRole)
		event.Author = &author
	}
	return &event, nil
}

func (r *FindingEventsRepo) ListCommentsForFinding(ctx context.Context, findingID uuid.UUID) ([]FindingEventWithAuthor, error) {
	const q = `
		SELECT e.id, e.finding_id, e.user_id, e.event_type, e.payload, e.created_at,
		       u.id, u.email, u.full_name, u.is_active, u.global_role, u.created_at, u.updated_at, u.last_login_at
		FROM finding_events e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.finding_id = $1
		  AND e.event_type IN ('comment_added', 'comment_edited', 'comment_deleted')
		ORDER BY e.created_at ASC, e.id ASC`

	rows, err := r.pool.Query(ctx, q, findingID)
	if err != nil {
		return nil, fmt.Errorf("storage.FindingEventsRepo.ListCommentsForFinding: %w", err)
	}
	defer rows.Close()

	out := make([]FindingEventWithAuthor, 0)
	for rows.Next() {
		var item FindingEventWithAuthor
		var author domain.User
		var authorGlobalRole int16
		var authorID *uuid.UUID
		if err := rows.Scan(
			&item.ID, &item.FindingID, &item.UserID, &item.EventType, &item.Payload, &item.CreatedAt,
			&authorID, &author.Email, &author.FullName, &author.IsActive, &authorGlobalRole, &author.CreatedAt, &author.UpdatedAt, &author.LastLoginAt,
		); err != nil {
			return nil, fmt.Errorf("storage.FindingEventsRepo.ListCommentsForFinding: scan: %w", err)
		}
		if authorID != nil {
			author.ID = *authorID
			author.GlobalRole = domain.GlobalRole(authorGlobalRole)
			item.Author = &author
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.FindingEventsRepo.ListCommentsForFinding: rows: %w", err)
	}
	return out, nil
}
