package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

// parseFindingsFilter reads the shared query params for the findings endpoints
// (list, facets, groups). On validation errors it writes the error response
// and returns ok=false so callers can bail out. The second return distinguishes
// the "user has zero accessible projects" short-circuit case.
func parseFindingsFilter(w http.ResponseWriter, r *http.Request, rolesRepo *storage.UserProjectRolesRepo) (storage.FindingsFilter, bool, bool) {
	q := r.URL.Query()

	filter := storage.FindingsFilter{
		Query:     q.Get("q"),
		CVE:       q.Get("cve"),
		Cursor:    q.Get("cursor"),
		SortField: q.Get("sort"),
		SortDir:   q.Get("dir"),
		GroupBy:   q.Get("group_by"),
	}

	if v := q.Get("project_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project_id")
			return filter, false, false
		}
		filter.ProjectID = id
	}

	user, _ := UserFromContext(r.Context())
	if !user.IsAdmin() {
		projectIDs, err := rolesRepo.ListProjectIDsForUser(r.Context(), user.ID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to resolve accessible projects")
			return filter, false, false
		}
		if len(projectIDs) == 0 {
			return filter, true, true // ok, but empty result
		}
		filter.AccessibleProjectIDs = projectIDs
	}

	if v := q.Get("severity"); v != "" {
		for _, s := range strings.Split(v, ",") {
			n, err := strconv.Atoi(s)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid severity value")
				return filter, false, false
			}
			filter.Severities = append(filter.Severities, n)
		}
	}

	if v := q.Get("status"); v != "" {
		for _, s := range strings.Split(v, ",") {
			n, err := strconv.Atoi(s)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid status value")
				return filter, false, false
			}
			filter.Statuses = append(filter.Statuses, n)
		}
	}

	if v := q.Get("cwe"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cwe value")
			return filter, false, false
		}
		filter.CWE = n
	}

	if v := q.Get("kinds"); v != "" {
		for _, s := range strings.Split(v, ",") {
			kind, ok := domain.ParseFindingKind(s)
			if !ok {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid kind value")
				return filter, false, false
			}
			filter.Kinds = append(filter.Kinds, kind)
		}
	}

	if v := q.Get("has_cve"); v == "true" {
		t := true
		filter.HasCVE = &t
	}
	if v := q.Get("has_fix"); v == "true" {
		t := true
		filter.HasFix = &t
	}
	if v := q.Get("in_kev"); v == "true" {
		t := true
		filter.InKEV = &t
	}
	if v := q.Get("in_bdu"); v == "true" {
		t := true
		filter.InBDU = &t
	}

	if v := q.Get("epss_min"); v != "" {
		f, err := strconv.ParseFloat(v, 64)
		if err != nil || f < 0 || f > 1 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid epss_min value")
			return filter, false, false
		}
		filter.EPSSMin = &f
	}

	if v := q.Get("cvss_min"); v != "" {
		f, err := strconv.ParseFloat(v, 64)
		if err != nil || f < 0 || f > 10 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cvss_min value")
			return filter, false, false
		}
		filter.CVSSMin = &f
	}

	if v := q.Get("age_max_days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid age_max_days value")
			return filter, false, false
		}
		filter.AgeMaxDays = &n
	}

	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid limit value")
			return filter, false, false
		}
		filter.Limit = n
	}

	return filter, true, false
}

func handleListFindings(repo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, ok, empty := parseFindingsFilter(w, r, rolesRepo)
		if !ok {
			return
		}
		if empty {
			respondList(w, []domain.Finding{}, 0, "")
			return
		}

		// Grouped listing: return aggregated buckets instead of flat findings.
		if filter.GroupBy != "" {
			switch filter.GroupBy {
			case "cve", "component", "rule":
			default:
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group_by value")
				return
			}
			groups, total, err := repo.ListGroups(r.Context(), filter, filter.GroupBy)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list finding groups")
				return
			}
			respondList(w, groups, total, "")
			return
		}

		findings, nextCursor, total, err := repo.List(r.Context(), filter)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings")
			return
		}

		respondList(w, findings, total, nextCursor)
	}
}

func handleGetFinding(repo *storage.FindingsRepo, pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		finding, err := repo.GetByID(r.Context(), id)
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
			return
		}

		result := map[string]any{"finding": finding}

		enrichments, err := enrichment.GetFindingEnrichments(r.Context(), pool, id)
		if err == nil && len(enrichments) > 0 {
			result["enrichments"] = enrichments
		}

		score, err := enrichment.GetFindingScore(r.Context(), pool, id)
		if err == nil && score != nil {
			result["score"] = score
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": result})
	}
}

func handleUpdateStatus(repo *storage.FindingsRepo) http.HandlerFunc {
	type request struct {
		Status int `json:"status"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		if req.Status < 0 || req.Status > 4 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "status must be between 0 and 4")
			return
		}

		if err := repo.UpdateStatus(r.Context(), id, req.Status); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
			return
		}

		respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func handleBulkUpdateStatus(repo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type request struct {
		IDs    []uuid.UUID `json:"ids"`
		Status int         `json:"status"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}

		if len(req.IDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "ids must not be empty")
			return
		}
		if req.Status < 0 || req.Status > 4 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "status must be between 0 and 4")
			return
		}
		user, _ := UserFromContext(r.Context())
		if !user.IsAdmin() {
			projectIDs, err := repo.ListDistinctProjectIDs(r.Context(), req.IDs)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
				return
			}

			forbiddenProjects := make([]uuid.UUID, 0)
			for _, projectID := range projectIDs {
				role, has, err := rolesRepo.GetRole(r.Context(), user.ID, projectID)
				if err != nil {
					respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
					return
				}
				if !has || role < domain.RoleTriager {
					forbiddenProjects = append(forbiddenProjects, projectID)
				}
			}
			if len(forbiddenProjects) > 0 {
				respondJSON(w, http.StatusForbidden, map[string]any{
					"error": map[string]any{
						"code": "FORBIDDEN_PROJECTS",
						"data": map[string]any{"projects": forbiddenProjects},
					},
				})
				return
			}
		}

		if err := repo.BulkUpdateStatus(r.Context(), req.IDs, req.Status); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update statuses")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{
			"status":  "updated",
			"updated": len(req.IDs),
		})
	}
}

func handleDeleteFinding(repo *storage.FindingsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}

		if err := repo.Delete(r.Context(), id); err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
