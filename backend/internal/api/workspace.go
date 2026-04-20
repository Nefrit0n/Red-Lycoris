package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

// projectTemplate is the static definition served from GET /workspace/project-templates.
type projectTemplate struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Scanners    projectTemplateScanners  `json:"scanners"`
	SLA         projectTemplateSLA       `json:"sla"`
}

type projectTemplateScanners struct {
	SAST    string `json:"sast"`
	DAST    string `json:"dast"`
	SCA     string `json:"sca"`
	Secrets string `json:"secrets"`
}

type projectTemplateSLA struct {
	CriticalDays int `json:"critical_days"`
	HighDays     int `json:"high_days"`
	MediumDays   int `json:"medium_days"`
}

var defaultProjectTemplates = []projectTemplate{
	{
		ID: "web-api", Name: "Web API",
		Description: "SAST + DAST + SCA + Secrets. SLA: critical 7д / high 30д / medium 90д",
		Scanners:    projectTemplateScanners{SAST: "required", DAST: "required", SCA: "required", Secrets: "required"},
		SLA:         projectTemplateSLA{CriticalDays: 7, HighDays: 30, MediumDays: 90},
	},
	{
		ID: "mobile", Name: "Mobile",
		Description: "SAST + SCA + Secrets. SLA: critical 7д / high 30д / medium 90д",
		Scanners:    projectTemplateScanners{SAST: "required", DAST: "off", SCA: "required", Secrets: "required"},
		SLA:         projectTemplateSLA{CriticalDays: 7, HighDays: 30, MediumDays: 90},
	},
	{
		ID: "iac", Name: "Infra as Code",
		Description: "SAST + Secrets. SLA: critical 3д / high 14д / medium 60д",
		Scanners:    projectTemplateScanners{SAST: "required", DAST: "off", SCA: "off", Secrets: "required"},
		SLA:         projectTemplateSLA{CriticalDays: 3, HighDays: 14, MediumDays: 60},
	},
	{
		ID: "library", Name: "Library/SDK",
		Description: "SAST + SCA + Secrets. SLA: critical 7д / high 30д / medium 90д",
		Scanners:    projectTemplateScanners{SAST: "required", DAST: "off", SCA: "required", Secrets: "required"},
		SLA:         projectTemplateSLA{CriticalDays: 7, HighDays: 30, MediumDays: 90},
	},
}

func handleGetProjectTemplates() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]any{"data": defaultProjectTemplates})
	}
}

func handleGetWorkspaceMembers(repo *storage.WorkspaceRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		limit := 20
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}

		members, err := repo.ListMembers(r.Context(), q, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list members")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": members})
	}
}

func handleGetWorkspaceTeams(repo *storage.WorkspaceRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		limit := 50
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}

		teams, err := repo.ListTeams(r.Context(), q, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list teams")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": teams})
	}
}

func handleCreateWorkspaceTeam(repo *storage.WorkspaceRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var t domain.Team
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if err := t.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		if err := repo.CreateTeam(r.Context(), &t); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create team")
			return
		}
		respondJSON(w, http.StatusCreated, map[string]any{"data": t})
	}
}

func handleGetWorkspaceTags(repo *storage.WorkspaceRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		prefix := strings.TrimSpace(r.URL.Query().Get("prefix"))
		limit := 10
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				limit = n
			}
		}

		tags, err := repo.ListTags(r.Context(), prefix, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list tags")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": tags})
	}
}

func handleCheckProjectSlug(repo *storage.WorkspaceRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := strings.TrimSpace(r.URL.Query().Get("slug"))
		if slug == "" {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "slug is required")
			return
		}
		available, err := repo.CheckSlugAvailable(r.Context(), slug)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check slug")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]bool{"available": available}})
	}
}

// handleGetIngestToken generates a random ingest token.
// The token is not persisted — this is a stub until a full ingest_tokens table is added.
func handleGetIngestToken() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		projectID := chi.URLParam(r, "id")
		if _, err := uuid.Parse(projectID); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		b := make([]byte, 24)
		if _, err := rand.Read(b); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate token")
			return
		}
		token := base64.RawURLEncoding.EncodeToString(b)
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"token": token}})
	}
}
