package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	authsvc "redlycoris/internal/auth"
)

var userCtxKey = &struct{}{}
var sessionCtxKey = &struct{}{}
var authTokenInvalidCtxKey = &struct{}{}

func LoadSessionMiddleware(svc *authsvc.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rawToken, ok := readAuthToken(r)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			user, session, err := svc.ValidateToken(r.Context(), rawToken)
			if err != nil {
				if errors.Is(err, authsvc.ErrInvalidCredentials) {
					ctx := context.WithValue(r.Context(), authTokenInvalidCtxKey, true)
					r = r.WithContext(ctx)
				}
				if !errors.Is(err, authsvc.ErrInvalidCredentials) {
					slog.Warn("session validate failed",
						"request_id", GetRequestID(r.Context()),
						"error", err,
					)
				} else {
					slog.Warn("session token invalid",
						"request_id", GetRequestID(r.Context()),
					)
				}
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), userCtxKey, user)
			ctx = context.WithValue(ctx, sessionCtxKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
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
