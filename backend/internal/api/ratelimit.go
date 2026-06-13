package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// lockedUntilWriter is satisfied by UsersRepo — kept narrow to avoid coupling.
type lockedUntilWriter interface {
	SetLockedUntilByEmail(ctx context.Context, email string, until time.Time) error
}

const loginRateLimitWindow = 15 * time.Minute

func LoginRateLimit(rdb *redis.Client, usersRepo lockedUntilWriter) func(http.Handler) http.Handler {
	type loginRequest struct {
		Email string `json:"email"`
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, err := io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewReader(raw))
			}

			var req loginRequest
			_ = json.Unmarshal(raw, &req)

			ip := extractIP(r)
			email := strings.ToLower(strings.TrimSpace(req.Email))
			key := fmt.Sprintf("ratelimit:login:%s:%s", ip, email)

			count, err := rdb.Incr(r.Context(), key).Result()
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			if count == 1 {
				_ = rdb.Expire(r.Context(), key, loginRateLimitWindow).Err()
			}

			if count > 5 {
				ttl, err := rdb.TTL(r.Context(), key).Result()
				retryAfter := loginRateLimitWindow
				if err == nil && ttl > 0 {
					retryAfter = ttl
					w.Header().Set("Retry-After", strconv.Itoa(int(ttl.Seconds())))
				}

				// Reflect the lockout in user_credentials so DisplayStatus shows "locked".
				// Best-effort: non-existent emails are silently ignored (timing-safe).
				if email != "" {
					until := time.Now().Add(retryAfter)
					if dbErr := usersRepo.SetLockedUntilByEmail(r.Context(), email, until); dbErr != nil {
						slog.Warn("rate_limit: failed to write locked_until", "email", email, "error", dbErr)
					}
				}

				respondError(w, r, http.StatusTooManyRequests, "RATE_LIMITED", "too many login attempts")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
