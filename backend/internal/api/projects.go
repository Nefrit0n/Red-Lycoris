package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func handleListProjects(repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		offset := 0

		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				limit = n
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				offset = n
			}
		}

		user, _ := UserFromContext(r.Context())

		var accessible []uuid.UUID
		if !user.IsAdmin() {
			projectIDs, idsErr := rolesRepo.ListProjectIDsForUser(r.Context(), user.ID)
			if idsErr != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list projects")
				return
			}
			accessible = projectIDs
			if len(accessible) == 0 {
				respondList(w, []domain.Project{}, 0, "")
				return
			}
		}

		projects, total, err := repo.List(r.Context(), storage.ProjectsFilter{
			AccessibleProjectIDs: accessible,
			Limit:                limit,
			Offset:               offset,
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list projects")
			return
		}

		hasMore := offset+limit < total
		var nextCursor string
		if hasMore {
			nextCursor = strconv.Itoa(offset + limit)
		}

		respondList(w, projects, total, nextCursor)
	}
}

func handleCreateProject(pool *pgxpool.Pool, repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p domain.Project
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		if err := p.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		tx, err := pool.Begin(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}
		defer tx.Rollback(r.Context())

		if err := repo.CreateTx(r.Context(), tx, &p); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}
		user, _ := UserFromContext(r.Context())
		if err := rolesRepo.Grant(r.Context(), tx, user.ID, p.ID, domain.RoleProjectAdmin, &user.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to grant project role")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}

		respondJSON(w, http.StatusCreated, map[string]any{"data": p})
	}
}

func handleGetProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		p, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": p})
	}
}

func handleUpdateProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		var p domain.Project
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		p.ID = id

		if err := p.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		if err := repo.Update(r.Context(), &p); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": p})
	}
}

func handleDeleteProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		if err := repo.Delete(r.Context(), id); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
