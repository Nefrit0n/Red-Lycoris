package api

import (
	"net/http"
	"strings"

	"redlycoris/internal/storage"
)

func handleSearchUsers(usersRepo *storage.UsersRepo) http.HandlerFunc {
	type userItem struct {
		ID       string `json:"id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" {
			respondJSON(w, http.StatusOK, map[string]any{"data": []userItem{}})
			return
		}

		users, err := usersRepo.SearchActive(r.Context(), q, 20)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to search users")
			return
		}

		result := make([]userItem, 0, len(users))
		for _, u := range users {
			result = append(result, userItem{ID: u.ID.String(), Email: u.Email, FullName: u.FullName})
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": result})
	}
}
