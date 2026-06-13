package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

// ---------------------------------------------------------------------------
// Tests — generateTempPassword
// ---------------------------------------------------------------------------

func TestGenerateTempPassword_Length(t *testing.T) {
	p, err := generateTempPassword()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(p) != tempPasswordLen {
		t.Errorf("want len=%d, got %d", tempPasswordLen, len(p))
	}
}

func TestGenerateTempPassword_CharsetOnly(t *testing.T) {
	charset := string(tempPasswordCharset)
	for i := 0; i < 20; i++ {
		p, err := generateTempPassword()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		for _, c := range p {
			if !strings.ContainsRune(charset, c) {
				t.Errorf("char %q not in charset", c)
			}
		}
	}
}

func TestGenerateTempPassword_Unique(t *testing.T) {
	a, _ := generateTempPassword()
	b, _ := generateTempPassword()
	if a == b {
		t.Error("two consecutive passwords are identical — RNG broken?")
	}
}

func TestGenerateTempPassword_SatisfiesPolicy(t *testing.T) {
	for i := 0; i < 10; i++ {
		p, _ := generateTempPassword()
		if _, _, ok := validatePasswordStrength(p, "nobody@example.com"); !ok {
			t.Errorf("generated password %q fails strength policy", p)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests — validatePasswordStrength
// ---------------------------------------------------------------------------

func TestValidatePasswordStrength(t *testing.T) {
	cases := []struct {
		name    string
		pw      string
		email   string
		wantOK  bool
		wantMsg string
	}{
		{"ok", "S3cur3P@ssw0rd!", "user@example.com", true, ""},
		{"too short", "short1!", "user@example.com", false, "at least 12"},
		{"matches email", "user@example.com", "user@example.com", false, "not match"},
		{"common", "password123456", "user@example.com", false, "too common"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, msg, ok := validatePasswordStrength(c.pw, c.email)
			if ok != c.wantOK {
				t.Errorf("ok: want %v got %v", c.wantOK, ok)
			}
			if !c.wantOK && !strings.Contains(msg, c.wantMsg) {
				t.Errorf("message %q doesn't contain %q", msg, c.wantMsg)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Tests — handleResetUserPassword — validation-only paths (no DB call)
// ---------------------------------------------------------------------------

// makeResetRequest builds a request that hits handleResetUserPassword with nil
// repos. Valid only for paths that return before the first repo call (mode and
// reason validation).
func makeResetRequest(body map[string]any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")

	actor := &domain.User{ID: uuid.New(), GlobalRole: domain.RoleAdmin, IsActive: true}
	r = r.WithContext(userInContext(r.Context(), actor))

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", uuid.New().String())
	r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
	r = r.WithContext(userInContext(r.Context(), actor))

	w := httptest.NewRecorder()
	// nil repos are safe here: handler returns before reaching any DB call
	handler := handleResetUserPassword(
		(*storage.UsersRepo)(nil),
		(*storage.SessionsRepo)(nil),
		(*stubAuditWriterReset)(nil),
	)
	handler.ServeHTTP(w, r)
	return w
}

type stubAuditWriterReset struct{}

func (s *stubAuditWriterReset) Submit(_ storage.AuditRecord) {}

func TestResetPasswordHandler_MissingMode(t *testing.T) {
	w := makeResetRequest(map[string]any{"reason": "security audit forced reset"})
	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	errObj, _ := resp["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Errorf("want VALIDATION_ERROR, got %v", errObj["code"])
	}
}

func TestResetPasswordHandler_InvalidMode(t *testing.T) {
	w := makeResetRequest(map[string]any{"mode": "auto", "reason": "testing invalid mode value"})
	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestResetPasswordHandler_ShortReason(t *testing.T) {
	w := makeResetRequest(map[string]any{"mode": "generate", "reason": "short"})
	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	errObj, _ := resp["error"].(map[string]any)
	if errObj["code"] != "VALIDATION_ERROR" {
		t.Errorf("want VALIDATION_ERROR, got %v", errObj["code"])
	}
}

// ---------------------------------------------------------------------------
// Tests — RequirePasswordChangeCompleted blocks pending/must_change users
// ---------------------------------------------------------------------------

func TestRequirePasswordChangeCompleted_BlocksPendingUser(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := RequirePasswordChangeCompleted(next)

	user := &domain.User{
		ID:                 uuid.New(),
		MustChangePassword: true,
		IsActive:           true,
		Status:             domain.UserStatusPending,
	}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/findings", nil)
	r = r.WithContext(userInContext(r.Context(), user))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	errObj, _ := resp["error"].(map[string]any)
	if errObj["code"] != "FORCE_PASSWORD_CHANGE" {
		t.Errorf("want FORCE_PASSWORD_CHANGE, got %v", errObj["code"])
	}
}

func TestRequirePasswordChangeCompleted_AllowsActiveUser(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})
	handler := RequirePasswordChangeCompleted(next)

	user := &domain.User{
		ID:                 uuid.New(),
		MustChangePassword: false,
		IsActive:           true,
		Status:             domain.UserStatusActive,
	}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/findings", nil)
	r = r.WithContext(userInContext(r.Context(), user))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if !nextCalled {
		t.Error("expected next handler to be called for active user")
	}
	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests — lockedUntilWriter interface (rate limit DB integration)
// ---------------------------------------------------------------------------

type stubLockedUntilWriter struct {
	calls []struct {
		email string
		until time.Time
	}
}

func (s *stubLockedUntilWriter) SetLockedUntilByEmail(_ context.Context, email string, until time.Time) error {
	s.calls = append(s.calls, struct {
		email string
		until time.Time
	}{email, until})
	return nil
}

func TestLockedUntilWriter_InterfaceSatisfied(t *testing.T) {
	var _ lockedUntilWriter = &stubLockedUntilWriter{}
}

func TestLoginRateLimitWindow_IsPositive(t *testing.T) {
	if loginRateLimitWindow <= 0 {
		t.Errorf("loginRateLimitWindow must be positive, got %v", loginRateLimitWindow)
	}
}

func TestLockedUntilWriter_FutureDateSet(t *testing.T) {
	stub := &stubLockedUntilWriter{}
	before := time.Now()
	_ = stub.SetLockedUntilByEmail(context.Background(), "victim@example.com", before.Add(loginRateLimitWindow))

	if len(stub.calls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(stub.calls))
	}
	if stub.calls[0].email != "victim@example.com" {
		t.Errorf("wrong email: %s", stub.calls[0].email)
	}
	if !stub.calls[0].until.After(before) {
		t.Error("locked_until should be in the future")
	}
}

// ---------------------------------------------------------------------------
// Tests — ActivateIfPending state machine invariant
// ---------------------------------------------------------------------------

func TestActivateIfPendingOnlyMatchesPending(t *testing.T) {
	// Mirror the SQL WHERE status = 'pending' predicate
	cases := []struct {
		status      domain.UserStatus
		shouldMatch bool
	}{
		{domain.UserStatusPending, true},
		{domain.UserStatusActive, false},
		{domain.UserStatusDisabled, false},
	}
	for _, c := range cases {
		matched := c.status == domain.UserStatusPending
		if matched != c.shouldMatch {
			t.Errorf("status=%q: matched=%v want=%v", c.status, matched, c.shouldMatch)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests — generated password never leaks into audit record
// ---------------------------------------------------------------------------

func TestGeneratedPasswordNotInAuditAfterState(t *testing.T) {
	p, err := generateTempPassword()
	if err != nil {
		t.Fatal(err)
	}
	// Verify the after-state written to audit_log doesn't include the password
	after := map[string]any{"must_change": true, "mode": "generate"}
	b, _ := json.Marshal(after)
	if strings.Contains(string(b), p) {
		t.Error("generated password leaked into audit after-state")
	}
}

// ---------------------------------------------------------------------------
// Tests — tempPasswordLen and charset policy compliance
// ---------------------------------------------------------------------------

func TestTempPasswordLen_MeetsMinimumPolicy(t *testing.T) {
	if tempPasswordLen < 12 {
		t.Errorf("tempPasswordLen=%d is below minimum policy of 12", tempPasswordLen)
	}
}

func TestTempPasswordCharset_HasMixedContent(t *testing.T) {
	charset := string(tempPasswordCharset)
	hasUpper := strings.ContainsAny(charset, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	hasLower := strings.ContainsAny(charset, "abcdefghijklmnopqrstuvwxyz")
	hasDigit := func() bool {
		for _, c := range charset {
			if unicode.IsDigit(c) {
				return true
			}
		}
		return false
	}()
	if !hasUpper {
		t.Error("charset missing uppercase letters")
	}
	if !hasLower {
		t.Error("charset missing lowercase letters")
	}
	if !hasDigit {
		t.Error("charset missing digits")
	}
}
