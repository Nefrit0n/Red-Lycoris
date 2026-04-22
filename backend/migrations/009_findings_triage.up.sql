ALTER TABLE findings
    ADD COLUMN closure_reason_id SMALLINT REFERENCES closure_reasons(id),
    ADD COLUMN closure_note TEXT,
    ADD COLUMN closed_at TIMESTAMPTZ,
    ADD COLUMN closed_by UUID REFERENCES users(id),
    ADD COLUMN assigned_to UUID REFERENCES users(id);

CREATE INDEX idx_findings_assigned_open ON findings (assigned_to) WHERE status = 0;
