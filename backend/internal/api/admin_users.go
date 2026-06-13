package api

import (
	crand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
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
		f := parseUserListFilter(r)
		users, total, hasMore, nextCursor, err := usersRepo.ListV2(r.Context(), f)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list users")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{
			"data": users,
			"meta": map[string]any{
				"total":       total,
				"has_more":    hasMore,
				"next_cursor": nextCursor,
			},
		})
	}
}

// validRoleKeys is the set of allowed role keys for user creation.
var validRoleKeys = map[string]bool{
	"admin": true, "auditor": true, "member": true, "viewer": true,
}

// commonPasswords is a minimal list used for backend password strength check.
var commonPasswords = map[string]bool{
	"password123456": true, "qwerty123456": true, "123456789012": true,
	"iloveyou1234": true, "admin123456!": true, "letmein12345": true,
	"welcome12345": true, "monkey123456": true, "dragon123456": true,
	"master123456": true, "passw0rd1234": true, "abc123456789": true,
}

func handleCreateUser(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Email                string   `json:"email"`
		DisplayName          string   `json:"display_name"`
		Password             string   `json:"password"`
		RoleKey              string   `json:"role_key"`
		GroupIDs             []string `json:"group_ids"`
		SendCredentialsEmail bool     `json:"send_credentials_email"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		if email == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "email is required")
			return
		}
		if req.Password == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "password is required")
			return
		}
		if len([]rune(req.Password)) < 12 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 12 characters")
			return
		}
		if strings.EqualFold(req.Password, email) {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "password must not match email")
			return
		}
		if commonPasswords[strings.ToLower(req.Password)] {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "password is too common")
			return
		}

		roleKey := req.RoleKey
		if roleKey == "" {
			roleKey = "member"
		}
		if !validRoleKeys[roleKey] {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid role_key")
			return
		}

		// Validate group UUIDs
		groupIDs := make([]uuid.UUID, 0, len(req.GroupIDs))
		for _, rawID := range req.GroupIDs {
			gid, err := uuid.Parse(rawID)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group_id: "+rawID)
				return
			}
			groupIDs = append(groupIDs, gid)
		}

		// Check email uniqueness
		available, err := usersRepo.CheckEmailAvailable(r.Context(), email)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check email")
			return
		}
		if !available {
			respondError(w, r, http.StatusConflict, "EMAIL_TAKEN", "this email is already in use")
			return
		}

		globalRole := domain.RoleUser
		if roleKey == "admin" {
			globalRole = domain.RoleAdmin
		}

		hash, err := auth.Hash(req.Password)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
			return
		}

		u := &domain.User{
			Email:        email,
			PasswordHash: hash,
			FullName:     strings.TrimSpace(req.DisplayName),
			IsActive:     true,
			GlobalRole:   globalRole,
			Status:       domain.UserStatusPending,
		}
		if actor != nil {
			u.CreatedByUserID = &actor.ID
		}

		if err := usersRepo.Create(r.Context(), u); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create user")
			return
		}

		var actorID *uuid.UUID
		if actor != nil {
			actorID = &actor.ID
		}

		// Assign role (triggers sync to global_role)
		if err := usersRepo.AssignUserRole(r.Context(), u.ID, roleKey, actorID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to assign role")
			return
		}

		// Ensure local identity
		if err := usersRepo.EnsureLocalIdentity(r.Context(), u.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set identity")
			return
		}

		// Set must change password
		if err := usersRepo.SetMustChangePassword(r.Context(), u.ID, true, "initial"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set password flag")
			return
		}

		// Assign groups
		if len(groupIDs) > 0 {
			if err := usersRepo.AssignUserGroups(r.Context(), u.ID, groupIDs, actorID); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to assign groups")
				return
			}
		}

		if actor != nil {
			writeAdminUserAudit(
				r, auditWriter, actor.ID, u.ID, "create",
				nil,
				map[string]any{"email": u.Email, "display_name": u.FullName, "role_key": roleKey, "status": string(u.Status)},
				"",
			)
		}

		created, err := usersRepo.GetAdminUserByID(r.Context(), u.ID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch created user")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]any{"data": created})
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

// generateTempPassword creates a cryptographically random password of exactly
// tempPasswordLen characters drawn from a printable ASCII charset that satisfies
// the strength policy. The caller is responsible for showing it once and
// discarding it — it is never logged or stored in plaintext.
const tempPasswordLen = 24

var tempPasswordCharset = []byte("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*")

func generateTempPassword() (string, error) {
	b := make([]byte, tempPasswordLen)
	csLen := byte(len(tempPasswordCharset))
	for i := range b {
		n, err := crand.Int(crand.Reader, big.NewInt(int64(csLen)))
		if err != nil {
			return "", fmt.Errorf("generateTempPassword: %w", err)
		}
		b[i] = tempPasswordCharset[n.Int64()]
	}
	return string(b), nil
}

func validatePasswordStrength(password, targetEmail string) (code, msg string, ok bool) {
	if len([]rune(strings.TrimSpace(password))) < 12 {
		return "VALIDATION_ERROR", "password must be at least 12 characters", false
	}
	if strings.EqualFold(password, targetEmail) {
		return "VALIDATION_ERROR", "password must not match user email", false
	}
	if commonPasswords[strings.ToLower(password)] {
		return "VALIDATION_ERROR", "password is too common", false
	}
	return "", "", true
}

func handleResetUserPassword(usersRepo *storage.UsersRepo, sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		// Mode is required: "generate" (server creates password) or "set" (admin supplies password).
		Mode     string `json:"mode"`
		Password string `json:"password"` // required for mode="set"
		Reason   string `json:"reason"`   // required, min 10 chars
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

		if req.Mode != "generate" && req.Mode != "set" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", `mode must be "generate" or "set"`)
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

		var plainPassword string // only populated for mode=generate, returned once in response

		switch req.Mode {
		case "generate":
			p, err := generateTempPassword()
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate password")
				return
			}
			plainPassword = p

		case "set":
			if strings.TrimSpace(req.Password) == "" {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "password is required for mode=set")
				return
			}
			if code, msg, ok := validatePasswordStrength(req.Password, target.Email); !ok {
				respondError(w, r, http.StatusBadRequest, code, msg)
				return
			}
			plainPassword = req.Password
		}

		hash, err := auth.Hash(plainPassword)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
			return
		}
		// Discard plainPassword for mode=set — caller gets no echo back.
		// For mode=generate it is returned below exactly once.
		returnedPassword := ""
		if req.Mode == "generate" {
			returnedPassword = plainPassword
		}
		plainPassword = "" // clear local reference

		if err := usersRepo.Update(r.Context(), userID, map[string]any{"password_hash": hash}); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update password")
			return
		}
		if err := usersRepo.SetMustChangePassword(r.Context(), userID, true, "admin_reset"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to set password change requirement")
			return
		}
		// Invalidate all active sessions of the target user.
		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "password_changed"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}

		writeAdminUserAudit(
			r, auditWriter, actor.ID, target.ID, "password_reset",
			map[string]any{"must_change": target.MustChangePassword},
			map[string]any{"must_change": true, "mode": req.Mode},
			req.Reason,
		)

		resp := map[string]any{"status": "password reset"}
		if returnedPassword != "" {
			// Returned exactly once for mode=generate; never stored or logged.
			resp["temporary_password"] = returnedPassword
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": resp})
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
