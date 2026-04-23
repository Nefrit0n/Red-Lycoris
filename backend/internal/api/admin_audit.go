package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/storage"
)

type auditFeedGroup struct {
	Kind           string                `json:"kind"`
	Count          int                   `json:"count"`
	FirstTimestamp time.Time             `json:"first_timestamp"`
	LastTimestamp  time.Time             `json:"last_timestamp"`
	Sample         storage.AuditRecord   `json:"sample"`
	Events         []storage.AuditRecord `json:"events"`
}

func handleListAuditLog(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, err := parseAuditFilter(r)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		items, nextCursor, err := auditRepo.List(r.Context(), filter)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list audit")
			return
		}

		if strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("grouped")), "true") {
			respondList(w, groupAuditFeed(items), len(items), nextCursor)
			return
		}
		respondList(w, items, len(items), nextCursor)
	}
}

func parseAuditFilter(r *http.Request) (storage.AuditListFilter, error) {
	q := r.URL.Query()
	filter := storage.AuditListFilter{
		ResourceType: strings.TrimSpace(q.Get("resource_type")),
		ResourceID:   strings.TrimSpace(q.Get("resource_id")),
		Action:       strings.TrimSpace(q.Get("action")),
		Method:       strings.TrimSpace(q.Get("method")),
		RiskLevel:    strings.TrimSpace(q.Get("risk_level")),
		Q:            strings.TrimSpace(q.Get("q")),
		RequestID:    strings.TrimSpace(q.Get("request_id")),
		TraceID:      strings.TrimSpace(q.Get("trace_id")),
		SessionID:    strings.TrimSpace(q.Get("session_id")),
		Cursor:       strings.TrimSpace(q.Get("cursor")),
		Limit:        50,
	}

	if rawLimit := strings.TrimSpace(q.Get("limit")); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil {
			return storage.AuditListFilter{}, fmt.Errorf("invalid limit")
		}
		filter.Limit = parsed
	}
	if rawFrom := strings.TrimSpace(q.Get("from")); rawFrom != "" {
		parsed, err := time.Parse(time.RFC3339, rawFrom)
		if err != nil {
			return storage.AuditListFilter{}, fmt.Errorf("invalid from")
		}
		filter.From = &parsed
	}
	if rawTo := strings.TrimSpace(q.Get("to")); rawTo != "" {
		parsed, err := time.Parse(time.RFC3339, rawTo)
		if err != nil {
			return storage.AuditListFilter{}, fmt.Errorf("invalid to")
		}
		filter.To = &parsed
	}
	if rawUserID := strings.TrimSpace(q.Get("user_id")); rawUserID != "" {
		parsed, err := uuid.Parse(rawUserID)
		if err != nil {
			return storage.AuditListFilter{}, fmt.Errorf("invalid user_id")
		}
		filter.UserID = &parsed
	}
	if rawStatusMin := strings.TrimSpace(q.Get("status_min")); rawStatusMin != "" {
		parsed, err := strconv.Atoi(rawStatusMin)
		if err != nil {
			return storage.AuditListFilter{}, fmt.Errorf("invalid status_min")
		}
		filter.StatusMin = &parsed
	}
	return filter, nil
}

func handleGetAuditDiff(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawID := strings.TrimSpace(chi.URLParam(r, "id"))
		id, err := uuid.Parse(rawID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
			return
		}
		changes, err := auditRepo.GetDiff(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "audit event not found")
			return
		}
		for i := range changes {
			if changes[i].PII {
				changes[i].Before = "***"
				changes[i].After = "***"
			}
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": changes})
	}
}

func handleGetAuditEvent(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawID := strings.TrimSpace(chi.URLParam(r, "id"))
		id, err := uuid.Parse(rawID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
			return
		}
		event, err := auditRepo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "audit event not found")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": event})
	}
}

func handleGetRelatedAuditEvents(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawID := strings.TrimSpace(chi.URLParam(r, "id"))
		id, err := uuid.Parse(rawID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
			return
		}
		limit := 10
		if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
			parsed, convErr := strconv.Atoi(rawLimit)
			if convErr != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid limit")
				return
			}
			limit = parsed
		}
		items, err := auditRepo.ListRelated(r.Context(), id, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list related events")
			return
		}
		respondList(w, items, len(items), "")
	}
}

func handleAuditStats(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		to := time.Now().UTC()
		from := to.Add(-24 * time.Hour)

		if rawFrom := strings.TrimSpace(q.Get("from")); rawFrom != "" {
			parsed, err := time.Parse(time.RFC3339, rawFrom)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid from")
				return
			}
			from = parsed
		}
		if rawTo := strings.TrimSpace(q.Get("to")); rawTo != "" {
			parsed, err := time.Parse(time.RFC3339, rawTo)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid to")
				return
			}
			to = parsed
		}
		stats, err := auditRepo.Stats(r.Context(), from, to)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to build audit stats")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": stats})
	}
}

