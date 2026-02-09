package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

type AuditLogItem struct {
	ID         uuid.UUID
	OccurredAt time.Time
	ActorID    uuid.NullUUID
	ActorType  sql.NullString
	Action     string
	TargetType string
	TargetID   sql.NullString
	Scope      string
	ScopeID    uuid.NullUUID
	Payload    json.RawMessage
	ActorName  sql.NullString
}

type AuditLogFilters struct {
	From       *time.Time
	To         *time.Time
	ActorID    *uuid.UUID
	TargetType string
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

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO audit_log (id, occurred_at, actor_id, actor_type, action, target_type, target_id, scope, scope_id, payload_json)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		entry.ID,
		entry.OccurredAt,
		actorID,
		actorType,
		entry.Action,
		entry.TargetType,
		targetID,
		entry.Scope,
		scopeID,
		entry.Payload,
	)
	return err
}

func ListAuditLogs(ctx context.Context, db *sql.DB, filters AuditLogFilters) ([]AuditLogItem, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}

	if filters.From != nil {
		args = append(args, *filters.From)
		where = append(where, fmt.Sprintf("occurred_at >= $%d", len(args)))
	}
	if filters.To != nil {
		args = append(args, *filters.To)
		where = append(where, fmt.Sprintf("occurred_at <= $%d", len(args)))
	}
	if filters.ActorID != nil {
		args = append(args, *filters.ActorID)
		where = append(where, fmt.Sprintf("actor_id = $%d", len(args)))
	}
	if filters.TargetType != "" {
		args = append(args, filters.TargetType)
		where = append(where, fmt.Sprintf("target_type = $%d", len(args)))
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
		where = append(where, fmt.Sprintf("(action ILIKE $%d OR target_type ILIKE $%d OR target_id ILIKE $%d OR payload_json::text ILIKE $%d)", len(args), len(args), len(args), len(args)))
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	var countBuilder strings.Builder
	countBuilder.WriteString("SELECT COUNT(*) FROM audit_log WHERE ")
	countBuilder.WriteString(whereClause)
	countQuery := countBuilder.String()
	if err := db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, filters.Limit, filters.Offset)
	var listBuilder strings.Builder
	listBuilder.WriteString(`SELECT a.id, a.occurred_at, a.actor_id, a.actor_type, a.action, a.target_type, a.target_id, a.scope, a.scope_id, a.payload_json, u.username
		 FROM audit_log a
		 LEFT JOIN users u ON u.id = a.actor_id
		 WHERE `)
	listBuilder.WriteString(whereClause)
	listBuilder.WriteString(`
		 ORDER BY a.occurred_at DESC
		 LIMIT $`)
	listBuilder.WriteString(strconv.Itoa(len(args) - 1))
	listBuilder.WriteString(` OFFSET $`)
	listBuilder.WriteString(strconv.Itoa(len(args)))
	listQuery := listBuilder.String()

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
			&item.OccurredAt,
			&item.ActorID,
			&item.ActorType,
			&item.Action,
			&item.TargetType,
			&item.TargetID,
			&item.Scope,
			&item.ScopeID,
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
