package loadtest

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSeedSARIFTimeoutHint(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(150 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	tmp := t.TempDir()
	path := filepath.Join(tmp, "seed.json")
	if err := os.WriteFile(path, []byte(`{"runs":[]}`), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	err := SeedSARIF(context.Background(), srv.URL, "", "00000000-0000-0000-0000-000000000000", path, 20*time.Millisecond)
	if err == nil {
		t.Fatalf("expected timeout error")
	}
	if !strings.Contains(err.Error(), "--timeout=0") {
		t.Fatalf("expected timeout hint, got: %v", err)
	}
}

func TestSeedSARIFZeroTimeoutDisablesClientTimeout(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(120 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	tmp := t.TempDir()
	path := filepath.Join(tmp, "seed.json")
	if err := os.WriteFile(path, []byte(`{"runs":[]}`), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	if err := SeedSARIF(context.Background(), srv.URL, "", "00000000-0000-0000-0000-000000000000", path, 0); err != nil {
		t.Fatalf("seed with disabled timeout should succeed: %v", err)
	}
}
