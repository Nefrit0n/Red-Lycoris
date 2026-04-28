package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"redlycoris/internal/domain"
	"redlycoris/internal/storage"
)

func checkBulkProjectAccess(w http.ResponseWriter, r *http.Request, repo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo, findingIDs []uuid.UUID) bool {
	user, _ := UserFromContext(r.Context())
	if user.IsAdmin() {
		return true
	}
	projectIDs, err := repo.ListDistinctProjectIDs(r.Context(), findingIDs)
	if err != nil {
		respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
		return false
	}
	forbiddenProjects := make([]uuid.UUID, 0)
	for _, projectID := range projectIDs {
		role, has, err := rolesRepo.GetRole(r.Context(), user.ID, projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
			return false
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
		return false
	}
	return true
}

func handleUpdateStatus(findingsRepo *storage.FindingsRepo) http.HandlerFunc {
	type reqBody struct {
		Status int    `json:"status"`
		Note   string `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		user, _ := UserFromContext(r.Context())

		var action domain.TriageAction
		switch req.Status {
		case domain.StatusOpen:
			current, err := findingsRepo.GetByID(r.Context(), id)
			if err != nil {
				respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
				return
			}
			if current.Status == domain.StatusFP || current.Status == domain.StatusResolved || current.Status == domain.StatusRiskAccepted {
				action = &domain.ReopenAction{Note: req.Note}
			} else {
				action = &domain.ChangeStatusAction{NewStatus: req.Status, Note: req.Note}
			}
		case domain.StatusConfirmed:
			action = &domain.ChangeStatusAction{NewStatus: req.Status, Note: req.Note}
		case domain.StatusFP:
			action = &domain.CloseAction{ReasonCode: "false_positive", Note: req.Note, UserID: user.ID}
		case domain.StatusResolved:
			action = &domain.CloseAction{ReasonCode: "mitigated", Note: req.Note, UserID: user.ID}
		case domain.StatusRiskAccepted:
			action = &domain.CloseAction{ReasonCode: "acceptable_risk", Note: req.Note, UserID: user.ID}
		default:
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid status")
			return
		}

		if err := findingsRepo.ApplyTriageAction(r.Context(), user.ID, id, action); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "updated"}})
	}
}

func handleCloseFinding(findingsRepo *storage.FindingsRepo) http.HandlerFunc {
	type reqBody struct {
		ReasonCode string `json:"reason_code"`
		Note       string `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		user, _ := UserFromContext(r.Context())
		action := &domain.CloseAction{ReasonCode: req.ReasonCode, Note: req.Note, UserID: user.ID}
		if err := findingsRepo.ApplyTriageAction(r.Context(), user.ID, id, action); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "closed"}})
	}
}

func handleReopenFinding(findingsRepo *storage.FindingsRepo) http.HandlerFunc {
	type reqBody struct {
		Note string `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		user, _ := UserFromContext(r.Context())
		if err := findingsRepo.ApplyTriageAction(r.Context(), user.ID, id, &domain.ReopenAction{Note: req.Note}); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "reopened"}})
	}
}

func handleAssignFinding(findingsRepo *storage.FindingsRepo, usersRepo *storage.UsersRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		UserID uuid.UUID `json:"user_id"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		user, _ := UserFromContext(r.Context())
		if req.UserID == uuid.Nil {
			req.UserID = user.ID
		}
		projectID, err := findingsRepo.GetProjectID(r.Context(), id.String())
		if err != nil {
			respondError(w, r, http.StatusNotFound, "NOT_FOUND", "finding not found")
			return
		}
		hasAccess, err := rolesRepo.HasProjectAccess(r.Context(), req.UserID, projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check target user access")
			return
		}
		if !hasAccess {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "target user has no access")
			return
		}
		target, err := usersRepo.GetByID(r.Context(), req.UserID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "target user not found")
			return
		}
		action := &domain.AssignAction{ToUserID: req.UserID, ToEmail: target.Email}
		if err := findingsRepo.ApplyTriageAction(r.Context(), user.ID, id, action); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "assigned"}})
	}
}

func handleUnassignFinding(findingsRepo *storage.FindingsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		user, _ := UserFromContext(r.Context())
		if err := findingsRepo.ApplyTriageAction(r.Context(), user.ID, id, &domain.UnassignAction{}); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "unassigned"}})
	}
}

