package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"redlycoris/internal/auth"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

// handleCheckEmailAvailable — GET /api/v1/admin/users/check-email?email=X
func handleCheckEmailAvailable(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		email := strings.TrimSpace(r.URL.Query().Get("email"))
		if email == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "email is required")
			return
		}
		available, err := usersRepo.CheckEmailAvailable(r.Context(), email)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check email")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]bool{"available": available}})
	}
}

// handleListGroups — GET /api/v1/admin/groups?q=prefix&limit=10
func handleListGroups(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := 10
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := fmt.Sscanf(v, "%d", &limit); n != 1 || err != nil || limit <= 0 {
				limit = 10
			}
		}
		groups, err := usersRepo.ListGroups(r.Context(), q, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list groups")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": groups})
	}
}

// handleBulkDeactivateUsers — POST /api/v1/admin/users/bulk-deactivate
func handleBulkDeactivateUsers(
	usersRepo *storage.UsersRepo,
	sessionsRepo *storage.SessionsRepo,
	auditWriter interface{ Submit(storage.AuditRecord) },
) http.HandlerFunc {
	type request struct {
		UserIDs []string `json:"user_ids"`
		Reason  string   `json:"reason"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.UserIDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "user_ids must not be empty")
			return
		}
		if len([]rune(strings.TrimSpace(req.Reason))) < 10 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "reason must be at least 10 characters")
			return
		}

		results := make([]storage.BulkDeactivateResult, 0, len(req.UserIDs))
		for _, rawID := range req.UserIDs {
			userID, err := uuid.Parse(rawID)
			if err != nil {
				results = append(results, storage.BulkDeactivateResult{
					UserID: uuid.Nil, Success: false, Error: "invalid user id",
				})
				continue
			}

			target, err := usersRepo.GetByID(r.Context(), userID)
			if err != nil {
				results = append(results, storage.BulkDeactivateResult{
					UserID: userID, Success: false, Error: "user not found",
				})
				continue
			}

			if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionDeactivate); err != nil {
				results = append(results, storage.BulkDeactivateResult{
					UserID: userID, Success: false, Error: guardErrMessage(err),
				})
				continue
			}

			if err := usersRepo.Update(r.Context(), userID, map[string]any{
				"is_active": false,
				"status":    string(domain.UserStatusDisabled),
			}); err != nil {
				results = append(results, storage.BulkDeactivateResult{
					UserID: userID, Success: false, Error: "failed to deactivate",
				})
				continue
			}
			_ = sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "deactivated")
			writeAdminUserAudit(r, auditWriter, actor.ID, userID, "deactivate",
				map[string]any{"status": string(target.Status)},
				map[string]any{"status": string(domain.UserStatusDisabled)},
				req.Reason,
			)
			results = append(results, storage.BulkDeactivateResult{UserID: userID, Success: true})
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": results})
	}
}

// handleBulkResetPassword — POST /api/v1/admin/users/bulk-reset-password
func handleBulkResetPassword(
	usersRepo *storage.UsersRepo,
	sessionsRepo *storage.SessionsRepo,
	auditWriter interface{ Submit(storage.AuditRecord) },
) http.HandlerFunc {
	type request struct {
		UserIDs     []string `json:"user_ids"`
		NewPassword string   `json:"new_password"`
		Reason      string   `json:"reason"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())

		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.UserIDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "user_ids must not be empty")
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

		hash, err := auth.Hash(req.NewPassword)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
			return
		}

		results := make([]storage.BulkDeactivateResult, 0, len(req.UserIDs))
		for _, rawID := range req.UserIDs {
			userID, err := uuid.Parse(rawID)
			if err != nil {
				results = append(results, storage.BulkDeactivateResult{UserID: uuid.Nil, Success: false, Error: "invalid user id"})
				continue
			}
			target, err := usersRepo.GetByID(r.Context(), userID)
			if err != nil {
				results = append(results, storage.BulkDeactivateResult{UserID: userID, Success: false, Error: "user not found"})
				continue
			}
			if err := canModifyUser(r.Context(), usersRepo, actor.ID, target, ActionResetPassword); err != nil {
				results = append(results, storage.BulkDeactivateResult{UserID: userID, Success: false, Error: guardErrMessage(err)})
				continue
			}
			if err := usersRepo.Update(r.Context(), userID, map[string]any{"password_hash": hash}); err != nil {
				results = append(results, storage.BulkDeactivateResult{UserID: userID, Success: false, Error: "failed to reset password"})
				continue
			}
			_ = usersRepo.SetMustChangePassword(r.Context(), userID, true, "admin_reset")
			_ = sessionsRepo.RevokeAllForUserWithReason(r.Context(), userID, "password_changed")
			writeAdminUserAudit(r, auditWriter, actor.ID, userID, "password_reset",
				nil, map[string]any{"must_change": true}, req.Reason)
			results = append(results, storage.BulkDeactivateResult{UserID: userID, Success: true})
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": results})
	}
}

