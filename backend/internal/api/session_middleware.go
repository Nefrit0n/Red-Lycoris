package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	authsvc "redlycoris/internal/auth"
)

var userCtxKey = &struct{}{}
var sessionCtxKey = &struct{}{}
var authTokenInvalidCtxKey = &struct{}{}

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
				slog.Debug("session token missing",
					"request_id", GetRequestID(r.Context()),
					"path", r.URL.Path,
					"has_auth_header", hasAuthHeader,
					"has_session_cookie", hasSessionCookie,
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
					"error_type", classifySessionError(err),
				)
				next.ServeHTTP(w, r)
				return
			}

			slog.Debug("session validated",
				"request_id", GetRequestID(r.Context()),
				"path", r.URL.Path,
				"has_auth_header", hasAuthHeader,
				"has_session_cookie", hasSessionCookie,
				"user_id", user.ID,
				"session_id", session.ID,
			)

			ctx := context.WithValue(r.Context(), userCtxKey, user)
			ctx = context.WithValue(ctx, sessionCtxKey, session)
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
