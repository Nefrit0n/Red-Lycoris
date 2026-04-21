package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

type patchPinnedRequest struct {
	Pinned bool `json:"pinned"`
}

func handleListProjects(repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				limit = n
			}
		}
		cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
		sort := strings.TrimSpace(r.URL.Query().Get("sort"))
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		team := strings.TrimSpace(r.URL.Query().Get("team"))
		sla := strings.TrimSpace(r.URL.Query().Get("sla"))
		owner := strings.TrimSpace(r.URL.Query().Get("owner"))

		statuses := parseProjectStatuses(r.URL.Query().Get("status"))
		tags := parseCSV(r.URL.Query().Get("tag"))

		user, _ := UserFromContext(r.Context())

		var accessible []uuid.UUID
		if !user.IsAdmin() {
			projectIDs, idsErr := rolesRepo.ListProjectIDsForUser(r.Context(), user.ID)
			if idsErr != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list projects")
				return
			}
			accessible = projectIDs
			if len(accessible) == 0 {
				respondList(w, []domain.Project{}, 0, "")
				return
			}
		}

		projects, total, nextCursor, err := repo.List(r.Context(), storage.ProjectsFilter{
			AccessibleProjectIDs: accessible,
			Limit:                limit,
			Cursor:               cursor,
			Statuses:             statuses,
			Team:                 team,
			SLA:                  sla,
			Tags:                 tags,
			Owner:                owner,
			Q:                    q,
			Sort:                 sort,
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list projects")
			return
		}

		respondList(w, projects, total, nextCursor)
	}
}

type createProjectSLA struct {
	UseTemplate      bool `json:"use_template"`
	CriticalDays     *int `json:"critical_days"`
	HighDays         *int `json:"high_days"`
	MediumDays       *int `json:"medium_days"`
	LowDays          *int `json:"low_days"`
	NotifyBeforeDays int  `json:"notify_before_breach_days"`
}

type createProjectRequest struct {
	Name        string          `json:"name"`
	Slug        string          `json:"slug"`
	Description string          `json:"description"`
	IconColor   string          `json:"icon_color"`
	Tags        []string        `json:"tags"`
	TemplateID  string          `json:"template_id"`
	OwnerID     string          `json:"owner_id"`
	TeamID      string          `json:"team_id"`
	TeamName    string          `json:"team_name"`
	Visibility  string          `json:"visibility"`
	SLA         createProjectSLA `json:"sla"`
	// Source and Invites are accepted but not processed (stub)
	Source  json.RawMessage   `json:"source"`
	Invites []json.RawMessage `json:"invites"`
}

func handleCreateProject(pool *pgxpool.Pool, repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createProjectRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		user, _ := UserFromContext(r.Context())

		p := domain.Project{
			Name:        req.Name,
			Slug:        req.Slug,
			Description: req.Description,
			IconColor:   req.IconColor,
			Tags:        req.Tags,
			Visibility:  req.Visibility,
			CreatedBy:   user.ID,
			SLACriticalDays:     req.SLA.CriticalDays,
			SLAHighDays:         req.SLA.HighDays,
			SLAMediumDays:       req.SLA.MediumDays,
			SLALowDays:          req.SLA.LowDays,
			SLANotifyBeforeDays: req.SLA.NotifyBeforeDays,
		}

		// Team: accept either team_id or team_name (for newly created teams)
		if req.TeamID != "" || req.TeamName != "" {
			p.Team = &domain.ProjectTeam{ID: req.TeamID, Name: req.TeamName}
		}

		// Owner: use provided owner_id or fall back to current user
		if req.OwnerID != "" {
			if ownerUUID, err := uuid.Parse(req.OwnerID); err == nil {
				p.Owner = domain.ProjectOwner{ID: ownerUUID}
			}
		}

		if err := p.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		tx, err := pool.Begin(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}
		defer tx.Rollback(r.Context())

		if err := repo.CreateTx(r.Context(), tx, &p); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) {
				switch pgErr.Code {
				case "23505":
					respondError(w, r, http.StatusConflict, "CONFLICT", "project with the same name or slug already exists")
					return
				case "23514":
					respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project data")
					return
				}
			}
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}
		if err := rolesRepo.Grant(r.Context(), tx, user.ID, p.ID, domain.RoleProjectAdmin, &user.ID); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to grant project role")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create project")
			return
		}

		respondJSON(w, http.StatusCreated, map[string]any{"data": p})
	}
}

func handleGetProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		p, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": p})
	}
}

func handleUpdateProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		var p domain.Project
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		p.ID = id

		if err := p.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		if err := repo.Update(r.Context(), &p); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": p})
	}
}

func handleDeleteProject(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		if err := repo.Delete(r.Context(), id); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handlePatchProjectPinned(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		var req patchPinnedRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if err := repo.SetPinned(r.Context(), id, req.Pinned); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"id": id, "pinned": req.Pinned}})
	}
}

func handleGetProjectTrend(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		days := 30
		if v := strings.TrimSpace(r.URL.Query().Get("days")); v != "" {
			if n, convErr := strconv.Atoi(v); convErr == nil {
				days = n
			}
		}
		points, trendErr := repo.GetTrend(r.Context(), id, days)
		if trendErr != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load trend")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": points, "meta": map[string]any{"days": days}})
	}
}

func handleGetProjectQuickPeek(repo *storage.ProjectsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		findings, events, stats, peekErr := repo.GetQuickPeek(r.Context(), id)
		if peekErr != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load quick peek")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{
				"top_findings": findings,
				"events":       events,
				"status_stats": stats,
			},
		})
	}
}

func parseCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func parseProjectStatuses(v string) []domain.ProjectStatus {
	raw := parseCSV(v)
	if len(raw) == 0 {
		return nil
	}
	out := make([]domain.ProjectStatus, 0, len(raw))
	for _, val := range raw {
		s := domain.ProjectStatus(val)
		switch s {
		case domain.ProjectStatusActive, domain.ProjectStatusPaused, domain.ProjectStatusArchived:
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
