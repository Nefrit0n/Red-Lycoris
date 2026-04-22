-- Projects
CREATE TABLE projects (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    tags        TEXT[],
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_name ON projects (name);

-- Raw findings (partitioned by imported_at, monthly)
CREATE TABLE raw_findings (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    source_type TEXT        NOT NULL,
    source_id   TEXT,
    raw_data    JSONB       NOT NULL,
    fingerprint TEXT        NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    project_id  UUID        NOT NULL REFERENCES projects(id),
    PRIMARY KEY (id, imported_at)
) PARTITION BY RANGE (imported_at);

CREATE INDEX idx_raw_findings_fingerprint ON raw_findings (fingerprint);
CREATE INDEX idx_raw_findings_project_id  ON raw_findings (project_id);

-- Partitions: 12 months ahead (Apr 2026 – Mar 2027)
CREATE TABLE raw_findings_2026_04 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE raw_findings_2026_05 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE raw_findings_2026_06 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE raw_findings_2026_07 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE raw_findings_2026_08 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE raw_findings_2026_09 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE raw_findings_2026_10 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE raw_findings_2026_11 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE raw_findings_2026_12 PARTITION OF raw_findings
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE raw_findings_2027_01 PARTITION OF raw_findings
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE raw_findings_2027_02 PARTITION OF raw_findings
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE raw_findings_2027_03 PARTITION OF raw_findings
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- Findings
CREATE TABLE findings (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT        NOT NULL,
    description       TEXT,
    severity          INT         NOT NULL DEFAULT 0,
    confidence        INT         NOT NULL DEFAULT 0,
    status            INT         NOT NULL DEFAULT 0,
    file_path         TEXT,
    line_start        INT,
    line_end          INT,
    component         TEXT,
    component_version TEXT,
    cve_ids           TEXT[],
    cwe_ids           INT[],
    cpe_uri           TEXT,
    fingerprint       TEXT        NOT NULL UNIQUE,
    first_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen         TIMESTAMPTZ NOT NULL DEFAULT now(),
    times_seen        INT         NOT NULL DEFAULT 1,
    project_id        UUID        NOT NULL REFERENCES projects(id),
    source_type       TEXT        NOT NULL,
    search_vector     TSVECTOR    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(component, ''))
    ) STORED
);

-- BRIN on first_seen (efficient for append-mostly timestamp columns)
CREATE INDEX idx_findings_first_seen ON findings USING BRIN (first_seen);

-- GIN on cve_ids array for @> containment queries
CREATE INDEX idx_findings_cve_ids ON findings USING GIN (cve_ids);

-- GIN on search_vector for full-text search
CREATE INDEX idx_findings_search_vector ON findings USING GIN (search_vector);

-- Partial index: open findings with critical severity for fast dashboard queries
CREATE INDEX idx_findings_open_critical ON findings (severity, status)
    WHERE status = 0 AND severity = 4;

-- Frequently filtered columns
CREATE INDEX idx_findings_project_id ON findings (project_id);
CREATE INDEX idx_findings_severity   ON findings (severity);
CREATE INDEX idx_findings_status     ON findings (status);
CREATE INDEX idx_findings_fingerprint ON findings (fingerprint);

-- Finding enrichments
CREATE TABLE finding_enrichments (
    finding_id  UUID        NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    source      TEXT        NOT NULL,
    data        JSONB       NOT NULL,
    enriched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (finding_id, source)
);

-- Finding scores
CREATE TABLE finding_scores (
    finding_id      UUID        PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
    base_score      FLOAT8      NOT NULL DEFAULT 0,
    epss_score      FLOAT8      NOT NULL DEFAULT 0,
    epss_percentile FLOAT8      NOT NULL DEFAULT 0,
    is_kev          BOOLEAN     NOT NULL DEFAULT false,
    is_bdu          BOOLEAN     NOT NULL DEFAULT false,
    priority_score  FLOAT8      NOT NULL DEFAULT 0,
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finding_scores_priority ON finding_scores (priority_score DESC);