func handleListFindingEvents(eventsRepo *storage.FindingEventsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid finding id")
			return
		}
		cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
		limit := 50
		if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
			parsed, err := strconv.Atoi(v)
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid limit value")
				return
			}
			limit = parsed
		}
		events, nextCursor, err := eventsRepo.ListForFinding(r.Context(), id, cursor, limit)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list events")
			return
		}
		respondList(w, events, len(events), nextCursor)
	}
}

func handleListClosureReasons(closureReasonsRepo *storage.ClosureReasonsRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reasons, err := closureReasonsRepo.ListActive(r.Context())
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load closure reasons")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": reasons})
	}
}

func handleBulkUpdateStatus(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		IDs    []uuid.UUID `json:"ids"`
		Status int         `json:"status"`
		Note   string      `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.IDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "ids must not be empty")
			return
		}
		if req.Status != domain.StatusOpen && req.Status != domain.StatusConfirmed {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "use POST /close")
			return
		}
		if !checkBulkProjectAccess(w, r, findingsRepo, rolesRepo, req.IDs) {
			return
		}
		user, _ := UserFromContext(r.Context())
		result, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, req.IDs, func(_ uuid.UUID) domain.TriageAction {
			return &domain.ChangeStatusAction{
				NewStatus: req.Status,
				Note:      req.Note,
			}
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk update status")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"succeeded": result.Succeeded, "failed": result.Failed}})
	}
}

func handleBulkClose(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		IDs        []uuid.UUID `json:"ids"`
		ReasonCode string      `json:"reason_code"`
		Note       string      `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.IDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "ids must not be empty")
			return
		}
		if !checkBulkProjectAccess(w, r, findingsRepo, rolesRepo, req.IDs) {
			return
		}
		user, _ := UserFromContext(r.Context())
		result, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, req.IDs, func(_ uuid.UUID) domain.TriageAction {
			return &domain.CloseAction{ReasonCode: req.ReasonCode, Note: req.Note, UserID: user.ID}
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk close findings")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"succeeded": result.Succeeded, "failed": result.Failed}})
	}
}

func handleBulkAssign(findingsRepo *storage.FindingsRepo, usersRepo *storage.UsersRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		IDs    []uuid.UUID `json:"ids"`
		UserID uuid.UUID   `json:"user_id"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.IDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "ids must not be empty")
			return
		}
		if !checkBulkProjectAccess(w, r, findingsRepo, rolesRepo, req.IDs) {
			return
		}
		target, err := usersRepo.GetByID(r.Context(), req.UserID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "target user not found")
			return
		}
		for _, id := range req.IDs {
			projectID, err := findingsRepo.GetProjectID(r.Context(), id.String())
			if err != nil {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", fmt.Sprintf("finding %s not found", id))
				return
			}
			hasAccess, err := rolesRepo.HasProjectAccess(r.Context(), req.UserID, projectID)
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check target user access")
				return
			}
			if !hasAccess {
				respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "target user has no access")
				return
			}
		}
		user, _ := UserFromContext(r.Context())
		result, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, req.IDs, func(_ uuid.UUID) domain.TriageAction {
			return &domain.AssignAction{ToUserID: req.UserID, ToEmail: target.Email}
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk assign findings")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"succeeded": result.Succeeded, "failed": result.Failed}})
	}
}

func handleBulkUnassign(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		IDs []uuid.UUID `json:"ids"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if len(req.IDs) == 0 {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "ids must not be empty")
			return
		}
		if !checkBulkProjectAccess(w, r, findingsRepo, rolesRepo, req.IDs) {
			return
		}
		user, _ := UserFromContext(r.Context())
		result, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, req.IDs, func(_ uuid.UUID) domain.TriageAction {
			return &domain.UnassignAction{}
		})
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk unassign findings")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"succeeded": result.Succeeded, "failed": result.Failed}})
	}
}

