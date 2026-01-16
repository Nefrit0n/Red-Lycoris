package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"lotus-warden/backend/internal/models"

	"github.com/google/uuid"
)

type FindingEventItem struct {
	ID            uuid.UUID
	FindingID     uuid.UUID
	ActorID       uuid.NullUUID
	EventType     string
	Payload       json.RawMessage
	CreatedAt     time.Time
	ActorUsername sql.NullString
}

func ListFindingEvents(ctx context.Context, db *sql.DB, findingID uuid.UUID) ([]FindingEventItem, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT fe.id, fe.finding_id, fe.actor_id, fe.event_type, fe.payload, fe.created_at, u.username
		 FROM finding_events fe
		 LEFT JOIN users u ON u.id = fe.actor_id
		 WHERE fe.finding_id = $1
		 ORDER BY fe.created_at DESC`,
		findingID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []FindingEventItem{}
	for rows.Next() {
		var item FindingEventItem
		if err := rows.Scan(&item.ID, &item.FindingID, &item.ActorID, &item.EventType, &item.Payload, &item.CreatedAt, &item.ActorUsername); err != nil {
			return nil, err
		}
		events = append(events, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return events, nil
}

func CreateFindingEvent(ctx context.Context, db *sql.DB, event *models.FindingEvent) error {
	if err := event.Validate(); err != nil {
		return err
	}
	event.PrepareForInsert()

	var actorID interface{}
	if event.ActorID != nil {
		actorID = *event.ActorID
	}
	payload := event.Payload
	if len(payload) == 0 {
		payload = []byte("{}")
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO finding_events (id, finding_id, actor_id, event_type, payload, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		event.ID,
		event.FindingID,
		actorID,
		event.EventType,
		payload,
		event.CreatedAt,
	)
	return err
}
