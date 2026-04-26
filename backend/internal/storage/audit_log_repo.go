package storage

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditUAParsed struct {
	Browser      string `json:"browser"`
	OS           string `json:"os"`
	IsTor        bool   `json:"is_tor,omitempty"`
	IsVPN        bool   `json:"is_vpn,omitempty"`
	IsDatacenter bool   `json:"is_datacenter,omitempty"`
	CountryCode  string `json:"country_code,omitempty"`
}

type AuditChange struct {
	Field  string `json:"field"`
	Before any    `json:"before"`
	After  any    `json:"after"`
	PII    bool   `json:"pii,omitempty"`
}

type AuditIntegrity struct {
	Hash     string `json:"hash"`
	PrevHash string `json:"prev_hash"`
	Verified bool   `json:"verified"`
}

type AuditRecord struct {
	ID           uuid.UUID       `json:"id"`
	RequestID    string          `json:"request_id,omitempty"`
	TraceID      string          `json:"trace_id,omitempty"`
	SessionID    string          `json:"session_id,omitempty"`
	Method       string          `json:"method"`
	Path         string          `json:"path"`
	FullPath     string          `json:"full_path,omitempty"`
	StatusCode   int             `json:"status_code"`
	UserAgent    string          `json:"user_agent,omitempty"`
	UAParsed     *AuditUAParsed  `json:"ua_parsed,omitempty"`
	DurationMs   int             `json:"duration_ms"`
	CreatedAt    time.Time       `json:"created_at"`
	IP           *string         `json:"ip,omitempty"`
	UserID       *uuid.UUID      `json:"user_id,omitempty"`
	ResourceType *string         `json:"resource_type,omitempty"`
	ResourceID   *string         `json:"resource_id,omitempty"`
	Action       *string         `json:"action,omitempty"`
	RiskLevel    string          `json:"risk_level,omitempty"`
	RiskSignals  []string        `json:"risk_signals,omitempty"`
	Changes      []AuditChange   `json:"changes,omitempty"`
	Integrity    *AuditIntegrity `json:"integrity,omitempty"`
	UserEmail    *string         `json:"user_email,omitempty"`
}

type AuditListFilter struct {
	From         *time.Time
	To           *time.Time
	UserID       *uuid.UUID
	ResourceType string
	ResourceID   string
	Action       string
	Method       string
	StatusMin    *int
	RiskLevel    string
	Q            string
	RequestID    string
	TraceID      string
	SessionID    string
	Cursor       string
	Limit        int
}

type AuditHourStat struct {
	Hour        time.Time `json:"hour"`
	Total       int       `json:"total"`
	ErrorCount  int       `json:"error_count"`
	ErrorRatio  float64   `json:"error_ratio"`
	Success2xx  int       `json:"success_2xx"`
	Redirect3xx int       `json:"redirect_3xx"`
	Client4xx   int       `json:"client_4xx"`
	Server5xx   int       `json:"server_5xx"`
}

