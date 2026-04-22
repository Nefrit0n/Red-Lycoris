CREATE TABLE api_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    prefix              TEXT NOT NULL,
    token_hash          TEXT NOT NULL,
    scopes              TEXT[] NOT NULL DEFAULT '{}',
    created_by_user_id  UUID NOT NULL REFERENCES users(id),
    last_used_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_tokens_prefix ON api_tokens (prefix) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_tokens_project ON api_tokens (project_id);

CREATE TABLE scans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha           TEXT NOT NULL,
    branch               TEXT NOT NULL,
    scanner              TEXT NOT NULL,
    scanner_version      TEXT,
    ci_job_url           TEXT,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ,
    findings_imported    INT NOT NULL DEFAULT 0,
    findings_updated     INT NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'running',
    token_id             UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    asset_hint           TEXT,
    raw_report_size      INT
);
CREATE INDEX idx_scans_project_started ON scans (project_id, started_at DESC);
CREATE INDEX idx_scans_branch_commit ON scans (project_id, branch, commit_sha);

CREATE TABLE finding_scan_links (
    finding_id          UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    scan_id             UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    is_new              BOOLEAN NOT NULL,
    PRIMARY KEY (finding_id, scan_id)
);
CREATE INDEX idx_scan_links_scan ON finding_scan_links (scan_id);
