CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policies_kind_check'
    ) THEN
        ALTER TABLE policies
            ADD CONSTRAINT policies_kind_check
            CHECK (kind IN ('gate', 'sla', 'auto_triage'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_tenant_name
    ON policies (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_policies_tenant_id
    ON policies (tenant_id);

CREATE TABLE IF NOT EXISTS policy_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    format TEXT NOT NULL,
    content TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    entrypoint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_rules_format_check'
    ) THEN
        ALTER TABLE policy_rules
            ADD CONSTRAINT policy_rules_format_check
            CHECK (format IN ('rego', 'yaml', 'json'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_rules_policy_version
    ON policy_rules (policy_id, version);

CREATE INDEX IF NOT EXISTS idx_policy_rules_policy_id
    ON policy_rules (policy_id);

CREATE TABLE IF NOT EXISTS policy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    policy_rule_id UUID REFERENCES policy_rules(id) ON DELETE SET NULL,
    scope TEXT NOT NULL,
    scope_id UUID,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_assignments_scope_check'
    ) THEN
        ALTER TABLE policy_assignments
            ADD CONSTRAINT policy_assignments_scope_check
            CHECK (scope IN ('global', 'product', 'import_job', 'scan_result'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_policy_assignments_scope
    ON policy_assignments (scope, scope_id, priority DESC);

CREATE INDEX IF NOT EXISTS idx_policy_assignments_policy_id
    ON policy_assignments (policy_id);

CREATE TABLE IF NOT EXISTS policy_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    policy_rule_id UUID REFERENCES policy_rules(id) ON DELETE SET NULL,
    subject_type TEXT NOT NULL,
    subject_id UUID NOT NULL,
    decision TEXT NOT NULL,
    violations JSONB,
    input_hash TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_results_decision_check'
    ) THEN
        ALTER TABLE policy_results
            ADD CONSTRAINT policy_results_decision_check
            CHECK (decision IN ('pass', 'fail', 'warn'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_policy_results_subject_latest
    ON policy_results (subject_type, subject_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_results_policy_latest
    ON policy_results (policy_id, evaluated_at DESC);