func handleAssignableUsers(pool *pgxpool.Pool) http.HandlerFunc {
	type item struct {
		ID       uuid.UUID `json:"id"`
		Email    string    `json:"email"`
		FullName string    `json:"full_name"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		projectID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid project id")
			return
		}
		rows, err := pool.Query(r.Context(), `
			SELECT DISTINCT u.id, u.email, u.full_name
			FROM users u
			LEFT JOIN user_project_roles r ON r.user_id = u.id AND r.project_id = $1
			WHERE u.is_active AND (r.project_id IS NOT NULL OR u.global_role = 1)
			ORDER BY u.email`, projectID)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load assignable users")
			return
		}
		defer rows.Close()
		result := make([]item, 0)
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.ID, &it.Email, &it.FullName); err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to scan users")
				return
			}
			result = append(result, it)
		}
		if err := rows.Err(); err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to read users")
			return
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": result})
	}
}

// splitIDsByTriagerAccess partitions finding IDs into those where the user has
// at least RoleTriager and those where they don't. Admin users pass everything.
// Results are cached by project ID to avoid N+1 role queries.
func splitIDsByTriagerAccess(
	ctx context.Context,
	findingsRepo *storage.FindingsRepo,
	rolesRepo *storage.UserProjectRolesRepo,
	user *domain.User,
	ids []uuid.UUID,
) (allowed []uuid.UUID, forbidden map[uuid.UUID]string, err error) {
	forbidden = make(map[uuid.UUID]string)
	if user.IsAdmin() {
		return ids, forbidden, nil
	}

	// Batch-fetch all distinct project IDs for the given finding IDs.
	projectIDs, err := findingsRepo.ListDistinctProjectIDs(ctx, ids)
	if err != nil {
		return nil, nil, fmt.Errorf("splitIDsByTriagerAccess: list projects: %w", err)
	}

	// Build allowed-project set.
	allowedProjects := make(map[uuid.UUID]bool, len(projectIDs))
	for _, pid := range projectIDs {
		role, has, roleErr := rolesRepo.GetRole(ctx, user.ID, pid)
		if roleErr != nil {
			return nil, nil, fmt.Errorf("splitIDsByTriagerAccess: get role: %w", roleErr)
		}
		allowedProjects[pid] = has && role >= domain.RoleTriager
	}

	// We need the project ID for each finding to partition. Re-use a small query.
	findingProjects, queryErr := findingsRepo.GetProjectIDsForFindings(ctx, ids)
	if queryErr != nil {
		return nil, nil, fmt.Errorf("splitIDsByTriagerAccess: get finding projects: %w", queryErr)
	}

	allowed = make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		pid := findingProjects[id]
		if allowedProjects[pid] {
			allowed = append(allowed, id)
		} else {
			forbidden[id] = "access denied"
		}
	}
	return allowed, forbidden, nil
}

// groupBulkRequest is the shared body for all group-level bulk endpoints.
type groupBulkRequest struct {
	GroupBy string `json:"group_by"`
	GroupKey string `json:"group_key"`
}

func (req *groupBulkRequest) validate(w http.ResponseWriter, r *http.Request) bool {
	if req.GroupKey == "" {
		respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "group_key is required")
		return false
	}
	switch req.GroupBy {
	case "cve", "component", "rule", "secret":
		return true
	default:
		respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid group_by value")
		return false
	}
}

// resolveGroupIDs fetches IDs for the group, checking the bulk size limit, and
// writes an error response on failure. Returns nil ids on error (caller should
// return immediately).
func resolveGroupIDs(
	w http.ResponseWriter,
	r *http.Request,
	findingsRepo *storage.FindingsRepo,
	groupBy, groupKey string,
) ([]uuid.UUID, int, bool) {
	ids, total, err := findingsRepo.ListIDsByGroup(r.Context(), storage.FindingsFilter{}, groupBy, groupKey)
	if err != nil {
		var limitErr *storage.BulkLimitExceededError
		if errors.As(err, &limitErr) {
			respondJSON(w, http.StatusBadRequest, map[string]any{
				"error": map[string]any{
					"code":    "BULK_LIMIT_EXCEEDED",
					"message": fmt.Sprintf("too many findings in group (%d > 5000), use manual filtering", limitErr.Count),
					"details": map[string]any{"count": limitErr.Count},
				},
			})
			return nil, 0, false
		}
		respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list findings in group")
		return nil, 0, false
	}
	return ids, total, true
}

func handleGroupBulkClose(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		groupBulkRequest
		ReasonCode string `json:"reason_code"`
		Note       string `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if !req.validate(w, r) {
			return
		}

		user, _ := UserFromContext(r.Context())
		ids, total, ok := resolveGroupIDs(w, r, findingsRepo, req.GroupBy, req.GroupKey)
		if !ok {
			return
		}
		if len(ids) == 0 {
			respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
				"succeeded": []uuid.UUID{}, "failed": map[uuid.UUID]string{},
				"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
			}})
			return
		}

		allowed, forbidden, err := splitIDsByTriagerAccess(r.Context(), findingsRepo, rolesRepo, user, ids)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
			return
		}

		result := storage.BulkResult{Succeeded: []uuid.UUID{}, Failed: forbidden}
		if len(allowed) > 0 {
			r2, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, allowed, func(_ uuid.UUID) domain.TriageAction {
				return &domain.CloseAction{ReasonCode: req.ReasonCode, Note: req.Note, UserID: user.ID}
			})
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk close findings")
				return
			}
			result.Succeeded = r2.Succeeded
			for id, reason := range r2.Failed {
				result.Failed[id] = reason
			}
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"succeeded": result.Succeeded, "failed": result.Failed,
			"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
		}})
	}
}

