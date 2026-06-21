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
	Name         string                `json:"name"`
	Slug         string                `json:"slug"`
	Description  string                `json:"description"`
	IconColor    string                `json:"icon_color"`
	RepoURL      string                `json:"repo_url"`
	RepoProvider string                `json:"repo_provider"`
	Tags         []string              `json:"tags"`
	TemplateID   string                `json:"template_id"`
	OwnerID      string                `json:"owner_id"`
	TeamID       string                `json:"team_id"`
	TeamName     string                `json:"team_name"`
	Visibility   string                `json:"visibility"`
	SLA          createProjectSLA      `json:"sla"`
	Source       optionalProjectSource `json:"source"`
	// Invites are accepted for compatibility; pending email invites are not implemented.
	Invites []json.RawMessage `json:"invites"`
}

type projectSourceRequest struct {
	Kind           string `json:"kind"`
	Provider       string `json:"provider"`
	RepoURL        string `json:"repo_url"`
	DefaultBranch  string `json:"default_branch"`
	AutoscanOnPush *bool  `json:"autoscan_on_push"`
}

type optionalProjectSource struct {
	Set   bool
	Null  bool
	Value projectSourceRequest
}

func (s *optionalProjectSource) UnmarshalJSON(raw []byte) error {
	s.Set = true
	if strings.TrimSpace(string(raw)) == "null" {
		s.Null = true
		return nil
	}
	return json.Unmarshal(raw, &s.Value)
}

type nullableIntField struct {
	Set   bool
	Value *int
}

func (f *nullableIntField) UnmarshalJSON(raw []byte) error {
	f.Set = true
	if strings.TrimSpace(string(raw)) == "null" {
		f.Value = nil
		return nil
	}
	var value int
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	f.Value = &value
	return nil
}

type updateProjectSLA struct {
	CriticalDays     nullableIntField `json:"critical_days"`
	HighDays         nullableIntField `json:"high_days"`
	MediumDays       nullableIntField `json:"medium_days"`
	LowDays          nullableIntField `json:"low_days"`
	NotifyBeforeDays *int             `json:"notify_before_breach_days"`
}

type updateProjectRequest struct {
	ID                  *uuid.UUID            `json:"id"`
	Name                *string               `json:"name"`
	Slug                *string               `json:"slug"`
	Description         *string               `json:"description"`
	IconColor           *string               `json:"icon_color"`
	RepoURL             *string               `json:"repo_url"`
	RepoProvider        *string               `json:"repo_provider"`
	Tags                *[]string             `json:"tags"`
	Status              *domain.ProjectStatus `json:"status"`
	SetupCompleted      *bool                 `json:"setup_completed"`
	OwnerID             *string               `json:"owner_id"`
	TeamID              *string               `json:"team_id"`
	Team                *domain.ProjectTeam   `json:"team"`
	Visibility          *string               `json:"visibility"`
	SLA                 *updateProjectSLA     `json:"sla"`
	SLACriticalDays     nullableIntField      `json:"sla_critical_days"`
	SLAHighDays         nullableIntField      `json:"sla_high_days"`
	SLAMediumDays       nullableIntField      `json:"sla_medium_days"`
	SLALowDays          nullableIntField      `json:"sla_low_days"`
	SLANotifyBeforeDays *int                  `json:"sla_notify_before_days"`
	Source              optionalProjectSource `json:"source"`
}

func handleCreateProject(pool *pgxpool.Pool, repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createProjectRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		user, _ := UserFromContext(r.Context())
		ownerID := user.ID
		if req.OwnerID != "" {
			ownerUUID, parseErr := uuid.Parse(req.OwnerID)
			if parseErr != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid owner_id")
				return
			}
			ownerID = ownerUUID
		}

		p := domain.Project{
			Name:                req.Name,
			Slug:                req.Slug,
			Description:         req.Description,
			IconColor:           req.IconColor,
			Tags:                req.Tags,
			Visibility:          req.Visibility,
			CreatedBy:           ownerID,
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

		if req.Source.Set {
			if req.Source.Null {
				applyManualProjectSource(&p)
			} else if err := applyProjectSource(&p, req.Source.Value); err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
				return
			}
		} else if strings.TrimSpace(req.RepoURL) != "" {
			autoscan := true
			if err := applyProjectSource(&p, projectSourceRequest{
				Kind:           string(domain.ProjectSourceGit),
				Provider:       req.RepoProvider,
				RepoURL:        req.RepoURL,
				DefaultBranch:  "main",
				AutoscanOnPush: &autoscan,
			}); err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
				return
			}
		}
		p.Owner = domain.ProjectOwner{ID: ownerID}

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
				case "23503":
					respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "selected team does not exist")
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
		if p.CreatedBy != user.ID {
			if err := rolesRepo.Grant(r.Context(), tx, p.CreatedBy, p.ID, domain.RoleProjectAdmin, &user.ID); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to grant project owner role")
				return
			}
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

