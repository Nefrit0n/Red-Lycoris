package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"redlycoris/internal/storage"
)

func handleListAuditLog(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		filter := storage.AuditListFilter{
			ResourceType: strings.TrimSpace(q.Get("resource_type")),
			ResourceID:   strings.TrimSpace(q.Get("resource_id")),
			Action:       strings.TrimSpace(q.Get("action")),
			Q:            strings.TrimSpace(q.Get("q")),
			RequestID:    strings.TrimSpace(q.Get("request_id")),
			Cursor:       strings.TrimSpace(q.Get("cursor")),
			Limit:        50,
		}

		if rawLimit := strings.TrimSpace(q.Get("limit")); rawLimit != "" {
			if parsed, err := strconv.Atoi(rawLimit); err == nil {
				filter.Limit = parsed
			}
		}
		if rawFrom := strings.TrimSpace(q.Get("from")); rawFrom != "" {
			parsed, err := time.Parse(time.RFC3339, rawFrom)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid from")
				return
			}
			filter.From = &parsed
		}
		if rawTo := strings.TrimSpace(q.Get("to")); rawTo != "" {
			parsed, err := time.Parse(time.RFC3339, rawTo)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid to")
				return
			}
			filter.To = &parsed
		}
		if rawUserID := strings.TrimSpace(q.Get("user_id")); rawUserID != "" {
			parsed, err := uuid.Parse(rawUserID)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user_id")
				return
			}
			filter.UserID = &parsed
		}

		items, nextCursor, err := auditRepo.List(r.Context(), filter)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list audit")
			return
		}
		respondList(w, items, len(items), nextCursor)
	}
}
