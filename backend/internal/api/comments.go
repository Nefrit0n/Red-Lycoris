package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/microcosm-cc/bluemonday"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

var commentSanitizer = bluemonday.StrictPolicy()

type commentAuthor struct {
	ID       uuid.UUID `json:"id"`
	Email    string    `json:"email"`
	FullName string    `json:"full_name"`
}

type commentState struct {
	ID        uuid.UUID      `json:"id"`
	Author    *commentAuthor `json:"author,omitempty"`
	Text      string         `json:"text"`
	CreatedAt time.Time      `json:"created_at"`
	Edited    bool           `json:"edited"`
	Deleted   bool           `json:"deleted"`
}

func sanitizeCommentText(raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) == 0 {
		return "", "empty comment"
	}
	if len(trimmed) > 4096 {
		return "", "comment too long"
	}
	sanitized := strings.TrimSpace(commentSanitizer.Sanitize(trimmed))
	if sanitized == "" {
		return "", "empty comment"
	}
	return sanitized, ""
}

func handleCreateComment(eventsRepo *storage.FindingEventsRepo) http.HandlerFunc {
	type request struct {
		Text string `json:"text"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		findingID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		sanitized, validationErr := sanitizeCommentText(req.Text)
		if validationErr != "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", validationErr)
			return
		}

		user, _ := UserFromContext(r.Context())
		payload, _ := json.Marshal(domain.CommentAddedPayload{Text: sanitized})
		event := domain.FindingEvent{
			ID:        uuid.New(),
			FindingID: findingID,
			UserID:    &user.ID,
			EventType: domain.EventCommentAdded,
			Payload:   payload,
			CreatedAt: time.Now().UTC(),
		}
		if err := eventsRepo.Create(r.Context(), eventsRepo.Pool(), event); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create comment")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]any{"data": event})
	}
}

func handleEditComment(eventsRepo *storage.FindingEventsRepo) http.HandlerFunc {
	type request struct {
		Text string `json:"text"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		eventID, err := uuid.Parse(chi.URLParam(r, "event_id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid event id")
			return
		}
		original, err := eventsRepo.GetByID(r.Context(), eventID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "comment not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch comment")
			return
		}

		user, _ := UserFromContext(r.Context())
		canEdit := original.EventType == domain.EventCommentAdded &&
			original.UserID != nil && *original.UserID == user.ID &&
			original.CreatedAt.After(time.Now().UTC().Add(-15*time.Minute))
		if !canEdit {
			respondError(w, r, http.StatusForbidden, "FORBIDDEN", "cannot edit")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		sanitized, validationErr := sanitizeCommentText(req.Text)
		if validationErr != "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", validationErr)
			return
		}

		payload, _ := json.Marshal(domain.CommentEditedPayload{OriginalEventID: original.ID, NewText: sanitized})
		event := domain.FindingEvent{
			ID:        uuid.New(),
			FindingID: original.FindingID,
			UserID:    &user.ID,
			EventType: domain.EventCommentEdited,
			Payload:   payload,
			CreatedAt: time.Now().UTC(),
		}
		if err := eventsRepo.Create(r.Context(), eventsRepo.Pool(), event); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to edit comment")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": event})
	}
}

func handleDeleteComment(eventsRepo *storage.FindingEventsRepo, findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		eventID, err := uuid.Parse(chi.URLParam(r, "event_id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid event id")
			return
		}
		original, err := eventsRepo.GetByID(r.Context(), eventID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "comment not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch comment")
			return
		}
		if original.EventType != domain.EventCommentAdded {
			respondError(w, r, http.StatusForbidden, "FORBIDDEN", "cannot delete")
			return
		}

		projectID, err := findingsRepo.GetProjectID(r.Context(), original.FindingID.String())
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
			return
		}

		user, _ := UserFromContext(r.Context())
		isAuthor := original.UserID != nil && *original.UserID == user.ID
		isProjectAdmin := false
		if !user.IsAdmin() {
			role, has, err := rolesRepo.GetRole(r.Context(), user.ID, projectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check role")
				return
			}
			isProjectAdmin = has && role == domain.RoleProjectAdmin
		}
		if !isAuthor && !user.IsAdmin() && !isProjectAdmin {
			respondError(w, r, http.StatusForbidden, "FORBIDDEN", "cannot delete")
			return
		}

		payload, _ := json.Marshal(domain.CommentDeletedPayload{OriginalEventID: original.ID})
		event := domain.FindingEvent{
			ID:        uuid.New(),
			FindingID: original.FindingID,
			UserID:    &user.ID,
			EventType: domain.EventCommentDeleted,
			Payload:   payload,
			CreatedAt: time.Now().UTC(),
		}
		if err := eventsRepo.Create(r.Context(), eventsRepo.Pool(), event); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete comment")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleListComments(eventsRepo *storage.FindingEventsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		findingID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		events, err := eventsRepo.ListCommentsForFinding(r.Context(), findingID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list comments")
			return
		}

		states := map[uuid.UUID]*commentState{}
		for _, event := range events {
			switch event.EventType {
			case domain.EventCommentAdded:
				var payload domain.CommentAddedPayload
				if err := json.Unmarshal(event.Payload, &payload); err != nil {
					continue
				}
				st := &commentState{ID: event.ID, Text: payload.Text, CreatedAt: event.CreatedAt}
				if event.Author != nil {
					st.Author = &commentAuthor{ID: event.Author.ID, Email: event.Author.Email, FullName: event.Author.FullName}
				}
				states[event.ID] = st
			case domain.EventCommentEdited:
				var payload domain.CommentEditedPayload
				if err := json.Unmarshal(event.Payload, &payload); err != nil {
					continue
				}
				if st, ok := states[payload.OriginalEventID]; ok {
					st.Text = payload.NewText
					st.Edited = true
				}
			case domain.EventCommentDeleted:
				var payload domain.CommentDeletedPayload
				if err := json.Unmarshal(event.Payload, &payload); err != nil {
					continue
				}
				if st, ok := states[payload.OriginalEventID]; ok {
					st.Deleted = true
				}
			}
		}

		out := make([]commentState, 0, len(states))
		for _, st := range states {
			out = append(out, *st)
		}
		sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
		respondJSON(w, http.StatusOK, map[string]any{"data": out})
	}
}
