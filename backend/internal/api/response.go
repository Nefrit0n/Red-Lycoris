package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Warn("failed to encode json response", "error", sanitizeForLog(err.Error()))
	}
}

func respondError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	respondJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":       code,
			"message":    message,
			"request_id": GetRequestID(r.Context()),
		},
	})
}

type listMeta struct {
	Total      int    `json:"total"`
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
}

func respondList(w http.ResponseWriter, data any, total int, nextCursor string) {
	respondJSON(w, http.StatusOK, map[string]any{
		"data": data,
		"meta": listMeta{
			Total:      total,
			NextCursor: nextCursor,
			HasMore:    nextCursor != "",
		},
	})
}

func setPublicCacheHeaders(w http.ResponseWriter, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	seconds := int(ttl.Seconds())
	if seconds <= 0 {
		return
	}
	w.Header().Set("Cache-Control", "public, max-age="+strconv.Itoa(seconds))
	w.Header().Set("Expires", time.Now().UTC().Add(time.Duration(seconds)*time.Second).Format(http.TimeFormat))
}

func sanitizeForLog(v string) string {
	replacer := strings.NewReplacer(
		"\r", "\\r",
		"\n", "\\n",
		"\t", "\\t",
	)
	return replacer.Replace(v)
}
