DROP TABLE IF EXISTS finding_events;
DROP TABLE IF EXISTS finding_comments;

ALTER TABLE findings
    DROP CONSTRAINT IF EXISTS findings_status_check;

ALTER TABLE findings
    DROP COLUMN IF EXISTS assignee_id,
    DROP COLUMN IF EXISTS import_job_id;

ALTER TABLE findings
    ADD CONSTRAINT findings_status_check
    CHECK (status IN ('new', 'duplicate', 'resolved', 'ignored'));

ALTER TABLE scan_results
    DROP COLUMN IF EXISTS import_job_id;

DROP TABLE IF EXISTS import_jobs;

ALTER TABLE users
    DROP COLUMN IF EXISTS must_change_password;
