package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

func LoginRateLimit(rdb *redis.Client) func(http.Handler) http.Handler {
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
				_ = rdb.Expire(r.Context(), key, 15*time.Minute).Err()
			}

			if count > 5 {
				ttl, err := rdb.TTL(r.Context(), key).Result()
				if err == nil && ttl > 0 {
					w.Header().Set("Retry-After", strconv.Itoa(int(ttl.Seconds())))
				}
				respondError(w, r, http.StatusTooManyRequests, "RATE_LIMITED", "too many login attempts")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
