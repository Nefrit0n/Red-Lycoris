ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO roles (name)
VALUES ('analyst')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name)
VALUES ('user')
ON CONFLICT (name) DO NOTHING;

UPDATE users
SET must_change_password = TRUE
WHERE username = 'root'
  AND password_changed = FALSE;

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scanner TEXT NOT NULL,
    product_name TEXT,
    product_version TEXT,
    product_identifier TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    findings_total INT NOT NULL DEFAULT 0,
    findings_new INT NOT NULL DEFAULT 0,
    duplicates_total INT NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_jobs_checksum_success
    ON import_jobs (checksum)
    WHERE status = 'succeeded';

ALTER TABLE scan_results
    ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_results_import_job_id
    ON scan_results (import_job_id);

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL;

ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_status_check;

ALTER TABLE findings
    ADD CONSTRAINT findings_status_check
    CHECK (status IN (
        'new',
        'under_review',
        'confirmed',
        'false_positive',
        'out_of_scope',
        'risk_accepted',
        'mitigated',
        'duplicate'
    ));

CREATE INDEX IF NOT EXISTS idx_findings_assignee_id ON findings (assignee_id);
CREATE INDEX IF NOT EXISTS idx_findings_import_job_id ON findings (import_job_id);

CREATE TABLE IF NOT EXISTS finding_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finding_comments_finding_id
    ON finding_comments (finding_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finding_events_finding_id
    ON finding_events (finding_id, created_at DESC);
