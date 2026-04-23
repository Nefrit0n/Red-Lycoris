package api

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	authsvc "redlycoris/internal/auth"
	"redlycoris/internal/storage"
)

type (
	userCtxKeyType             struct{}
	sessionCtxKey              struct{}
	authTokenInvalidCtxKeyType struct{}
	apiTokenCtxKeyType         struct{}
)

var (
	userCtxKey             = userCtxKeyType{}
	sessionKey             = sessionCtxKey{}
	authTokenInvalidCtxKey = authTokenInvalidCtxKeyType{}
	apiTokenCtxKey         = apiTokenCtxKeyType{}
)

type APITokenContext struct {
	TokenID   string
	ProjectID string
	Scopes    []string
}

func LoadSessionMiddleware(svc *authsvc.Service, tokensRepo *storage.APITokensRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if bearer, ok := readBearerToken(r); ok && strings.HasPrefix(strings.TrimSpace(bearer), "rl_pat_") {
				prefix, secret, err := authsvc.ParsePAT(bearer)
				if err != nil {
					respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid api token")
					return
				}
				token, err := tokensRepo.GetByPrefix(r.Context(), prefix)
				if err != nil {
					respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid api token")
					return
				}
				secretHash := authsvc.HashPATSecret(secret)
				if subtle.ConstantTimeCompare([]byte(secretHash), []byte(token.TokenHash)) != 1 {
					respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid api token")
					return
				}
				ctx := context.WithValue(r.Context(), apiTokenCtxKey, &APITokenContext{
					TokenID:   token.ID.String(),
					ProjectID: token.ProjectID.String(),
					Scopes:    token.Scopes,
				})
				go func(ctx context.Context, tokenID string) {
					id, parseErr := uuid.Parse(tokenID)
					if parseErr == nil {
						touchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
						defer cancel()
						_ = tokensRepo.TouchLastUsed(touchCtx, id)
					}
				}(r.Context(), token.ID.String())
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			hasAuthHeader := strings.TrimSpace(r.Header.Get("Authorization")) != ""
			hasSessionCookie := false
			if c, err := r.Cookie("rl_session"); err == nil && strings.TrimSpace(c.Value) != "" {
				hasSessionCookie = true
			}

			rawToken, ok := readAuthToken(r)
			if !ok {
				slog.Debug("load_session",
					"request_id", sanitizeForLog(GetRequestID(r.Context())),
					"outcome", "absent",
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
					"request_id", sanitizeForLog(GetRequestID(r.Context())),
					"outcome", "expired",
					"error_type", classifySessionError(err),
				)
				next.ServeHTTP(w, r)
				return
			}

			slog.Debug("load_session",
				"request_id", sanitizeForLog(GetRequestID(r.Context())),
				"outcome", "loaded",
				"session_id", session.ID,
				"user_id", user.ID,
			)

			ctx := context.WithValue(r.Context(), userCtxKey, user)
			ctx = withSession(ctx, session)

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
	return sessionFromContext(ctx)
}

func withSession(ctx context.Context, s *authsvc.Session) context.Context {
	return context.WithValue(ctx, sessionKey, s)
}

func sessionFromContext(ctx context.Context) (*authsvc.Session, bool) {
	if ctx == nil {
		return nil, false
	}
	session, ok := ctx.Value(sessionKey).(*authsvc.Session)
	return session, ok && session != nil
}

func APITokenFromContext(ctx context.Context) (*APITokenContext, bool) {
	if ctx == nil {
		return nil, false
	}
	tok, ok := ctx.Value(apiTokenCtxKey).(*APITokenContext)
	return tok, ok && tok != nil
}