type AuditStats struct {
	From            time.Time       `json:"from"`
	To              time.Time       `json:"to"`
	Events24h       int             `json:"events_24h"`
	UniqueUsers24h  int             `json:"unique_users_24h"`
	Errors24h       int             `json:"errors_24h"`
	Critical24h     int             `json:"critical_24h"`
	PrevEvents24h   int             `json:"prev_events_24h"`
	PrevUnique24h   int             `json:"prev_unique_users_24h"`
	PrevErrors24h   int             `json:"prev_errors_24h"`
	PrevCritical24h int             `json:"prev_critical_24h"`
	Histogram       []AuditHourStat `json:"histogram"`
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
			id, request_id, trace_id, session_id, method, path, full_path, status_code,
			user_agent, ua_browser, ua_os, ua_is_tor, ua_is_vpn, ua_is_datacenter, ua_country_code,
			duration_ms, created_at, ip, user_id, resource_type, resource_id, action, risk_level, risk_signals,
			integrity_hash, integrity_prev_hash, integrity_verified, changes
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, $21, $22, $23, $24,
			$25, $26, $27, $28
		)`

	if rec.ID == uuid.Nil {
		rec.ID = uuid.New()
	}
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = time.Now().UTC()
	}

	var uaBrowser, uaOS, uaCountry string
	var uaIsTor, uaIsVPN, uaIsDatacenter bool
	if rec.UAParsed != nil {
		uaBrowser = rec.UAParsed.Browser
		uaOS = rec.UAParsed.OS
		uaCountry = rec.UAParsed.CountryCode
		uaIsTor = rec.UAParsed.IsTor
		uaIsVPN = rec.UAParsed.IsVPN
		uaIsDatacenter = rec.UAParsed.IsDatacenter
	}

	var integrityHash, integrityPrevHash string
	var integrityVerified bool
	if rec.Integrity != nil {
		integrityHash = rec.Integrity.Hash
		integrityPrevHash = rec.Integrity.PrevHash
		integrityVerified = rec.Integrity.Verified
	}

	changesJSON, err := json.Marshal(rec.Changes)
	if err != nil {
		return fmt.Errorf("storage.AuditLogRepo.Create: marshal changes: %w", err)
	}

	if _, err := r.pool.Exec(ctx, q,
		rec.ID, rec.RequestID, rec.TraceID, rec.SessionID, rec.Method, rec.Path, rec.FullPath, rec.StatusCode,
		rec.UserAgent, uaBrowser, uaOS, uaIsTor, uaIsVPN, uaIsDatacenter, uaCountry,
		rec.DurationMs, rec.CreatedAt, rec.IP, rec.UserID,
		rec.ResourceType, rec.ResourceID, rec.Action, rec.RiskLevel, rec.RiskSignals,
		integrityHash, integrityPrevHash, integrityVerified, changesJSON,
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
	args := make([]any, 0, 20)
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
	if filter.Method != "" {
		args = append(args, strings.ToUpper(filter.Method))
		where = append(where, fmt.Sprintf("a.method = $%d", len(args)))
	}
	if filter.StatusMin != nil {
		args = append(args, *filter.StatusMin)
		where = append(where, fmt.Sprintf("a.status_code >= $%d", len(args)))
	}
	if filter.RiskLevel != "" {
		args = append(args, filter.RiskLevel)
		where = append(where, fmt.Sprintf("a.risk_level = $%d", len(args)))
	}
	if filter.RequestID != "" {
		args = append(args, filter.RequestID)
		where = append(where, fmt.Sprintf("a.request_id = $%d", len(args)))
	}
	if filter.TraceID != "" {
		args = append(args, filter.TraceID)
		where = append(where, fmt.Sprintf("a.trace_id = $%d", len(args)))
	}
	if filter.SessionID != "" {
		args = append(args, filter.SessionID)
		where = append(where, fmt.Sprintf("a.session_id = $%d", len(args)))
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
		SELECT a.id, a.request_id, a.trace_id, a.session_id, a.method, a.path, COALESCE(a.full_path, a.path), a.status_code,
		       a.user_agent, a.ua_browser, a.ua_os, a.ua_is_tor, a.ua_is_vpn, a.ua_is_datacenter, a.ua_country_code,
		       a.duration_ms, a.created_at, a.ip, a.user_id,
		       a.resource_type, a.resource_id, a.action,
		       a.risk_level, COALESCE(a.risk_signals, ARRAY[]::TEXT[]),
		       a.integrity_hash, a.integrity_prev_hash, a.integrity_verified,
		       COALESCE(a.changes, '[]'::jsonb),
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
		var uaBrowser, uaOS, uaCountry string
		var uaIsTor, uaIsVPN, uaIsDatacenter bool
		var riskSignals []string
		var integrityHash, integrityPrevHash string
		var integrityVerified bool
		var rawChanges []byte

		if err := rows.Scan(
			&rec.ID, &rec.RequestID, &rec.TraceID, &rec.SessionID, &rec.Method, &rec.Path, &rec.FullPath, &rec.StatusCode,
			&rec.UserAgent, &uaBrowser, &uaOS, &uaIsTor, &uaIsVPN, &uaIsDatacenter, &uaCountry,
			&rec.DurationMs, &rec.CreatedAt, &rec.IP, &rec.UserID,
			&rec.ResourceType, &rec.ResourceID, &rec.Action,
			&rec.RiskLevel, &riskSignals,
			&integrityHash, &integrityPrevHash, &integrityVerified,
			&rawChanges,
			&rec.UserEmail,
		); err != nil {
			return nil, "", fmt.Errorf("storage.AuditLogRepo.List: scan: %w", err)
		}

		rec.RiskSignals = riskSignals
		rec.UAParsed = &AuditUAParsed{
			Browser:      uaBrowser,
			OS:           uaOS,
			IsTor:        uaIsTor,
			IsVPN:        uaIsVPN,
			IsDatacenter: uaIsDatacenter,
			CountryCode:  uaCountry,
		}

		if strings.TrimSpace(integrityHash) != "" || strings.TrimSpace(integrityPrevHash) != "" {
			rec.Integrity = &AuditIntegrity{Hash: integrityHash, PrevHash: integrityPrevHash, Verified: integrityVerified}
		}

		if len(rawChanges) > 0 {
			if err := json.Unmarshal(rawChanges, &rec.Changes); err != nil {
				return nil, "", fmt.Errorf("storage.AuditLogRepo.List: unmarshal changes: %w", err)
			}
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

func (r *AuditLogRepo) GetByID(ctx context.Context, id uuid.UUID) (AuditRecord, error) {
	const q = `
		SELECT a.id, a.request_id, a.trace_id, a.session_id, a.method, a.path, COALESCE(a.full_path, a.path), a.status_code,
		       a.user_agent, a.ua_browser, a.ua_os, a.ua_is_tor, a.ua_is_vpn, a.ua_is_datacenter, a.ua_country_code,
		       a.duration_ms, a.created_at, a.ip, a.user_id,
		       a.resource_type, a.resource_id, a.action,
		       a.risk_level, COALESCE(a.risk_signals, ARRAY[]::TEXT[]),
		       a.integrity_hash, a.integrity_prev_hash, a.integrity_verified,
		       COALESCE(a.changes, '[]'::jsonb),
		       u.email
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.id = $1
		ORDER BY a.created_at DESC
		LIMIT 1`

	row := r.pool.QueryRow(ctx, q, id)
	rec, err := scanAuditRecord(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AuditRecord{}, fmt.Errorf("storage.AuditLogRepo.GetByID: not found")
		}
		return AuditRecord{}, fmt.Errorf("storage.AuditLogRepo.GetByID: %w", err)
	}
	return rec, nil
}

func (r *AuditLogRepo) GetDiff(ctx context.Context, id uuid.UUID) ([]AuditChange, error) {
	const q = `
		SELECT COALESCE(changes, '[]'::jsonb)
		FROM audit_log
		WHERE id = $1
		ORDER BY created_at DESC
		LIMIT 1`
	var raw []byte
	if err := r.pool.QueryRow(ctx, q, id).Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("storage.AuditLogRepo.GetDiff: not found")
		}
		return nil, fmt.Errorf("storage.AuditLogRepo.GetDiff: %w", err)
	}
	out := make([]AuditChange, 0)
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("storage.AuditLogRepo.GetDiff: unmarshal: %w", err)
	}
	return out, nil
}

func (r *AuditLogRepo) ListRelated(ctx context.Context, id uuid.UUID, limit int) ([]AuditRecord, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	const q = `
		WITH base AS (
			SELECT trace_id, session_id
			FROM audit_log
			WHERE id = $1
			ORDER BY created_at DESC
			LIMIT 1
		)
		SELECT a.id, a.request_id, a.trace_id, a.session_id, a.method, a.path, COALESCE(a.full_path, a.path), a.status_code,
		       a.user_agent, a.ua_browser, a.ua_os, a.ua_is_tor, a.ua_is_vpn, a.ua_is_datacenter, a.ua_country_code,
		       a.duration_ms, a.created_at, a.ip, a.user_id,
		       a.resource_type, a.resource_id, a.action,
		       a.risk_level, COALESCE(a.risk_signals, ARRAY[]::TEXT[]),
		       a.integrity_hash, a.integrity_prev_hash, a.integrity_verified,
		       COALESCE(a.changes, '[]'::jsonb),
		       u.email
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.user_id
		CROSS JOIN base b
		WHERE a.id <> $1
		  AND (
		    (COALESCE(b.trace_id,'') <> '' AND a.trace_id = b.trace_id)
		    OR (COALESCE(b.session_id,'') <> '' AND a.session_id = b.session_id)
		  )
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $2`
	rows, err := r.pool.Query(ctx, q, id, limit)
	if err != nil {
		return nil, fmt.Errorf("storage.AuditLogRepo.ListRelated: %w", err)
	}
	defer rows.Close()
	out := make([]AuditRecord, 0, limit)
	for rows.Next() {
		rec, scanErr := scanAuditRecord(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("storage.AuditLogRepo.ListRelated: scan: %w", scanErr)
		}
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.AuditLogRepo.ListRelated: rows: %w", err)
	}
	return out, nil
}

func (r *AuditLogRepo) ListAfter(ctx context.Context, filter AuditListFilter, afterCreatedAt time.Time, afterID uuid.UUID, limit int) ([]AuditRecord, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	filter.Limit = limit
	args := make([]any, 0, 20)
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
	if filter.Method != "" {
		args = append(args, strings.ToUpper(filter.Method))
		where = append(where, fmt.Sprintf("a.method = $%d", len(args)))
	}
	if filter.StatusMin != nil {
		args = append(args, *filter.StatusMin)
		where = append(where, fmt.Sprintf("a.status_code >= $%d", len(args)))
	}
	if filter.RiskLevel != "" {
		args = append(args, filter.RiskLevel)
		where = append(where, fmt.Sprintf("a.risk_level = $%d", len(args)))
	}
	if filter.RequestID != "" {
		args = append(args, filter.RequestID)
		where = append(where, fmt.Sprintf("a.request_id = $%d", len(args)))
	}
	if filter.TraceID != "" {
		args = append(args, filter.TraceID)
		where = append(where, fmt.Sprintf("a.trace_id = $%d", len(args)))
	}
	if filter.SessionID != "" {
		args = append(args, filter.SessionID)
		where = append(where, fmt.Sprintf("a.session_id = $%d", len(args)))
	}
	if filter.Q != "" {
		args = append(args, "%"+filter.Q+"%")
		where = append(where, fmt.Sprintf("(a.path ILIKE $%d OR COALESCE(a.user_agent,'') ILIKE $%d OR COALESCE(a.request_id,'') ILIKE $%d)", len(args), len(args), len(args)))
	}

	args = append(args, afterCreatedAt, afterID)
	where = append(where, fmt.Sprintf("(a.created_at, a.id) > ($%d, $%d)", len(args)-1, len(args)))
	args = append(args, limit)

	q := fmt.Sprintf(`
		SELECT a.id, a.request_id, a.trace_id, a.session_id, a.method, a.path, COALESCE(a.full_path, a.path), a.status_code,
		       a.user_agent, a.ua_browser, a.ua_os, a.ua_is_tor, a.ua_is_vpn, a.ua_is_datacenter, a.ua_country_code,
		       a.duration_ms, a.created_at, a.ip, a.user_id,
		       a.resource_type, a.resource_id, a.action,
		       a.risk_level, COALESCE(a.risk_signals, ARRAY[]::TEXT[]),
		       a.integrity_hash, a.integrity_prev_hash, a.integrity_verified,
		       COALESCE(a.changes, '[]'::jsonb),
		       u.email
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY a.created_at ASC, a.id ASC
		LIMIT $%d`, strings.Join(where, " AND "), len(args))

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("storage.AuditLogRepo.ListAfter: %w", err)
	}
	defer rows.Close()

	out := make([]AuditRecord, 0, limit)
	for rows.Next() {
		rec, scanErr := scanAuditRecord(rows)
		if scanErr != nil {
			return nil, fmt.Errorf("storage.AuditLogRepo.ListAfter: scan: %w", scanErr)
		}
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("storage.AuditLogRepo.ListAfter: rows: %w", err)
	}
	return out, nil
}

func (r *AuditLogRepo) Stats(ctx context.Context, from, to time.Time) (AuditStats, error) {
	if to.Before(from) {
		return AuditStats{}, fmt.Errorf("storage.AuditLogRepo.Stats: invalid range")
	}
	stats := AuditStats{From: from, To: to, Histogram: make([]AuditHourStat, 0, 24)}
	prevFrom := from.Add(-(to.Sub(from)))
	prevTo := from

	const totalsQ = `
		SELECT
			COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2) AS events_24h,
			COUNT(DISTINCT user_id) FILTER (WHERE created_at >= $1 AND created_at <= $2) AS users_24h,
			COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2 AND status_code >= 400) AS errors_24h,
			COUNT(*) FILTER (WHERE created_at >= $1 AND created_at <= $2 AND risk_level IN ('high','critical')) AS critical_24h,
			COUNT(*) FILTER (WHERE created_at >= $3 AND created_at < $4) AS prev_events_24h,
			COUNT(DISTINCT user_id) FILTER (WHERE created_at >= $3 AND created_at < $4) AS prev_users_24h,
			COUNT(*) FILTER (WHERE created_at >= $3 AND created_at < $4 AND status_code >= 400) AS prev_errors_24h,
			COUNT(*) FILTER (WHERE created_at >= $3 AND created_at < $4 AND risk_level IN ('high','critical')) AS prev_critical_24h
		FROM audit_log`

	if err := r.pool.QueryRow(ctx, totalsQ, from, to, prevFrom, prevTo).Scan(
		&stats.Events24h,
		&stats.UniqueUsers24h,
		&stats.Errors24h,
		&stats.Critical24h,
		&stats.PrevEvents24h,
		&stats.PrevUnique24h,
		&stats.PrevErrors24h,
		&stats.PrevCritical24h,
	); err != nil {
		return AuditStats{}, fmt.Errorf("storage.AuditLogRepo.Stats: totals: %w", err)
	}

	const histogramQ = `
		WITH series AS (
			SELECT generate_series(
				date_trunc('hour', $1::timestamptz),
				date_trunc('hour', $2::timestamptz),
				interval '1 hour'
			) AS bucket
		)
		SELECT
			s.bucket,
			COUNT(a.id)::int AS total,
			COUNT(*) FILTER (WHERE a.status_code >= 400)::int AS error_count,
			CASE WHEN COUNT(a.id) = 0 THEN 0 ELSE COUNT(*) FILTER (WHERE a.status_code >= 400)::float / COUNT(a.id)::float END AS error_ratio,
			COUNT(*) FILTER (WHERE a.status_code >= 200 AND a.status_code < 300)::int AS success_2xx,
			COUNT(*) FILTER (WHERE a.status_code >= 300 AND a.status_code < 400)::int AS redirect_3xx,
			COUNT(*) FILTER (WHERE a.status_code >= 400 AND a.status_code < 500)::int AS client_4xx,
			COUNT(*) FILTER (WHERE a.status_code >= 500)::int AS server_5xx
		FROM series s
		LEFT JOIN audit_log a
			ON date_trunc('hour', a.created_at) = s.bucket
		   AND a.created_at >= $1 AND a.created_at <= $2
		GROUP BY s.bucket
		ORDER BY s.bucket`
	rows, err := r.pool.Query(ctx, histogramQ, from, to)
	if err != nil {
		return AuditStats{}, fmt.Errorf("storage.AuditLogRepo.Stats: histogram: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var h AuditHourStat
		if err := rows.Scan(&h.Hour, &h.Total, &h.ErrorCount, &h.ErrorRatio, &h.Success2xx, &h.Redirect3xx, &h.Client4xx, &h.Server5xx); err != nil {
			return AuditStats{}, fmt.Errorf("storage.AuditLogRepo.Stats: scan histogram: %w", err)
		}
		stats.Histogram = append(stats.Histogram, h)
	}
	if err := rows.Err(); err != nil {
		return AuditStats{}, fmt.Errorf("storage.AuditLogRepo.Stats: rows histogram: %w", err)
	}
	return stats, nil
}

type auditRecordScanner interface {
	Scan(dest ...any) error
}

func scanAuditRecord(scanner auditRecordScanner) (AuditRecord, error) {
	var rec AuditRecord
	var uaBrowser, uaOS, uaCountry string
	var uaIsTor, uaIsVPN, uaIsDatacenter bool
	var riskSignals []string
	var integrityHash, integrityPrevHash string
	var integrityVerified bool
	var rawChanges []byte

	if err := scanner.Scan(
		&rec.ID, &rec.RequestID, &rec.TraceID, &rec.SessionID, &rec.Method, &rec.Path, &rec.FullPath, &rec.StatusCode,
		&rec.UserAgent, &uaBrowser, &uaOS, &uaIsTor, &uaIsVPN, &uaIsDatacenter, &uaCountry,
		&rec.DurationMs, &rec.CreatedAt, &rec.IP, &rec.UserID,
		&rec.ResourceType, &rec.ResourceID, &rec.Action,
		&rec.RiskLevel, &riskSignals,
		&integrityHash, &integrityPrevHash, &integrityVerified,
		&rawChanges,
		&rec.UserEmail,
	); err != nil {
		return AuditRecord{}, err
	}

	rec.RiskSignals = riskSignals
	rec.UAParsed = &AuditUAParsed{
		Browser:      uaBrowser,
		OS:           uaOS,
		IsTor:        uaIsTor,
		IsVPN:        uaIsVPN,
		IsDatacenter: uaIsDatacenter,
		CountryCode:  uaCountry,
	}
	if strings.TrimSpace(integrityHash) != "" || strings.TrimSpace(integrityPrevHash) != "" {
		rec.Integrity = &AuditIntegrity{Hash: integrityHash, PrevHash: integrityPrevHash, Verified: integrityVerified}
	}
	if len(rawChanges) > 0 {
		if err := json.Unmarshal(rawChanges, &rec.Changes); err != nil {
			return AuditRecord{}, fmt.Errorf("unmarshal changes: %w", err)
		}
	}
	return rec, nil
}
