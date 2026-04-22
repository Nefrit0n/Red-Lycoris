package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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
		actor, _ := UserFromContext(r.Context())

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
			Status:       domain.UserStatusActive,
		}
		if actor != nil {
			u.CreatedByUserID = &actor.ID
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
		FullName *string `json:"full_name"`
		Email    *string `json:"email"`
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
		if req.FullName != nil {
			fields["full_name"] = strings.TrimSpace(*req.FullName)
		}
		if req.Email != nil {
			fields["email"] = strings.TrimSpace(*req.Email)
		}
		if len(fields) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "no fields to update")
			return
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

// handleChangeUserRole меняет глобальную роль пользователя с проверками self-lockout.
func handleChangeUserRole(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	type request struct {
		IsAdmin bool `json:"is_admin"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

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

		target, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}

		// Если снимаем admin — применяем защиту
		removingAdmin := target.IsAdmin() && !req.IsAdmin
		if removingAdmin {
			if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionRemoveRoleAdmin); err != nil {
				respondGuardError(w, r, err)
				return
			}
		}

		newRole := domain.RoleUser
		if req.IsAdmin {
			newRole = domain.RoleAdmin
		}
		if err := usersRepo.Update(r.Context(), userID, map[string]any{"global_role": int16(newRole)}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update role")
			return
		}

		// Инвалидируем сессии при смене роли
		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "role_changed"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
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

// handleDeactivateUser деактивирует пользователя и завершает все его сессии.
func handleDeactivateUser(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		target, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}

		if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionDeactivate); err != nil {
			respondGuardError(w, r, err)
			return
		}

		if err := usersRepo.Update(r.Context(), userID, map[string]any{
			"is_active": false,
			"status":    string(domain.UserStatusDisabled),
		}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to deactivate user")
			return
		}

		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "deactivated"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "deactivated"}})
	}
}

// handleActivateUser активирует ранее отключённого пользователя.
func handleActivateUser(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		target, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}

		// system_account нельзя деактивировать, значит и активировать незачем
		if target.IsSystemAccount {
			respondError(w, r, http.StatusForbidden, "SYSTEM_ACCOUNT_PROTECTED", "Системная учётная запись защищена")
			return
		}

		if err := usersRepo.Update(r.Context(), userID, map[string]any{
			"is_active": true,
			"status":    string(domain.UserStatusActive),
		}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to activate user")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "activated"}})
	}
}

// handleDeleteUser выполняет soft delete: деактивирует и обезличивает пользователя,
// сохраняя запись для аудита.
func handleDeleteUser(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

		userID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}

		target, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}

		if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionDelete); err != nil {
			respondGuardError(w, r, err)
			return
		}

		// Soft delete: деактивируем + помечаем статус
		if err := usersRepo.Update(r.Context(), userID, map[string]any{
			"is_active": false,
			"status":    string(domain.UserStatusDisabled),
		}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete user")
			return
		}

		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "deactivated"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "deleted"}})
	}
}

func handleResetUserPassword(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	type request struct {
		NewPassword string `json:"new_password"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

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

		target, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}

		if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionResetPassword); err != nil {
			respondGuardError(w, r, err)
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

		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "password_changed"); err != nil {
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
