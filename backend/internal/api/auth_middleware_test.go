package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"redlycoris/internal/domain"

	"github.com/google/uuid"
)

func userInContext(ctx context.Context, u *domain.User) context.Context {
	return context.WithValue(ctx, userCtxKey, u)
}

func TestRequirePasswordChangeCompleted(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name           string
		user           *domain.User
		wantNextCalled bool
		wantStatus     int
		wantErrCode    string
	}{
		{
			name:           "no user in context → passes through",
			user:           nil,
			wantNextCalled: true,
			wantStatus:     http.StatusOK,
		},
		{
			name: "user with must_change=false → passes through",
			user: &domain.User{
				ID:                 uuid.New(),
				MustChangePassword: false,
				IsActive:           true,
			},
			wantNextCalled: true,
			wantStatus:     http.StatusOK,
		},
		{
			name: "user with must_change=true → 401 FORCE_PASSWORD_CHANGE",
			user: &domain.User{
				ID:                 uuid.New(),
				MustChangePassword: true,
				IsActive:           true,
			},
			wantNextCalled: false,
			wantStatus:     http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextCalled = false

			req := httptest.NewRequest(http.MethodGet, "/api/v1/findings", nil)
			if tt.user != nil {
				req = req.WithContext(userInContext(req.Context(), tt.user))
			}
			rec := httptest.NewRecorder()

			RequirePasswordChangeCompleted(next).ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if nextCalled != tt.wantNextCalled {
				t.Errorf("nextCalled = %v, want %v", nextCalled, tt.wantNextCalled)
			}
		})
	}
}
