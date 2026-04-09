package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/enrichment"
	"redlycoris/internal/storage"
)

func handleListFindings(repo *storage.FindingsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		filter := storage.FindingsFilter{
			Query:     q.Get("q"),
			CVE:       q.Get("cve"),
			Cursor:    q.Get("cursor"),
			SortField: q.Get("sort"),
			SortDir:   q.Get("dir"),
		}

		if v := q.Get("project_id"); v != "" {
			id, err := uuid.Parse(v)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project_id")
				return
			}
			filter.ProjectID = id
		}

		if v := q.Get("severity"); v != "" {
			for _, s := range strings.Split(v, ",") {
				n, err := strconv.Atoi(s)
				if err != nil {
					respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid severity value")
					return
				}
				filter.Severities = append(filter.Severities, n)
			}
		}

		if v := q.Get("status"); v != "" {
			for _, s := range strings.Split(v, ",") {
				n, err := strconv.Atoi(s)
				if err != nil {
					respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid status value")
					return
				}
				filter.Statuses = append(filter.Statuses, n)
			}
		}

		if v := q.Get("cwe"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cwe value")
				return
			}
			filter.CWE = n
		}

		if v := q.Get("limit"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid limit value")
				return
			}
			filter.Limit = n
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

func handleBulkUpdateStatus(repo *storage.FindingsRepo) http.HandlerFunc {
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
