package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type FindingEventType string

const (
	FindingEventStatusChanged FindingEventType = "status_changed"
	FindingEventClosed        FindingEventType = "closed"
	FindingEventReopened      FindingEventType = "reopened"
	FindingEventAssigned      FindingEventType = "assigned"
	FindingEventUnassigned    FindingEventType = "unassigned"
	FindingEventCreated       FindingEventType = "created"
	EventCommentAdded         FindingEventType = "comment_added"
	EventCommentEdited        FindingEventType = "comment_edited"
	EventCommentDeleted       FindingEventType = "comment_deleted"
)

type FindingEvent struct {
	ID        uuid.UUID        `json:"id"`
	FindingID uuid.UUID        `json:"finding_id"`
	UserID    *uuid.UUID       `json:"user_id,omitempty"`
	EventType FindingEventType `json:"event_type"`
	Payload   json.RawMessage  `json:"payload"`
	CreatedAt time.Time        `json:"created_at"`
}

type StatusChangedPayload struct {
	From int `json:"from"`
	To   int `json:"to"`
}

type ClosedPayload struct {
	ReasonCode string `json:"reason_code"`
	Note       string `json:"note,omitempty"`
	Status     int    `json:"status"`
}

type ReopenedPayload struct {
	PreviousStatus   int    `json:"previous_status"`
	PreviousReasonID *int16 `json:"previous_reason_id,omitempty"`
	Note             string `json:"note,omitempty"`
}

type AssignedPayload struct {
	ToUserID *uuid.UUID `json:"to_user_id,omitempty"`
	ToEmail  string     `json:"to_email,omitempty"`
}

type CreatedPayload struct {
	SourceType string `json:"source_type,omitempty"`
	SourceID   string `json:"source_id,omitempty"`
}

type CommentAddedPayload struct {
	Text string `json:"text"`
}

type CommentEditedPayload struct {
	OriginalEventID uuid.UUID `json:"original_event_id"`
	NewText         string    `json:"new_text"`
}

type CommentDeletedPayload struct {
	OriginalEventID uuid.UUID `json:"original_event_id"`
}
