package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/audit"
	"redlycoris/internal/storage"
)

type statusCaptureWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusCaptureWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func AuditMiddleware(writer *audit.Writer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			if strings.HasPrefix(r.URL.Path, "/api/v1/auth/") {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			sw := &statusCaptureWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)

			rec := storage.AuditRecord{
				ID:         mustUUIDv7(),
				RequestID:  GetRequestID(r.Context()),
				Method:     r.Method,
				Path:       r.URL.Path,
				StatusCode: sw.status,
				UserAgent:  r.UserAgent(),
				DurationMs: int(time.Since(start).Milliseconds()),
				CreatedAt:  time.Now().UTC(),
			}
			if ip := extractIP(r); strings.TrimSpace(ip) != "" {
				rec.IP = &ip
			}
			if user, ok := UserFromContext(r.Context()); ok {
				rec.UserID = &user.ID
			}

			if rctx := chi.RouteContext(r.Context()); rctx != nil {
				rt, rid, act := parseResource(rctx, r)
				rec.ResourceType = ptrOrNil(rt)
				rec.ResourceID = ptrOrNil(rid)
				rec.Action = ptrOrNil(act)
			}

			writer.Submit(rec)
		})
	}
}

func parseResource(rctx *chi.Context, r *http.Request) (resType, resID, action string) {
	pattern := rctx.RoutePattern()
	parts := strings.Split(strings.TrimPrefix(pattern, "/api/v1/"), "/")
	if len(parts) == 0 {
		return
	}

	resType = singularize(parts[0])

	if id := rctx.URLParam("id"); id != "" {
		resID = id
	}
	if id := rctx.URLParam("event_id"); id != "" && resID == "" {
		resID = id
	}

	last := parts[len(parts)-1]
	switch {
	case strings.HasPrefix(last, "{"):
		switch r.Method {
		case http.MethodPost:
			action = "create"
		case http.MethodPut, http.MethodPatch:
			action = "update"
		case http.MethodDelete:
			action = "delete"
		}
	case last == "close":
		action = "close"
	case last == "reopen":
		action = "reopen"
	case last == "assign":
		if r.Method == http.MethodDelete {
			action = "unassign"
		} else {
			action = "assign"
		}
	case last == "comments":
		action = "comment"
	case last == "status":
		action = "change_status"
	case last == "members":
		action = "manage_members"
	default:
		if r.Method == http.MethodPost {
			action = "create"
		}
	}
	return
}

func singularize(s string) string {
	switch s {
	case "findings":
		return "finding"
	case "projects":
		return "project"
	case "users":
		return "user"
	case "comments":
		return "comment"
	default:
		return strings.TrimSuffix(s, "s")
	}
}

func mustUUIDv7() uuid.UUID {
	v, err := uuid.NewV7()
	if err == nil {
		return v
	}
	return uuid.New()
}

func ptrOrNil(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}
