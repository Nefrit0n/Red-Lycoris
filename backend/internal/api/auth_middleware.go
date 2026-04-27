package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

type ProjectIDExtractor func(*http.Request) (uuid.UUID, error)

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		_, sessionPresent := SessionFromContext(r.Context())

		if !ok || u == nil {
			if _, hasPAT := APITokenFromContext(r.Context()); hasPAT {
				slog.Debug("require_auth",
					"request_id", GetRequestID(r.Context()),
					"session_presence", sessionPresent,
					"outcome", "allowed",
				)
				next.ServeHTTP(w, r)
				return
			}
			slog.Warn("require_auth",
				"request_id", GetRequestID(r.Context()),
				"session_presence", sessionPresent,
				"outcome", "denied",
			)
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}
		slog.Debug("require_auth",
			"request_id", GetRequestID(r.Context()),
			"session_presence", sessionPresent,
			"outcome", "allowed",
		)
		next.ServeHTTP(w, r)
	})
}

func RequireScope(required string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if tok, ok := APITokenFromContext(r.Context()); ok {
				for _, scope := range tok.Scopes {
					if scope == required {
						next.ServeHTTP(w, r)
						return
					}
				}
				respondError(w, r, http.StatusForbidden, "INSUFFICIENT_SCOPE", "insufficient token scope")
				return
			}

			// Session users go through RBAC — scope check is PAT-only.
			if _, ok := UserFromContext(r.Context()); ok {
				next.ServeHTTP(w, r)
				return
			}
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
		})
	}
}

func RequireGlobalAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}
		if !user.IsAdmin() {
			respondError(w, r, http.StatusForbidden, "ADMIN_REQUIRED", "admin required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequirePasswordChangeCompleted blocks access for users with MustChangePassword=true.
// Applied to all /api/v1/* protected routes; excluded: /api/v1/auth/* (login, me, change-password).
func RequirePasswordChangeCompleted(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if ok && user != nil && user.MustChangePassword {
			respondError(w, r, http.StatusUnauthorized, "FORCE_PASSWORD_CHANGE", "Необходимо сменить пароль")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ProjectIDFromURL(param string) ProjectIDExtractor {
	return func(r *http.Request) (uuid.UUID, error) {
		return uuid.Parse(chi.URLParam(r, param))
	}
}

func ProjectIDFromQuery(param string) ProjectIDExtractor {
	return func(r *http.Request) (uuid.UUID, error) {
		return uuid.Parse(r.URL.Query().Get(param))
	}
}

func ProjectIDFromBody() ProjectIDExtractor {
	return func(r *http.Request) (uuid.UUID, error) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			return uuid.Nil, err
		}
		r.Body = io.NopCloser(bytes.NewReader(raw))

		var body struct {
			ProjectID uuid.UUID `json:"project_id"`
		}
		if err := json.Unmarshal(raw, &body); err != nil {
			return uuid.Nil, err
		}
		if body.ProjectID == uuid.Nil {
			return uuid.Nil, errors.New("missing project_id")
		}
		return body.ProjectID, nil
	}
}

func ProjectIDFromFinding(findingsRepo *storage.FindingsRepo, urlParam string) ProjectIDExtractor {
	return func(r *http.Request) (uuid.UUID, error) {
		id := chi.URLParam(r, urlParam)
		return findingsRepo.GetProjectID(r.Context(), id)
	}
}

func RequireProjectRole(rolesRepo *storage.UserProjectRolesRepo, minRole domain.ProjectRole, extractor ProjectIDExtractor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
				return
			}
			if user.IsAdmin() {
				next.ServeHTTP(w, r)
				return
			}

			projectID, err := extractor(r)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
				return
			}

			role, ok, err := rolesRepo.GetRole(r.Context(), user.ID, projectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check project permissions")
				return
			}
			if !ok || role < minRole {
				respondError(w, r, http.StatusForbidden, "INSUFFICIENT_PROJECT_ROLE", "insufficient project role")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireProjectOwnerOrGlobalAdmin(projectsRepo *storage.ProjectsRepo, extractor ProjectIDExtractor) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
				return
			}
			if user.IsAdmin() {
				next.ServeHTTP(w, r)
				return
			}

			projectID, err := extractor(r)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
				return
			}
			project, err := projectsRepo.GetByID(r.Context(), projectID)
			if err != nil {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
				return
			}

			if project.Owner.ID != user.ID {
				respondError(w, r, http.StatusForbidden, "PROJECT_OWNER_REQUIRED", "project owner or admin required")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
