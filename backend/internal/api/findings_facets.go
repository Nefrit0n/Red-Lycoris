package api

import (
	"net/http"

	"redlycoris/internal/storage"
)

// handleFindingsFacets returns bucketed facet counts for the same filter set
// the list endpoint accepts. Each bucket is computed without the filter on
// its own axis so the chips for that dimension show real, clickable counts.
// When the caller is a non-admin with zero accessible projects the response
// is a fully-zeroed facets payload.
func handleFindingsFacets(repo *storage.FindingsRepo, rolesRepo *storage.UserProjectRolesRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter, ok, empty := parseFindingsFilter(w, r, rolesRepo)
		if !ok {
			return
		}
		if empty {
			respondJSON(w, http.StatusOK, map[string]any{
				"data": &storage.FindingsFacets{
					BySeverity:    []storage.SeverityFacet{},
					ByStatus:      []storage.StatusFacet{},
					ByKind:        []storage.KindFacet{},
					BySource:      []storage.StringFacet{},
					ByProject:     []storage.ProjectFacet{},
					ByEcosystem:   []storage.StringFacet{},
					ByIacProvider: []storage.StringFacet{},
					BySecretKind:  []storage.StringFacet{},
				},
			})
			return
		}

		facets, err := repo.Facets(r.Context(), filter)
		if err != nil {
			respondError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load facets")
			return
		}

		respondJSON(w, http.StatusOK, map[string]any{"data": facets})
	}
}