func handleGroupBulkAssign(findingsRepo *storage.FindingsRepo, usersRepo *storage.UsersRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		groupBulkRequest
		UserID uuid.UUID `json:"user_id"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if !req.validate(w, r) {
			return
		}
		target, err := usersRepo.GetByID(r.Context(), req.UserID)
		if err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "target user not found")
			return
		}

		user, _ := UserFromContext(r.Context())
		ids, total, ok := resolveGroupIDs(w, r, findingsRepo, req.GroupBy, req.GroupKey)
		if !ok {
			return
		}
		if len(ids) == 0 {
			respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
				"succeeded": []uuid.UUID{}, "failed": map[uuid.UUID]string{},
				"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
			}})
			return
		}

		allowed, forbidden, err := splitIDsByTriagerAccess(r.Context(), findingsRepo, rolesRepo, user, ids)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
			return
		}

		result := storage.BulkResult{Succeeded: []uuid.UUID{}, Failed: forbidden}
		if len(allowed) > 0 {
			r2, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, allowed, func(_ uuid.UUID) domain.TriageAction {
				return &domain.AssignAction{ToUserID: req.UserID, ToEmail: target.Email}
			})
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk assign findings")
				return
			}
			result.Succeeded = r2.Succeeded
			for id, reason := range r2.Failed {
				result.Failed[id] = reason
			}
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"succeeded": result.Succeeded, "failed": result.Failed,
			"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
		}})
	}
}

func handleGroupBulkStatus(findingsRepo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	type reqBody struct {
		groupBulkRequest
		Status int    `json:"status"`
		Note   string `json:"note"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req reqBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
			return
		}
		if !req.validate(w, r) {
			return
		}
		if req.Status != domain.StatusOpen && req.Status != domain.StatusConfirmed {
			respondError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "use /groups/bulk/close for closure statuses")
			return
		}

		user, _ := UserFromContext(r.Context())
		ids, total, ok := resolveGroupIDs(w, r, findingsRepo, req.GroupBy, req.GroupKey)
		if !ok {
			return
		}
		if len(ids) == 0 {
			respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
				"succeeded": []uuid.UUID{}, "failed": map[uuid.UUID]string{},
				"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
			}})
			return
		}

		allowed, forbidden, err := splitIDsByTriagerAccess(r.Context(), findingsRepo, rolesRepo, user, ids)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to check permissions")
			return
		}

		result := storage.BulkResult{Succeeded: []uuid.UUID{}, Failed: forbidden}
		if len(allowed) > 0 {
			r2, err := findingsRepo.ApplyBulkTriageAction(r.Context(), user.ID, allowed, func(_ uuid.UUID) domain.TriageAction {
				return &domain.ChangeStatusAction{NewStatus: req.Status, Note: req.Note}
			})
			if err != nil {
				respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to bulk update status")
				return
			}
			result.Succeeded = r2.Succeeded
			for id, reason := range r2.Failed {
				result.Failed[id] = reason
			}
		}
		respondJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
			"succeeded": result.Succeeded, "failed": result.Failed,
			"group_by": req.GroupBy, "group_key": req.GroupKey, "total": total,
		}})
	}
}