func handleUpdateProject(pool *pgxpool.Pool, repo *storage.ProjectsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}

		var req updateProjectRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		current, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "project not found")
			return
		}

		next, ownerChanged, err := applyProjectUpdate(current, req)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		next.ID = id

		user, ok := UserFromContext(r.Context())
		if !ok {
			respondError(w, r, http.StatusUnauthorized, "AUTHENTICATION_REQUIRED", "authentication required")
			return
		}
		if ownerChanged && !user.IsAdmin() && current.Owner.ID != user.ID {
			respondError(w, r, http.StatusForbidden, "PROJECT_OWNER_REQUIRED", "project owner or admin required to change owner")
			return
		}

		if err := next.Validate(); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}

		tx, err := pool.Begin(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update project")
			return
		}
		defer tx.Rollback(r.Context())

		if err := repo.UpdateTx(r.Context(), tx, &next); err != nil {
			respondProjectWriteError(w, r, err, "failed to update project")
			return
		}
		if ownerChanged {
			if err := rolesRepo.Grant(r.Context(), tx, next.CreatedBy, next.ID, domain.RoleProjectAdmin, &user.ID); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to grant project owner role")
				return
			}
		}
		if err := tx.Commit(r.Context()); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update project")
			return
		}

		updated, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load updated project")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": updated})
	}
}

func applyProjectUpdate(current *domain.Project, req updateProjectRequest) (domain.Project, bool, error) {
	next := *current
	next.ID = current.ID
	next.CreatedBy = current.CreatedBy
	if next.CreatedBy == uuid.Nil {
		next.CreatedBy = current.Owner.ID
	}

	if req.Name != nil {
		next.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		next.Slug = strings.TrimSpace(*req.Slug)
	}
	if req.Description != nil {
		next.Description = strings.TrimSpace(*req.Description)
	}
	if req.IconColor != nil {
		next.IconColor = strings.TrimSpace(*req.IconColor)
	}
	if req.Tags != nil {
		next.Tags = normalizeProjectTags(*req.Tags)
	}
	if req.Status != nil {
		if !isValidProjectStatus(*req.Status) {
			return next, false, errors.New("invalid project status")
		}
		next.Status = *req.Status
	}
	if req.SetupCompleted != nil {
		next.SetupCompleted = *req.SetupCompleted
	}
	if req.Visibility != nil {
		visibility := strings.TrimSpace(*req.Visibility)
		if !isValidProjectVisibility(visibility) {
			return next, false, errors.New("invalid project visibility")
		}
		next.Visibility = visibility
	}

	if req.TeamID != nil {
		teamID := strings.TrimSpace(*req.TeamID)
		if teamID == "" {
			next.Team = nil
		} else {
			if _, err := uuid.Parse(teamID); err != nil {
				return next, false, errors.New("invalid team_id")
			}
			next.Team = &domain.ProjectTeam{ID: teamID}
		}
	} else if req.Team != nil {
		if strings.TrimSpace(req.Team.ID) == "" {
			next.Team = nil
		} else {
			if _, err := uuid.Parse(strings.TrimSpace(req.Team.ID)); err != nil {
				return next, false, errors.New("invalid team id")
			}
			next.Team = &domain.ProjectTeam{ID: strings.TrimSpace(req.Team.ID), Name: strings.TrimSpace(req.Team.Name)}
		}
	}

	ownerChanged := false
	if req.OwnerID != nil {
		ownerID, err := uuid.Parse(strings.TrimSpace(*req.OwnerID))
		if err != nil || ownerID == uuid.Nil {
			return next, false, errors.New("invalid owner_id")
		}
		currentOwner := current.Owner.ID
		if currentOwner == uuid.Nil {
			currentOwner = current.CreatedBy
		}
		if ownerID != currentOwner {
			ownerChanged = true
		}
		next.CreatedBy = ownerID
		next.Owner.ID = ownerID
	}

	if req.SLA != nil {
		applyProjectSLA(&next, *req.SLA)
	}
	applyNullableInt(&next.SLACriticalDays, req.SLACriticalDays)
	applyNullableInt(&next.SLAHighDays, req.SLAHighDays)
	applyNullableInt(&next.SLAMediumDays, req.SLAMediumDays)
	applyNullableInt(&next.SLALowDays, req.SLALowDays)
	if req.SLANotifyBeforeDays != nil {
		next.SLANotifyBeforeDays = *req.SLANotifyBeforeDays
	}

	if req.Source.Set {
		if req.Source.Null {
			applyManualProjectSource(&next)
		} else if err := applyProjectSource(&next, req.Source.Value); err != nil {
			return next, false, err
		}
	} else {
		if req.RepoURL != nil {
			next.RepoURL = strings.TrimSpace(*req.RepoURL)
			if next.RepoURL != "" {
				next.SourceKind = domain.ProjectSourceGit
			} else if next.SourceKind == domain.ProjectSourceGit {
				applyManualProjectSource(&next)
			}
		}
		if req.RepoProvider != nil {
			next.RepoProvider = strings.TrimSpace(*req.RepoProvider)
		}
	}

	return next, ownerChanged, nil
}

