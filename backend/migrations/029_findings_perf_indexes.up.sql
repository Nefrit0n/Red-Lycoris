-- Performance indexes for high-volume findings list/facets queries.

-- Keyset pagination + default listing order.
CREATE INDEX IF NOT EXISTS idx_findings_project_first_seen_id
    ON findings (project_id, first_seen DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_findings_first_seen_id
    ON findings (first_seen DESC, id DESC);

-- Frequent facet/grouping dimensions.
CREATE INDEX IF NOT EXISTS idx_findings_source_type
    ON findings (source_type);

CREATE INDEX IF NOT EXISTS idx_findings_kind_status_project
    ON findings (finding_kind, status, project_id);

CREATE INDEX IF NOT EXISTS idx_findings_kind_project
    ON findings (finding_kind, project_id);

-- Fast existence counters used by enrichment facets.
CREATE INDEX IF NOT EXISTS idx_findings_has_cve
    ON findings (id)
    WHERE cve_ids IS NOT NULL AND array_length(cve_ids, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_findings_fixed_version_present
    ON findings (id)
    WHERE fixed_version IS NOT NULL;
