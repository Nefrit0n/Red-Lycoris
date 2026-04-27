package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/auth"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func decodeJSONAllowEmpty(r *http.Request, dst any) error {
	if r.Body == nil {
		return nil
	}
	err := json.NewDecoder(r.Body).Decode(dst)
	if err != nil && errors.Is(err, io.EOF) {
		return nil
	}
	return err
}

func writeAdminUserAudit(
	r *http.Request,
	auditWriter interface{ Submit(storage.AuditRecord) },
	actorID uuid.UUID,
	targetID uuid.UUID,
	action string,
	before map[string]any,
	after map[string]any,
	reason string,
) {
	if auditWriter == nil {
		return
	}

	resourceType := "user"
	resourceID := targetID.String()
	changes := make([]storage.AuditChange, 0, 3)
	if before != nil || after != nil {
		changes = append(changes, storage.AuditChange{
			Field:  "state",
			Before: before,
			After:  after,
		})
	}
	if trimmedReason := strings.TrimSpace(reason); trimmedReason != "" {
		changes = append(changes, storage.AuditChange{
			Field:  "reason",
			Before: nil,
			After:  trimmedReason,
		})
	}

	rec := storage.AuditRecord{
		ID:           mustUUIDv7(),
		RequestID:    GetRequestID(r.Context()),
		TraceID:      strings.TrimSpace(r.Header.Get("X-Trace-Id")),
		Method:       r.Method,
		Path:         r.URL.Path,
		FullPath:     r.URL.RequestURI(),
		StatusCode:   http.StatusOK,
		UserAgent:    r.UserAgent(),
		CreatedAt:    time.Now().UTC(),
		UserID:       &actorID,
		ResourceType: &resourceType,
		ResourceID:   &resourceID,
		Action:       &action,
		RiskLevel:    "high",
		Changes:      changes,
	}
	if ip := extractIP(r); strings.TrimSpace(ip) != "" {
		masked := maskIP(ip)
		rec.IP = &masked
	}
	auditWriter.Submit(rec)
}

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

func handleCreateUser(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
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
		if actor != nil {
			writeAdminUserAudit(
				r, auditWriter, actor.ID, u.ID, "create",
				nil,
				map[string]any{"email": u.Email, "full_name": u.FullName, "global_role": int(u.GlobalRole), "status": string(u.Status)},
				"",
			)
		}

		u.PasswordHash = ""
		respondJSON(w, http.StatusCreated, map[string]any{"data": u})
	}
}

func handleUpdateUser(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		FullName *string `json:"full_name"`
		Email    *string `json:"email"`
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

		before, err := usersRepo.GetByID(r.Context(), userID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
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
		if actor != nil {
			writeAdminUserAudit(
				r, auditWriter, actor.ID, updated.ID, "update",
				map[string]any{"email": before.Email, "full_name": before.FullName},
				map[string]any{"email": updated.Email, "full_name": updated.FullName},
				"",
			)
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": updated})
	}
}

// handleChangeUserRole меняет глобальную роль пользователя с проверками self-lockout.
func handleChangeUserRole(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		IsAdmin bool   `json:"is_admin"`
		Reason  string `json:"reason"`
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
			if len([]rune(strings.TrimSpace(req.Reason))) < 10 {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "reason must be at least 10 characters")
				return
			}
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
		writeAdminUserAudit(
			r, auditWriter, actor.ID, updated.ID, "role_change",
			map[string]any{"global_role": int(target.GlobalRole)},
			map[string]any{"global_role": int(updated.GlobalRole)},
			req.Reason,
		)
		respondJSON(w, http.StatusOK, map[string]any{"data": updated})
	}
}

// handleDeactivateUser деактивирует пользователя и завершает все его сессии.
func handleDeactivateUser(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Reason string `json:"reason"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		var req request
		if err := decodeJSONAllowEmpty(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

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

		if len([]rune(strings.TrimSpace(req.Reason))) < 10 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "reason must be at least 10 characters")
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
		writeAdminUserAudit(
			r, auditWriter, actor.ID, target.ID, "deactivate",
			map[string]any{"status": string(target.Status), "is_active": target.IsActive},
			map[string]any{"status": string(domain.UserStatusDisabled), "is_active": false},
			req.Reason,
		)

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "deactivated"}})
	}
}

// handleActivateUser активирует ранее отключённого пользователя.
func handleActivateUser(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Reason string `json:"reason"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		var req request
		if err := decodeJSONAllowEmpty(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
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
		if actor != nil {
			writeAdminUserAudit(
				r, auditWriter, actor.ID, target.ID, "activate",
				map[string]any{"status": string(target.Status), "is_active": target.IsActive},
				map[string]any{"status": string(domain.UserStatusActive), "is_active": true},
				req.Reason,
			)
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "activated"}})
	}
}

// handleDeleteUser выполняет soft delete: деактивирует и обезличивает пользователя,
// сохраняя запись для аудита.
func handleDeleteUser(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Reason string `json:"reason"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		var req request
		if err := decodeJSONAllowEmpty(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

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

		if len([]rune(strings.TrimSpace(req.Reason))) < 10 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "reason must be at least 10 characters")
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
		writeAdminUserAudit(
			r, auditWriter, actor.ID, target.ID, "delete",
			map[string]any{"status": string(target.Status), "is_active": target.IsActive},
			map[string]any{"status": string(domain.UserStatusDisabled), "is_active": false},
			req.Reason,
		)

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "deleted"}})
	}
}

func handleResetUserPassword(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		NewPassword string `json:"new_password"`
		Reason      string `json:"reason"`
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
		if len([]rune(strings.TrimSpace(req.Reason))) < 10 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "reason must be at least 10 characters")
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

		// Mark user as must change password on next login.
		if err := usersRepo.SetMustChangePassword(r.Context(), userID, true, "admin_reset"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set password change requirement")
			return
		}

		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "password_changed"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}
		writeAdminUserAudit(
			r, auditWriter, actor.ID, target.ID, "password_reset",
			map[string]any{"password_changed": false},
			map[string]any{"password_changed": true, "must_change": true},
			req.Reason,
		)

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]string{"status": "password reset", "temp_password": req.NewPassword},
		})
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