func handleAuditStream(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "streaming not supported")
			return
		}
		filter, err := parseAuditFilter(r)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		lastCreatedAt := time.Now().UTC().Add(-3 * time.Second)
		lastID := uuid.Nil
		if lastEventID := strings.TrimSpace(r.Header.Get("Last-Event-ID")); lastEventID != "" {
			parsed, parseErr := uuid.Parse(lastEventID)
			if parseErr == nil {
				event, getErr := auditRepo.GetByID(r.Context(), parsed)
				if getErr == nil {
					lastCreatedAt = event.CreatedAt
					lastID = parsed
				}
			}
		}

		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-ticker.C:
				items, listErr := auditRepo.ListAfter(r.Context(), filter, lastCreatedAt, lastID, 100)
				if listErr != nil {
					return
				}
				for _, item := range items {
					payload, marshalErr := json.Marshal(item)
					if marshalErr != nil {
						continue
					}
					_, _ = io.WriteString(w, "id: "+item.ID.String()+"\n")
					_, _ = io.WriteString(w, "event: audit\n")
					_, _ = io.WriteString(w, "data: "+string(payload)+"\n\n")
					flusher.Flush()
					lastCreatedAt = item.CreatedAt
					lastID = item.ID
				}
				_, _ = io.WriteString(w, ": heartbeat\n\n")
				flusher.Flush()
			}
		}
	}
}

func handleAuditExport(auditRepo *storage.AuditLogRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, err := parseAuditFilter(r)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
		if format != "csv" && format != "ndjson" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "format must be csv or ndjson")
			return
		}

		filter.Limit = 200
		if format == "csv" {
			w.Header().Set("Content-Type", "text/csv; charset=utf-8")
			w.Header().Set("Content-Disposition", "attachment; filename=\"audit-export.csv\"")
			cw := csv.NewWriter(w)
			_ = cw.Write([]string{"id", "timestamp", "user_email", "method", "path", "status", "resource", "action", "request_id", "trace_id", "session_id", "risk_level"})
			for {
				items, nextCursor, listErr := auditRepo.List(r.Context(), filter)
				if listErr != nil {
					return
				}
				for _, item := range items {
					resource := ""
					action := ""
					if item.ResourceType != nil {
						resource = *item.ResourceType
					}
					if item.Action != nil {
						action = *item.Action
					}
					userEmail := ""
					if item.UserEmail != nil {
						userEmail = *item.UserEmail
					}
					_ = cw.Write([]string{
						item.ID.String(),
						item.CreatedAt.Format(time.RFC3339),
						userEmail,
						item.Method,
						item.FullPath,
						strconv.Itoa(item.StatusCode),
						resource,
						action,
						item.RequestID,
						item.TraceID,
						item.SessionID,
						item.RiskLevel,
					})
				}
				cw.Flush()
				if nextCursor == "" {
					break
				}
				filter.Cursor = nextCursor
			}
			return
		}

		w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=\"audit-export.ndjson\"")
		enc := json.NewEncoder(w)
		for {
			items, nextCursor, listErr := auditRepo.List(r.Context(), filter)
			if listErr != nil {
				return
			}
			for _, item := range items {
				_ = enc.Encode(item)
			}
			if nextCursor == "" {
				break
			}
			filter.Cursor = nextCursor
		}
	}
}

func groupAuditFeed(items []storage.AuditRecord) []any {
	out := make([]any, 0, len(items))
	for i := 0; i < len(items); {
		current := items[i]
		groupEvents := []storage.AuditRecord{current}
		j := i + 1

		for j < len(items) {
			next := items[j]
			if !canGroupAuditEvents(groupEvents[0], next) {
				break
			}
			groupEvents = append(groupEvents, next)
			j++
		}

		if len(groupEvents) >= 3 {
			out = append(out, auditFeedGroup{
				Kind:           "group",
				Count:          len(groupEvents),
				FirstTimestamp: groupEvents[0].CreatedAt,
				LastTimestamp:  groupEvents[len(groupEvents)-1].CreatedAt,
				Sample:         groupEvents[0],
				Events:         groupEvents,
			})
			i = j
			continue
		}

		out = append(out, current)
		i++
	}
	return out
}

func canGroupAuditEvents(a, b storage.AuditRecord) bool {
	if a.UserID == nil || b.UserID == nil {
		return false
	}
	if *a.UserID != *b.UserID {
		return false
	}
	if a.Method != b.Method || a.Action == nil || b.Action == nil || *a.Action != *b.Action {
		return false
	}
	if a.ResourceType == nil || b.ResourceType == nil || *a.ResourceType != *b.ResourceType {
		return false
	}
	if a.ResourceID == nil || b.ResourceID == nil || *a.ResourceID != *b.ResourceID {
		return false
	}
	delta := a.CreatedAt.Sub(b.CreatedAt)
	if delta < 0 {
		delta = -delta
	}
	return delta <= 30*time.Second
}
