package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/storage"
)

const (
	savedViewMaxNameLen  = 120
	savedViewMaxQueryLen = 8 * 1024
)

func handleListSavedViews(repo *storage.SavedViewsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _ := UserFromContext(r.Context())

		views, err := repo.ListForUser(r.Context(), user.ID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list saved views")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": views})
	}
}

func handleCreateSavedView(repo *storage.SavedViewsRepo) http.HandlerFunc {
	type request struct {
		Name  string          `json:"name"`
		Query json.RawMessage `json:"query"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		user, _ := UserFromContext(r.Context())

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
			return
		}
		if len(name) > savedViewMaxNameLen {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name is too long")
			return
		}
		if len(req.Query) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "query is required")
			return
		}
		if len(req.Query) > savedViewMaxQueryLen {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "query payload is too large")
			return
		}
		// Sanity check that query is a JSON object, not a bare literal.
		var probe map[string]any
		if err := json.Unmarshal(req.Query, &probe); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "query must be a JSON object")
			return
		}

		view := &storage.SavedView{
			UserID: user.ID,
			Name:   name,
			Query:  req.Query,
		}
		if err := repo.Create(r.Context(), view); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create saved view")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]any{"data": view})
	}
}

func handleUpdateSavedView(repo *storage.SavedViewsRepo) http.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		user, _ := UserFromContext(r.Context())

		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid saved view id")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
			return
		}
		if len(name) > savedViewMaxNameLen {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name is too long")
			return
		}

		if err := repo.UpdateName(r.Context(), id, user.ID, name); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "saved view not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update saved view")
			return
		}

		view, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to reload saved view")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": view})
	}
}

func handleDeleteSavedView(repo *storage.SavedViewsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _ := UserFromContext(r.Context())

		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid saved view id")
			return
		}

		if err := repo.Delete(r.Context(), id, user.ID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "saved view not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete saved view")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
