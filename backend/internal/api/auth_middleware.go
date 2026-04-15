package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
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
		raw := r.Context().Value(userCtxKey)
		u, ok := UserFromContext(r.Context())

		slog.Info("RequireAuth check",
			"request_id", GetRequestID(r.Context()),
			"path", r.URL.Path,
			"user_in_ctx", ok,
			"user_nil", u == nil,
			"raw_value_type", fmt.Sprintf("%T", raw),
			"raw_value_nil", raw == nil,
			"userCtxKey_addr", fmt.Sprintf("%p", userCtxKey),
		)

		if !ok {
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
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
