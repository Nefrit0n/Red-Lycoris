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

			riskLevel, riskSignals := deriveAuditRisk(r.Method, sw.status)
			uaParsed := parseUserAgent(r.UserAgent())

			rec := storage.AuditRecord{
				ID:          mustUUIDv7(),
				RequestID:   GetRequestID(r.Context()),
				TraceID:     strings.TrimSpace(r.Header.Get("X-Trace-Id")),
				Method:      r.Method,
				Path:        r.URL.Path,
				FullPath:    r.URL.RequestURI(),
				StatusCode:  sw.status,
				UserAgent:   r.UserAgent(),
				UAParsed:    uaParsed,
				DurationMs:  int(time.Since(start).Milliseconds()),
				CreatedAt:   time.Now().UTC(),
				RiskLevel:   riskLevel,
				RiskSignals: riskSignals,
			}
			if ip := extractIP(r); strings.TrimSpace(ip) != "" {
				masked := maskIP(ip)
				rec.IP = &masked
			}
			if user, ok := UserFromContext(r.Context()); ok {
				rec.UserID = &user.ID
			}
			if session, ok := SessionFromContext(r.Context()); ok {
				rec.SessionID = session.ID.String()
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

func deriveAuditRisk(method string, status int) (string, []string) {
	signals := make([]string, 0, 2)
	level := "low"

	if method == http.MethodDelete {
		level = "high"
		signals = append(signals, "delete_action")
	}
	if status >= 400 && status < 500 {
		if level == "low" {
			level = "medium"
		}
		signals = append(signals, "client_error")
	}
	if status >= 500 {
		level = "critical"
		signals = append(signals, "server_error")
	}

	return level, signals
}

func parseUserAgent(raw string) *storage.AuditUAParsed {
	ua := strings.ToLower(raw)
	parsed := &storage.AuditUAParsed{Browser: "Unknown", OS: "Unknown"}

	switch {
	case strings.Contains(ua, "edg"):
		parsed.Browser = "Edge"
	case strings.Contains(ua, "firefox"):
		parsed.Browser = "Firefox"
	case strings.Contains(ua, "chrome"):
		parsed.Browser = "Chrome"
	case strings.Contains(ua, "safari"):
		parsed.Browser = "Safari"
	}

	switch {
	case strings.Contains(ua, "windows"):
		parsed.OS = "Windows"
	case strings.Contains(ua, "mac os") || strings.Contains(ua, "macintosh"):
		parsed.OS = "macOS"
	case strings.Contains(ua, "android"):
		parsed.OS = "Android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		parsed.OS = "iOS"
	case strings.Contains(ua, "linux"):
		parsed.OS = "Linux"
	}

	return parsed
}

func maskIP(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) == 4 {
		parts[3] = "x"
		return strings.Join(parts, ".")
	}
	return ip
}
