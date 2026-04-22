ALTER TABLE findings
    ADD COLUMN finding_kind SMALLINT NOT NULL DEFAULT 5,
    ADD COLUMN fixed_version TEXT,
    ADD COLUMN package_ecosystem TEXT,
    ADD COLUMN purl TEXT,
    ADD COLUMN code_snippet TEXT,
    ADD COLUMN code_flow JSONB,
    ADD COLUMN url TEXT,
    ADD COLUMN http_method TEXT,
    ADD COLUMN http_param TEXT,
    ADD COLUMN http_evidence JSONB,
    ADD COLUMN iac_resource TEXT,
    ADD COLUMN iac_provider TEXT,
    ADD COLUMN secret_kind TEXT,
    ADD COLUMN commit_sha TEXT,
    ADD COLUMN rule_id TEXT,
    ADD COLUMN rule_name TEXT;

CREATE INDEX idx_findings_kind ON findings (finding_kind);

CREATE INDEX idx_findings_ecosystem ON findings (package_ecosystem)
    WHERE package_ecosystem IS NOT NULL;

CREATE INDEX idx_findings_iac_provider ON findings (iac_provider)
    WHERE iac_provider IS NOT NULL;

CREATE INDEX idx_findings_secret_kind ON findings (secret_kind)
    WHERE secret_kind IS NOT NULL;

CREATE INDEX idx_findings_has_fix ON findings (finding_kind)
    WHERE fixed_version IS NOT NULL;
