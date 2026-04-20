package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func withURLParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestHandleGetProjectTemplates(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/workspace/project-templates", nil)
	w := httptest.NewRecorder()

	handleGetProjectTemplates()(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp struct {
		Data []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Data) == 0 {
		t.Fatal("expected at least one template, got 0")
	}
	ids := make(map[string]bool)
	for _, tmpl := range resp.Data {
		if tmpl.ID == "" {
			t.Error("template id is empty")
		}
		if tmpl.Name == "" {
			t.Error("template name is empty")
		}
		ids[tmpl.ID] = true
	}
	for _, expected := range []string{"web-api", "mobile", "iac", "library"} {
		if !ids[expected] {
			t.Errorf("missing template %q", expected)
		}
	}
}

func TestHandleCheckProjectSlug_EmptySlug(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/projects/check-slug", nil)
	w := httptest.NewRecorder()

	// nil repo — handler returns 400 before accessing repo
	handleCheckProjectSlug(nil)(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleGetIngestToken_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = withURLParam(req, "id", "not-a-uuid")
	w := httptest.NewRecorder()

	handleGetIngestToken()(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleGetIngestToken_ValidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = withURLParam(req, "id", uuid.New().String())
	w := httptest.NewRecorder()

	handleGetIngestToken()(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Data.Token == "" {
		t.Error("expected non-empty token")
	}
}
