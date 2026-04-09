package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func handleListMembers(rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		members, err := rolesRepo.ListForProject(r.Context(), projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list members")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": members})
	}
}

func handleAddMember(rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type request struct {
		UserID uuid.UUID          `json:"user_id"`
		Role   domain.ProjectRole `json:"role"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if req.UserID == uuid.Nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "user_id is required")
			return
		}

		grantedBy := func() *uuid.UUID {
			u, _ := UserFromContext(r.Context())
			if u == nil {
				return nil
			}
			return &u.ID
		}()

		if err := rolesRepo.Grant(r.Context(), nil, req.UserID, projectID, req.Role, grantedBy); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to add member")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleUpdateMember(rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type request struct {
		Role domain.ProjectRole `json:"role"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		userID, err := uuid.Parse(chi.URLParam(r, "user_id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		prevRole, ok, err := rolesRepo.GetRole(r.Context(), userID, projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check role")
			return
		}
		if !ok {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}

		if prevRole == domain.RoleProjectAdmin && req.Role < domain.RoleProjectAdmin {
			admins, err := rolesRepo.CountProjectAdmins(r.Context(), projectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check admins")
				return
			}
			if admins == 1 {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "cannot demote last project admin")
				return
			}
		}

		if err := rolesRepo.Update(r.Context(), userID, projectID, req.Role); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update member")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleRemoveMember(rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		userID, err := uuid.Parse(chi.URLParam(r, "user_id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		prevRole, ok, err := rolesRepo.GetRole(r.Context(), userID, projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check role")
			return
		}
		if !ok {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "member not found")
			return
		}
		if prevRole == domain.RoleProjectAdmin {
			admins, err := rolesRepo.CountProjectAdmins(r.Context(), projectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check admins")
				return
			}
			if admins == 1 {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "cannot demote last project admin")
				return
			}
		}

		if err := rolesRepo.Revoke(r.Context(), userID, projectID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to remove member")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}
