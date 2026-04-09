package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	authsvc "redlycoris/internal/auth"
)

var (
	authTrustProxy    bool
	authCookieSecure  bool
	authSessionMaxAge = 7 * 24 * time.Hour
)

func setAuthRuntimeConfig(trustProxy, cookieSecure bool, sessionDuration time.Duration) {
	authTrustProxy = trustProxy
	authCookieSecure = cookieSecure
	if sessionDuration > 0 {
		authSessionMaxAge = sessionDuration
	}
}

func readAuthToken(r *http.Request) (token string, ok bool) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			if token = strings.TrimSpace(parts[1]); token != "" {
				return token, true
			}
		}
	}

	if c, err := r.Cookie("rl_session"); err == nil {
		if token = strings.TrimSpace(c.Value); token != "" {
			return token, true
		}
	}

	return "", false
}

func extractIP(r *http.Request, trustProxy ...bool) string {
	useTrustProxy := authTrustProxy
	if len(trustProxy) > 0 {
		useTrustProxy = trustProxy[0]
	}

	if useTrustProxy {
		xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
		if xff != "" {
			parts := strings.Split(xff, ",")
			candidate := strings.TrimSpace(parts[0])
			if candidate != "" {
				return candidate
			}
		}
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func handleLogin(svc *authsvc.Service, rdb *redis.Client) http.HandlerFunc {
	type loginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
			return
		}

		email := strings.TrimSpace(req.Email)
		ip := extractIP(r)

		user, rawToken, err := svc.Login(r.Context(), email, req.Password, r.UserAgent(), ip)
		if err != nil {
			if errors.Is(err, authsvc.ErrInvalidCredentials) {
				respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "invalid email or password")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "rl_session",
			Value:    rawToken,
			HttpOnly: true,
			Secure:   shouldUseSecureCookie(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
			MaxAge:   int(authSessionMaxAge.Seconds()),
		})

		_ = rdb.Del(r.Context(), fmt.Sprintf("ratelimit:login:%s:%s", ip, email)).Err()

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{
				"user": user,
			},
		})
	}
}

func handleLogout(svc *authsvc.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if rawToken, ok := readAuthToken(r); ok {
			if err := svc.Logout(r.Context(), rawToken); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
				return
			}
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "rl_session",
			Value:    "",
			HttpOnly: true,
			Secure:   shouldUseSecureCookie(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
			MaxAge:   -1,
		})

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{"status": "logged out"},
		})
	}
}

func shouldUseSecureCookie(r *http.Request) bool {
	if !authCookieSecure {
		return false
	}

	// Preserve local HTTP development flows even if ENV/COOKIE_SECURE is misconfigured.
	host := r.Host
	if parsedHost, _, err := net.SplitHostPort(r.Host); err == nil {
		host = parsedHost
	}
	host = strings.Trim(strings.TrimSpace(host), "[]")
	if strings.EqualFold(host, "localhost") || host == "127.0.0.1" || host == "::1" {
		return false
	}

	if r.TLS != nil {
		return true
	}
	if authTrustProxy {
		xfp := strings.TrimSpace(strings.ToLower(r.Header.Get("X-Forwarded-Proto")))
		if xfp == "https" {
			return true
		}
	}
	return false
}

func handleRefresh(svc *authsvc.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawToken, ok := readAuthToken(r)
		if !ok {
			respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
			return
		}

		user, _, err := svc.Refresh(r.Context(), rawToken)
		if err != nil {
			if errors.Is(err, authsvc.ErrInvalidCredentials) {
				respondError(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
				return
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal server error")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{"user": user},
		})
	}
}

func handleMe() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			if AuthTokenInvalidFromContext(r.Context()) {
				respondError(w, r, http.StatusUnauthorized, "SESSION_EXPIRED", "session expired")
				return
			}
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{"user": user},
		})
	}
}
