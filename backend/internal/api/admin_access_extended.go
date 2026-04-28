package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func handleGetAdminUserDetail(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		u, err := usersRepo.GetAdminUserByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "user not found")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch user")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": u})
	}
}

func handleGetUserProjectsEffective(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		data, err := usersRepo.EffectiveProjectAccessForUser(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load effective access")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": data})
	}
}

func handleListUserSessions(sessionsRepo *storage.SessionsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		sessions, err := sessionsRepo.ListActiveByUser(r.Context(), uid)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list sessions")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": sessions})
	}
}

func handleRevokeUserSession(sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		uid, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		sid, err := uuid.Parse(chi.URLParam(r, "sid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid session id")
			return
		}
		if err := sessionsRepo.RevokeSessionByID(r.Context(), sid, "admin_revoke"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke session")
			return
		}
		if actor != nil {
			writeAdminUserAudit(r, auditWriter, actor.ID, uid, "session_revoke", nil, map[string]any{"session_id": sid.String()}, "")
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleRevokeAllUserSessions(sessionsRepo *storage.SessionsRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		uid, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		if err := sessionsRepo.RevokeAllForUserWithReason(r.Context(), uid, "admin_revoke_all"); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke sessions")
			return
		}
		if actor != nil {
			writeAdminUserAudit(r, auditWriter, actor.ID, uid, "sessions_revoke_all", nil, nil, "")
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handlePutUserProjectOverride(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Level string `json:"level"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		uid, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		pid, err := uuid.Parse(chi.URLParam(r, "pid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		lvl := domain.AccessLevel(strings.TrimSpace(req.Level))
		if lvl != domain.AccessRead && lvl != domain.AccessWrite && lvl != domain.AccessAdmin {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid level")
			return
		}
		if err := usersRepo.UpsertProjectAccess(r.Context(), pid, "user", uid, lvl, actor.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save access")
			return
		}
		writeAdminUserAudit(r, auditWriter, actor.ID, uid, "project_access_override_set", nil, map[string]any{"project_id": pid.String(), "level": lvl}, "")
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleDeleteUserProjectOverride(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		uid, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		pid, err := uuid.Parse(chi.URLParam(r, "pid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		if err := usersRepo.DeleteProjectAccess(r.Context(), pid, "user", uid); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete access")
			return
		}
		writeAdminUserAudit(r, auditWriter, actor.ID, uid, "project_access_override_deleted", nil, map[string]any{"project_id": pid.String()}, "")
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleListGroupsAdmin(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		groups, err := usersRepo.ListAllAdminGroups(r.Context(), q)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list groups")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": groups})
	}
}

func handleCreateGroup(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct{ Name, Description, ColorKey string }
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len([]rune(strings.TrimSpace(req.Name))) < 3 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name too short")
			return
		}
		g := &domain.AdminGroup{Name: req.Name, Description: req.Description, ColorKey: req.ColorKey, Source: "manual"}
		if g.ColorKey == "" {
			g.ColorKey = "0"
		}
		if err := usersRepo.CreateGroup(r.Context(), g, actor.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create group")
			return
		}
		writeAdminUserAudit(r, auditWriter, actor.ID, actor.ID, "group_create", nil, map[string]any{"group_id": g.ID.String(), "name": g.Name}, "")
		respondJSON(w, http.StatusCreated, map[string]any{"data": g})
	}
}

func handleGetGroup(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		g, err := usersRepo.GetAdminGroupByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "group not found")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": g})
	}
}

func handlePatchGroup(usersRepo *storage.UsersRepo) http.HandlerFunc {
	type request struct{ Name, Description, ColorKey string }
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if err := usersRepo.UpdateGroup(r.Context(), id, req.Name, req.Description, req.ColorKey); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update group")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleDeleteGroup(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		if err := usersRepo.DeleteGroup(r.Context(), id); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "deleted"}})
	}
}

func handleListGroupMembers(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		m, err := usersRepo.ListGroupMembers(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list members")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": m})
	}
}

func handleAddGroupMembers(usersRepo *storage.UsersRepo) http.HandlerFunc {
	type request struct {
		UserIDs []string `json:"user_ids"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		uids := make([]uuid.UUID, 0, len(req.UserIDs))
		for _, s := range req.UserIDs {
			u, err := uuid.Parse(s)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
				return
			}
			uids = append(uids, u)
		}
		if err := usersRepo.AddGroupMembers(r.Context(), id, uids, actor.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to add members")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleDeleteGroupMember(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		uid, err := uuid.Parse(chi.URLParam(r, "uid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid user id")
			return
		}
		if err := usersRepo.RemoveGroupMember(r.Context(), id, uid); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to remove member")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleListGroupProjects(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		p, err := usersRepo.ListGroupProjects(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list projects")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": p})
	}
}

func handlePutGroupProjectAccess(usersRepo *storage.UsersRepo, auditWriter interface{ Submit(storage.AuditRecord) }) http.HandlerFunc {
	type request struct {
		Level string `json:"level"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		actor, _ := UserFromContext(r.Context())
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		pid, err := uuid.Parse(chi.URLParam(r, "pid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		var req request
		if err := decodeJSON(r, &req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		lvl := domain.AccessLevel(req.Level)
		if lvl != domain.AccessRead && lvl != domain.AccessWrite && lvl != domain.AccessAdmin {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid level")
			return
		}
		if err := usersRepo.UpsertProjectAccess(r.Context(), pid, "group", id, lvl, actor.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save access")
			return
		}
		writeAdminUserAudit(r, auditWriter, actor.ID, actor.ID, "group_project_access_set", nil, map[string]any{"group_id": id.String(), "project_id": pid.String(), "level": lvl}, "")
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleDeleteGroupProjectAccess(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group id")
			return
		}
		pid, err := uuid.Parse(chi.URLParam(r, "pid"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		if err := usersRepo.DeleteProjectAccess(r.Context(), pid, "group", id); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete access")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
	}
}

func handleListRolesReadOnly(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roles, err := usersRepo.ListRolesWithPermissions(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list roles")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": roles})
	}
}

func handleGetRoleReadOnly(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid role id")
			return
		}
		role, err := usersRepo.GetRoleWithPermissions(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "role not found")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": role})
	}
}

func handleListPermissions(usersRepo *storage.UsersRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roles, err := usersRepo.ListRolesWithPermissions(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list permissions")
			return
		}
		m := map[string]domain.RolePermission{}
		for _, rl := range roles {
			for _, p := range rl.Permissions {
				m[p.Key] = p
			}
		}
		out := make([]domain.RolePermission, 0, len(m))
		for _, p := range m {
			out = append(out, p)
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": out})
	}
}
