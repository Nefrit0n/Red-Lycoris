package api

import (
	"encoding/json"
	"net/http"
)

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
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
