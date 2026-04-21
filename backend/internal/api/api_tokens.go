package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/auth"
	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

type createAPITokenRequest struct {
	Name          string   `json:"name"`
	Scopes        []string `json:"scopes"`
	ExpiresInDays *int     `json:"expires_in_days"`
}

func handleCreateAPIToken(repo *storage.APITokensRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		var req createAPITokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if req.Name == "" || len(req.Scopes) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "name and scopes are required")
			return
		}
		fullToken, prefix, hash, err := auth.GeneratePAT()
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate token")
			return
		}
		user, _ := UserFromContext(r.Context())
		var expiresAt *time.Time
		if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
			t := time.Now().Add(time.Duration(*req.ExpiresInDays) * 24 * time.Hour)
			expiresAt = &t
		}
		t := &domain.APIToken{ProjectID: projectID, Name: req.Name, Prefix: prefix, TokenHash: hash, Scopes: req.Scopes, CreatedByUserID: user.ID, ExpiresAt: expiresAt}
		if err := repo.Create(r.Context(), t); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create token")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{
			"id": t.ID, "name": t.Name, "prefix": t.Prefix, "token": fullToken, "scopes": t.Scopes, "expires_at": t.ExpiresAt,
		}})
	}
}

func handleListAPITokens(repo *storage.APITokensRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		tokens, err := repo.ListByProject(r.Context(), projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list tokens")
			return
		}
		data := make([]map[string]any, 0, len(tokens))
		for _, t := range tokens {
			data = append(data, map[string]any{
				"id": t.ID, "name": t.Name, "prefix": t.Prefix, "scopes": t.Scopes, "last_used_at": t.LastUsedAt,
				"expires_at": t.ExpiresAt, "revoked_at": t.RevokedAt, "created_at": t.CreatedAt,
				"created_by": map[string]any{"id": t.CreatedByUserID, "email": t.CreatedByEmail},
			})
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": data})
	}
}

func handleRevokeAPIToken(repo *storage.APITokensRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		tokenID, err := uuid.Parse(chi.URLParam(r, "tokenID"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid token id")
			return
		}
		if err := repo.Revoke(r.Context(), tokenID, projectID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to revoke token")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "revoked"}})
	}
}
