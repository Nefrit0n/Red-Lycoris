package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/auth"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func handleListUsers(usersRepo *storage.UsersRepo) http.HandlerFunc {
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

		users, total, err := usersRepo.List(r.Context(), limit, offset)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list users")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"data": users,
			"meta": map[string]any{"total": total},
		})
	}
}

func handleCreateUser(usersRepo *storage.UsersRepo) http.HandlerFunc {
	type request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
		IsAdmin  bool   `json:"is_admin"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		email := strings.TrimSpace(req.Email)
		if email == "" || req.Password == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "email and password are required")
			return
		}

		hash, err := auth.Hash(req.Password)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
			return
		}

		role := domain.RoleUser
		if req.IsAdmin {
			role = domain.RoleAdmin
		}

		u := &domain.User{
			Email:        email,
			PasswordHash: hash,
			FullName:     strings.TrimSpace(req.FullName),
			IsActive:     true,
			GlobalRole:   role,
		}
		if err := usersRepo.Create(r.Context(), u); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create user")
			return
		}

		u.PasswordHash = ""
		respondJSON(w, http.StatusCreated, map[string]any{"data": u})
	}
}

func handleUpdateUser(usersRepo *storage.UsersRepo) http.HandlerFunc {
	type request struct {
		IsActive *bool   `json:"is_active"`
		FullName *string `json:"full_name"`
		IsAdmin  *bool   `json:"is_admin"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		fields := map[string]any{}
		if req.IsActive != nil {
			fields["is_active"] = *req.IsActive
		}
		if req.FullName != nil {
			fields["full_name"] = strings.TrimSpace(*req.FullName)
		}
		if req.IsAdmin != nil {
			if *req.IsAdmin {
				fields["global_role"] = int16(domain.RoleAdmin)
			} else {
				fields["global_role"] = int16(domain.RoleUser)
			}
		}

		if err := usersRepo.Update(r.Context(), userID, fields); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update user")
			return
		}

		updated, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}
		updated.PasswordHash = ""
		respondJSON(w, http.StatusOK, map[string]any{"data": updated})
	}
}

func handleResetUserPassword(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	type request struct {
		NewPassword string `json:"new_password"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if strings.TrimSpace(req.NewPassword) == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "new_password is required")
			return
		}

		hash, err := auth.Hash(req.NewPassword)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
			return
		}

		if err := usersRepo.Update(r.Context(), userID, map[string]any{"password_hash": hash}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update password")
			return
		}
		if err := sessionsRepo.RevokeAllForUser(r.Context(), userID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "password reset"}})
	}
}

func handleGetUserRoles(rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		roles, err := rolesRepo.ListAllRolesForUser(r.Context(), userID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user roles")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": roles})
	}
}
