package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	authsvc "redlycoris/internal/auth"
)

type (
	userCtxKeyType             struct{}
	sessionCtxKeyType          struct{}
	authTokenInvalidCtxKeyType struct{}
)

var (
	userCtxKey             = userCtxKeyType{}
	sessionCtxKey          = sessionCtxKeyType{}
	authTokenInvalidCtxKey = authTokenInvalidCtxKeyType{}
)

func LoadSessionMiddleware(svc *authsvc.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			hasAuthHeader := strings.TrimSpace(r.Header.Get("Authorization")) != ""
			hasSessionCookie := false
			if c, err := r.Cookie("rl_session"); err == nil && strings.TrimSpace(c.Value) != "" {
				hasSessionCookie = true
			}

			rawToken, ok := readAuthToken(r)
			if !ok {
				slog.Info("session validation result",
					"request_id", GetRequestID(r.Context()),
					"path", r.URL.Path,
					"has_auth_header", hasAuthHeader,
					"has_session_cookie", hasSessionCookie,
					"validate_result", "missing_token",
				)
				next.ServeHTTP(w, r)
				return
			}

			user, session, err := svc.ValidateToken(r.Context(), rawToken)
			if err != nil {
				if errors.Is(err, authsvc.ErrInvalidCredentials) {
					ctx := context.WithValue(r.Context(), authTokenInvalidCtxKey, true)
					r = r.WithContext(ctx)
				}
				slog.Warn("session validate failed",
					"request_id", GetRequestID(r.Context()),
					"path", r.URL.Path,
					"has_auth_header", hasAuthHeader,
					"has_session_cookie", hasSessionCookie,
					"validate_result", "invalid",
					"error_type", classifySessionError(err),
				)
				next.ServeHTTP(w, r)
				return
			}

			slog.Info("session validation result",
				"request_id", GetRequestID(r.Context()),
				"path", r.URL.Path,
				"has_auth_header", hasAuthHeader,
				"has_session_cookie", hasSessionCookie,
				"validate_result", "valid",
				"user_id", user.ID,
				"session_id", session.ID,
			)

			ctx := context.WithValue(r.Context(), userCtxKey, user)
			ctx = context.WithValue(ctx, sessionCtxKey, session)

			slog.Info("LoadSession storing user",
				"request_id", GetRequestID(r.Context()),
				"path", r.URL.Path,
				"user_type", fmt.Sprintf("%T", user),
				"userCtxKey_addr", fmt.Sprintf("%p", userCtxKey),
			)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func classifySessionError(err error) string {
	if errors.Is(err, authsvc.ErrInvalidCredentials) {
		return "invalid_credentials"
	}
	return "validation_failed"
}

func AuthTokenInvalidFromContext(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	invalid, ok := ctx.Value(authTokenInvalidCtxKey).(bool)
	return ok && invalid
}

func UserFromContext(ctx context.Context) (*authsvc.User, bool) {
	if ctx == nil {
		return nil, false
	}
	user, ok := ctx.Value(userCtxKey).(*authsvc.User)
	return user, ok && user != nil
}

func SessionFromContext(ctx context.Context) (*authsvc.Session, bool) {
	if ctx == nil {
		return nil, false
	}
	session, ok := ctx.Value(sessionCtxKey).(*authsvc.Session)
	return session, ok && session != nil
}
