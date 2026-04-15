package domain

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ClosureReasonLookup interface {
	ByCode(string) (*ClosureReason, bool)
}

type TriageAction interface {
	ApplyTo(f *Finding, reasons ClosureReasonLookup) error
	BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error)
}

type ChangeStatusAction struct {
	NewStatus int
	oldStatus int
}

func (a *ChangeStatusAction) ApplyTo(f *Finding, _ ClosureReasonLookup) error {
	if a.NewStatus != StatusOpen && a.NewStatus != StatusConfirmed {
		return errors.New("use /close to close findings")
	}
	a.oldStatus = f.Status
	f.Status = a.NewStatus
	return nil
}

func (a *ChangeStatusAction) BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error) {
	payload, err := json.Marshal(StatusChangedPayload{From: a.oldStatus, To: a.NewStatus})
	if err != nil {
		return FindingEvent{}, fmt.Errorf("marshal status_changed payload: %w", err)
	}
	uid := userID
	return FindingEvent{ID: uuid.New(), FindingID: f.ID, UserID: &uid, EventType: FindingEventStatusChanged, Payload: payload, CreatedAt: time.Now()}, nil
}

type CloseAction struct {
	ReasonCode string
	Note       string
	UserID     uuid.UUID
	reasonID   int16
	target     int
}

func (a *CloseAction) ApplyTo(f *Finding, reasons ClosureReasonLookup) error {
	reason, ok := reasons.ByCode(a.ReasonCode)
	if !ok || !reason.IsActive {
		return errors.New("invalid closure reason")
	}
	note := strings.TrimSpace(a.Note)
	if reason.RequiresNote && note == "" {
		return errors.New("note required")
	}
	now := time.Now()
	f.Status = reason.TargetStatus
	f.ClosureReasonID = &reason.ID
	f.ClosureNote = &note
	f.ClosedAt = &now
	f.ClosedBy = &a.UserID
	a.reasonID = reason.ID
	a.target = reason.TargetStatus
	return nil
}

func (a *CloseAction) BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error) {
	payload, err := json.Marshal(ClosedPayload{ReasonCode: a.ReasonCode, Note: strings.TrimSpace(a.Note), Status: a.target})
	if err != nil {
		return FindingEvent{}, fmt.Errorf("marshal closed payload: %w", err)
	}
	uid := userID
	return FindingEvent{ID: uuid.New(), FindingID: f.ID, UserID: &uid, EventType: FindingEventClosed, Payload: payload, CreatedAt: time.Now()}, nil
}

type ReopenAction struct {
	Note             string
	previousStatus   int
	previousReasonID *int16
}

func (a *ReopenAction) ApplyTo(f *Finding, _ ClosureReasonLookup) error {
	if f.Status != StatusFP && f.Status != StatusResolved && f.Status != StatusRiskAccepted {
		return errors.New("can only reopen closed findings")
	}
	a.previousStatus = f.Status
	a.previousReasonID = f.ClosureReasonID
	f.Status = StatusOpen
	f.ClosureReasonID = nil
	f.ClosureNote = nil
	f.ClosedAt = nil
	f.ClosedBy = nil
	return nil
}

func (a *ReopenAction) BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error) {
	payload, err := json.Marshal(ReopenedPayload{PreviousStatus: a.previousStatus, PreviousReasonID: a.previousReasonID, Note: strings.TrimSpace(a.Note)})
	if err != nil {
		return FindingEvent{}, fmt.Errorf("marshal reopened payload: %w", err)
	}
	uid := userID
	return FindingEvent{ID: uuid.New(), FindingID: f.ID, UserID: &uid, EventType: FindingEventReopened, Payload: payload, CreatedAt: time.Now()}, nil
}

type AssignAction struct {
	ToUserID uuid.UUID
	ToEmail  string
}

func (a *AssignAction) ApplyTo(f *Finding, _ ClosureReasonLookup) error {
	f.AssignedTo = &a.ToUserID
	return nil
}

func (a *AssignAction) BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error) {
	uid := a.ToUserID
	payload, err := json.Marshal(AssignedPayload{ToUserID: &uid, ToEmail: a.ToEmail})
	if err != nil {
		return FindingEvent{}, fmt.Errorf("marshal assigned payload: %w", err)
	}
	actor := userID
	return FindingEvent{ID: uuid.New(), FindingID: f.ID, UserID: &actor, EventType: FindingEventAssigned, Payload: payload, CreatedAt: time.Now()}, nil
}

type UnassignAction struct{}

func (a *UnassignAction) ApplyTo(f *Finding, _ ClosureReasonLookup) error {
	f.AssignedTo = nil
	return nil
}

func (a *UnassignAction) BuildEvent(userID uuid.UUID, f *Finding) (FindingEvent, error) {
	payload, err := json.Marshal(AssignedPayload{})
	if err != nil {
		return FindingEvent{}, fmt.Errorf("marshal unassigned payload: %w", err)
	}
	actor := userID
	return FindingEvent{ID: uuid.New(), FindingID: f.ID, UserID: &actor, EventType: FindingEventUnassigned, Payload: payload, CreatedAt: time.Now()}, nil
}