func applyProjectSLA(p *domain.Project, sla updateProjectSLA) {
	applyNullableInt(&p.SLACriticalDays, sla.CriticalDays)
	applyNullableInt(&p.SLAHighDays, sla.HighDays)
	applyNullableInt(&p.SLAMediumDays, sla.MediumDays)
	applyNullableInt(&p.SLALowDays, sla.LowDays)
	if sla.NotifyBeforeDays != nil {
		p.SLANotifyBeforeDays = *sla.NotifyBeforeDays
	}
}

func applyNullableInt(target **int, field nullableIntField) {
	if !field.Set {
		return
	}
	*target = field.Value
}

func applyProjectSource(p *domain.Project, source projectSourceRequest) error {
	kind := domain.ProjectSourceKind(strings.TrimSpace(source.Kind))
	if kind == "" {
		if strings.TrimSpace(source.RepoURL) != "" || strings.TrimSpace(source.Provider) != "" {
			kind = domain.ProjectSourceGit
		} else {
			kind = domain.ProjectSourceManual
		}
	}

	switch kind {
	case domain.ProjectSourceManual:
		applyManualProjectSource(p)
	case domain.ProjectSourceGit:
		repoURL := strings.TrimSpace(source.RepoURL)
		if repoURL == "" {
			return errors.New("repo_url is required for git source")
		}
		p.SourceKind = domain.ProjectSourceGit
		p.RepoURL = repoURL
		p.RepoProvider = strings.TrimSpace(source.Provider)
		if p.RepoProvider == "" {
			p.RepoProvider = "other"
		}
		p.DefaultBranch = strings.TrimSpace(source.DefaultBranch)
		if p.DefaultBranch == "" {
			p.DefaultBranch = "main"
		}
		p.AutoscanOnPush = source.AutoscanOnPush != nil && *source.AutoscanOnPush
	case domain.ProjectSourceSarif, domain.ProjectSourceWebhook:
		p.SourceKind = kind
		p.RepoURL = ""
		p.RepoProvider = ""
		p.DefaultBranch = "main"
		p.AutoscanOnPush = false
	default:
		return errors.New("invalid project source kind")
	}

	return nil
}

func applyManualProjectSource(p *domain.Project) {
	p.SourceKind = domain.ProjectSourceManual
	p.RepoURL = ""
	p.RepoProvider = ""
	p.DefaultBranch = "main"
	p.AutoscanOnPush = false
}

func normalizeProjectTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	out := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		normalized := strings.TrimSpace(tag)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, normalized)
	}
	return out
}

func isValidProjectStatus(status domain.ProjectStatus) bool {
	switch status {
	case domain.ProjectStatusActive, domain.ProjectStatusPaused, domain.ProjectStatusArchived:
		return true
	default:
		return false
	}
}

func isValidProjectVisibility(visibility string) bool {
	switch visibility {
	case "private", "team", "workspace":
		return true
	default:
		return false
	}
}

func respondProjectWriteError(w http.ResponseWriter, r *http.Request, err error, fallback string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			respondError(w, r, http.StatusConflict, "CONFLICT", "project with the same name or slug already exists")
			return
		case "23503":
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "selected related entity does not exist")
			return
		case "23514":
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project data")
			return
		}
	}
	respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", fallback)
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
