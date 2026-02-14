package storage

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

type AuditLogItem struct {
	ID             uuid.UUID
	TenantID       uuid.UUID
	OccurredAt     time.Time
	CreatedAt      time.Time
	ActorID        uuid.NullUUID
	ActorType      sql.NullString
	ActorEmail     sql.NullString
	Action         string
	TargetType     string
	TargetID       sql.NullString
	Scope          string
	ScopeID        uuid.NullUUID
	RequestID      sql.NullString
	IdempotencyKey sql.NullString
	IP             sql.NullString
	UserAgent      sql.NullString
	DiffJSON       json.RawMessage
	MetadataJSON   json.RawMessage
	Payload        json.RawMessage
	ActorName      sql.NullString
}

type AuditLogFilters struct {
	TenantID   uuid.UUID
	From       *time.Time
	To         *time.Time
	ActorID    *uuid.UUID
	TargetType string
	TargetID   *uuid.UUID
	Action     string
	ScopeID    *uuid.UUID
	Query      string
	Limit      int
	Offset     int
}

func CreateAuditLog(ctx context.Context, db *sql.DB, entry *models.AuditLog) error {
	if err := entry.Validate(); err != nil {
		return err
	}
	entry.PrepareForInsert()

	var actorID interface{}
	if entry.ActorID != nil {
		actorID = *entry.ActorID
	}
	var targetID interface{}
	if entry.TargetID != nil {
		targetID = *entry.TargetID
	}
	var scopeID interface{}
	if entry.ScopeID != nil {
		scopeID = *entry.ScopeID
	}
	var actorType interface{}
	if entry.ActorType != "" {
		actorType = entry.ActorType
	}
	var actorEmail interface{}
	if entry.ActorEmail != nil {
		actorEmail = *entry.ActorEmail
	}
	var requestID interface{}
	if entry.RequestID != nil {
		requestID = *entry.RequestID
	}
	var idemKey interface{}
	if entry.IdempotencyKey != nil {
		idemKey = *entry.IdempotencyKey
	}
	var ip interface{}
	if entry.IP != nil {
		ip = *entry.IP
	}
	var userAgent interface{}
	if entry.UserAgent != nil {
		userAgent = *entry.UserAgent
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO audit_log (
			id, tenant_id, occurred_at, created_at, actor_id, actor_type, actor_email_snapshot,
			action, target_type, target_id, scope, scope_id,
			request_id, idempotency_key, ip, user_agent,
			diff_json, metadata_json, payload_json
		)
		 VALUES ($1, $2, $3, $4, $5, $6, $7,
				 $8, $9, $10, $11, $12,
				 $13, $14, $15, $16,
				 $17, $18, $19)`,
		entry.ID,
		entry.TenantID,
		entry.OccurredAt,
		entry.CreatedAt,
		actorID,
		actorType,
		actorEmail,
		entry.Action,
		entry.TargetType,
		targetID,
		entry.Scope,
		scopeID,
		requestID,
		idemKey,
		ip,
		userAgent,
		entry.DiffJSON,
		entry.MetadataJSON,
		entry.Payload,
	)
	return err
}

func ListAuditLogs(ctx context.Context, db *sql.DB, filters AuditLogFilters) ([]AuditLogItem, int, error) {
	where, args := buildAuditWhere(filters)
	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM audit_log WHERE " + whereClause
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	listQuery := `SELECT a.id, a.tenant_id, a.occurred_at, a.created_at, a.actor_id, a.actor_type, a.actor_email_snapshot,
		a.action, a.target_type, a.target_id, a.scope, a.scope_id,
		a.request_id, a.idempotency_key, a.ip, a.user_agent,
		a.diff_json, a.metadata_json, a.payload_json, u.username
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_id AND u.tenant_id = a.tenant_id
		WHERE ` + whereClause + `
		ORDER BY a.created_at DESC
		LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))

	rows, err := db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []AuditLogItem{}
	for rows.Next() {
		var item AuditLogItem
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.OccurredAt,
			&item.CreatedAt,
			&item.ActorID,
			&item.ActorType,
			&item.ActorEmail,
			&item.Action,
			&item.TargetType,
			&item.TargetID,
			&item.Scope,
			&item.ScopeID,
			&item.RequestID,
			&item.IdempotencyKey,
			&item.IP,
			&item.UserAgent,
			&item.DiffJSON,
			&item.MetadataJSON,
			&item.Payload,
			&item.ActorName,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func StreamAuditLogsJSONL(ctx context.Context, db *sql.DB, filters AuditLogFilters, out io.Writer) error {
	where, args := buildAuditWhere(filters)
	query := `SELECT a.id, a.tenant_id, a.created_at, a.actor_id, a.actor_type, a.actor_email_snapshot,
		a.action, a.target_type, a.target_id, a.request_id, a.idempotency_key,
		a.ip, a.user_agent, a.diff_json, a.metadata_json
		FROM audit_log a
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY a.created_at DESC`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	writer := bufio.NewWriter(out)
	defer writer.Flush()

	encoder := json.NewEncoder(writer)
	for rows.Next() {
		var (
			id             uuid.UUID
			tenantID       uuid.UUID
			createdAt      time.Time
			actorID        uuid.NullUUID
			actorType      sql.NullString
			actorEmail     sql.NullString
			action         string
			targetType     string
			targetID       sql.NullString
			requestID      sql.NullString
			idempotencyKey sql.NullString
			ip             sql.NullString
			userAgent      sql.NullString
			diffJSON       json.RawMessage
			metadataJSON   json.RawMessage
		)
		if err := rows.Scan(&id, &tenantID, &createdAt, &actorID, &actorType, &actorEmail, &action, &targetType, &targetID, &requestID, &idempotencyKey, &ip, &userAgent, &diffJSON, &metadataJSON); err != nil {
			return err
		}

		record := map[string]interface{}{
			"id":          id,
			"tenant_id":   tenantID,
			"created_at":  createdAt.UTC().Format(time.RFC3339),
			"action":      action,
			"target_type": targetType,
		}
		if actorID.Valid {
			record["actor_id"] = actorID.UUID
		}
		if actorType.Valid {
			record["actor_type"] = actorType.String
		}
		if actorEmail.Valid {
			record["actor_email_snapshot"] = actorEmail.String
		}
		if targetID.Valid {
			record["target_id"] = targetID.String
		}
		if requestID.Valid {
			record["request_id"] = requestID.String
		}
		if idempotencyKey.Valid {
			record["idempotency_key"] = idempotencyKey.String
		}
		if ip.Valid {
			record["ip"] = ip.String
		}
		if userAgent.Valid {
			record["user_agent"] = userAgent.String
		}
		if len(diffJSON) > 0 {
			var diff interface{}
			_ = json.Unmarshal(diffJSON, &diff)
			record["diff"] = diff
		}
		if len(metadataJSON) > 0 {
			var metadata interface{}
			_ = json.Unmarshal(metadataJSON, &metadata)
			record["metadata"] = metadata
		}
		if err := encoder.Encode(record); err != nil {
			return err
		}
	}
	return rows.Err()
}

func buildAuditWhere(filters AuditLogFilters) ([]string, []interface{}) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{filters.TenantID}

	if filters.From != nil {
		args = append(args, *filters.From)
		where = append(where, fmt.Sprintf("created_at >= $%d", len(args)))
	}
	if filters.To != nil {
		args = append(args, *filters.To)
		where = append(where, fmt.Sprintf("created_at <= $%d", len(args)))
	}
	if filters.ActorID != nil {
		args = append(args, *filters.ActorID)
		where = append(where, fmt.Sprintf("actor_id = $%d", len(args)))
	}
	if filters.TargetType != "" {
		args = append(args, filters.TargetType)
		where = append(where, fmt.Sprintf("target_type = $%d", len(args)))
	}
	if filters.TargetID != nil {
		args = append(args, *filters.TargetID)
		where = append(where, fmt.Sprintf("target_id = $%d", len(args)))
	}
	if filters.Action != "" {
		args = append(args, filters.Action)
		where = append(where, fmt.Sprintf("action = $%d", len(args)))
	}
	if filters.ScopeID != nil {
		args = append(args, *filters.ScopeID)
		where = append(where, fmt.Sprintf("scope_id = $%d", len(args)))
	}
	if filters.Query != "" {
		args = append(args, "%"+filters.Query+"%")
		where = append(where, fmt.Sprintf("(action ILIKE $%d OR target_type ILIKE $%d OR target_id ILIKE $%d OR metadata_json::text ILIKE $%d)", len(args), len(args), len(args), len(args)))
	}
	return where, args
}