// handleExportUsersCSV — GET /api/v1/admin/users/export.csv
func handleExportUsersCSV(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f := parseUserListFilter(r)
		f.Limit = 10000
		f.Cursor = ""

		users, _, _, _, err := usersRepo.ListV2(r.Context(), f)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list users")
			return
		}

		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(
			`attachment; filename="users-%s.csv"`, time.Now().UTC().Format("20060102-150405")))

		cw := csv.NewWriter(w)
		_ = cw.Write([]string{
			"ID", "Email", "Имя", "Роль", "Статус", "Источник",
			"MFA", "Группы", "Последний вход", "IP входа", "Создан",
		})

		for _, u := range users {
			var lastLogin string
			if u.LastLoginAt != nil {
				lastLogin = u.LastLoginAt.Format(time.RFC3339)
			}
			var ip string
			if u.LastLoginIP != nil {
				ip = *u.LastLoginIP
			}
			groupNames := make([]string, len(u.Groups))
			for i, g := range u.Groups {
				groupNames[i] = g.Name
			}
			_ = cw.Write([]string{
				u.ID.String(), u.Email, u.DisplayName, u.Role.Key,
				u.Status, u.IdentityKind,
				boolToCSV(u.MFAEnabled), strings.Join(groupNames, ";"),
				lastLogin, ip, u.CreatedAt.Format(time.RFC3339),
			})
		}
		cw.Flush()
	}
}

func boolToCSV(b bool) string {
	if b {
		return "да"
	}
	return "нет"
}

// parseUserListFilter extracts UserListFilter from query params.
func parseUserListFilter(r *http.Request) domain.UserListFilter {
	q := r.URL.Query()
	f := domain.UserListFilter{
		Q:      strings.TrimSpace(q.Get("q")),
		Source: q.Get("source"),
		Sort:   q.Get("sort"),
		Cursor: q.Get("cursor"),
		Limit:  50,
	}

	if v := q.Get("limit"); v != "" {
		if n, err := fmt.Sscanf(v, "%d", &f.Limit); n != 1 || err != nil {
			f.Limit = 50
		}
	}
	if roleStr := q.Get("role"); roleStr != "" {
		f.Roles = strings.Split(roleStr, ",")
	}
	if statusStr := q.Get("status"); statusStr != "" {
		f.Statuses = strings.Split(statusStr, ",")
	}
	if groupStr := q.Get("group"); groupStr != "" {
		if id, err := uuid.Parse(groupStr); err == nil {
			f.GroupID = &id
		}
	}
	if mfaStr := q.Get("mfa"); mfaStr != "" {
		enabled := mfaStr == "enabled"
		f.MFA = &enabled
	}
	if q.Get("dormant") == "true" {
		f.Dormant = true
	}
	return f
}

// handleGetAccessCounts — GET /api/v1/admin/access/counts
// Returns tab counters for AccessPageShell.
func handleGetAccessCounts(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users, err := usersRepo.Count(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to count users")
			return
		}
		groups, err := usersRepo.CountGroups(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to count groups")
			return
		}
		roles, err := usersRepo.CountRoles(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to count roles")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]int{"users": users, "groups": groups, "roles": roles},
		})
	}
}

// guardErrMessage extracts a user-friendly message from a guard error.
func guardErrMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// decodeJSON is a helper that decodes JSON body.
func decodeJSON(r *http.Request, dst any) error {
	return decodeJSONAllowEmpty(r, dst)
}
