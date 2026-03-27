-- Baseline migration: squashed from migrations 001-050.
-- Generated via pg_dump --schema-only from a fully migrated PostgreSQL 16 database.
-- Seed data (root user, admin role) is handled by cmd/migrate EnsureRootUserExists().
--
-- Original migrations archived in backend/migrations_archive/v1_001_050/


CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE FUNCTION public.enforce_integration_token_active_name_uniqueness() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.revoked_at IS NULL AND NEW.expires_at > NOW() THEN
        IF EXISTS (
            SELECT 1
            FROM integration_tokens it
            WHERE it.org_id = NEW.org_id
              AND it.project_id IS NOT DISTINCT FROM NEW.project_id
              AND it.name = NEW.name
              AND it.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND it.revoked_at IS NULL
              AND it.expires_at > NOW()
        ) THEN
            RAISE EXCEPTION
                USING ERRCODE = 'unique_violation',
                      MESSAGE = 'active token name already exists for tenant boundary';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TABLE public.analysis_job_scanners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    scanner text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    artifact_key text,
    import_job_id uuid,
    error_message text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    duration_ms integer,
    result_count integer,
    max_severity text,
    severity_counts jsonb
);

CREATE TABLE public.analysis_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    engagement_id uuid,
    status text DEFAULT 'queued'::text NOT NULL,
    scanners text[] NOT NULL,
    semgrep_status text DEFAULT 'pending'::text NOT NULL,
    trivy_status text DEFAULT 'pending'::text NOT NULL,
    findings_total integer DEFAULT 0 NOT NULL,
    findings_new integer DEFAULT 0 NOT NULL,
    duplicates_total integer DEFAULT 0 NOT NULL,
    archive_key text,
    archive_size bigint DEFAULT 0 NOT NULL,
    artifact_semgrep_key text,
    artifact_trivy_key text,
    semgrep_import_job_id uuid,
    trivy_import_job_id uuid,
    idempotency_key text,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    source_snapshot_id uuid,
    source_kind text NOT NULL
);

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_type text,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    scope text DEFAULT 'global'::text NOT NULL,
    scope_id uuid,
    payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_email_snapshot text,
    request_id text,
    idempotency_key text,
    ip text,
    user_agent text,
    diff_json jsonb,
    metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.bdu_identifier_map (
    identifier text NOT NULL,
    bdu_id text NOT NULL
);

CREATE TABLE public.bdu_sync_status (
    id integer DEFAULT 1 NOT NULL,
    last_synced_at timestamp with time zone,
    record_count integer DEFAULT 0 NOT NULL,
    sync_interval_hours integer DEFAULT 24 NOT NULL,
    last_error text,
    is_syncing boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bdu_sync_status_id_check CHECK ((id = 1))
);

CREATE TABLE public.bdu_vulnerabilities (
    bdu_id text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    vendor text DEFAULT ''::text NOT NULL,
    software_name text DEFAULT ''::text NOT NULL,
    software_version text DEFAULT ''::text NOT NULL,
    software_type text DEFAULT ''::text NOT NULL,
    os_hardware text DEFAULT ''::text NOT NULL,
    vuln_class text DEFAULT ''::text NOT NULL,
    detection_date text DEFAULT ''::text NOT NULL,
    cvss_v2 text DEFAULT ''::text NOT NULL,
    cvss_v3 text DEFAULT ''::text NOT NULL,
    cvss_v4 text DEFAULT ''::text NOT NULL,
    severity text DEFAULT ''::text NOT NULL,
    remediation text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    exploit_exists text DEFAULT ''::text NOT NULL,
    fix_info text DEFAULT ''::text NOT NULL,
    source_urls text DEFAULT ''::text NOT NULL,
    other_ids text DEFAULT ''::text NOT NULL,
    other_info text DEFAULT ''::text NOT NULL,
    incident_info text DEFAULT ''::text NOT NULL,
    exploitation_method text DEFAULT ''::text NOT NULL,
    fix_method text DEFAULT ''::text NOT NULL,
    published_date text DEFAULT ''::text NOT NULL,
    updated_date text DEFAULT ''::text NOT NULL,
    consequences text DEFAULT ''::text NOT NULL,
    vuln_state text DEFAULT ''::text NOT NULL,
    cwe_description text DEFAULT ''::text NOT NULL,
    cwe_id text DEFAULT ''::text NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purl text,
    name text NOT NULL,
    version text,
    ecosystem text,
    supplier text,
    licenses jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.engagements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT engagements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

CREATE TABLE public.finding_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    finding_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.finding_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    finding_id uuid NOT NULL,
    actor_id uuid,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.finding_risk (
    finding_id uuid NOT NULL,
    tenant_id uuid,
    model_version text NOT NULL,
    risk_score double precision NOT NULL,
    risk_band text NOT NULL,
    factors jsonb NOT NULL,
    computed_at timestamp with time zone NOT NULL,
    input_hash text NOT NULL,
    source text NOT NULL
);

CREATE TABLE public.finding_vuln_identifiers (
    finding_id uuid NOT NULL,
    identifier text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scan_result_id uuid,
    title text NOT NULL,
    description text,
    severity text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fingerprint text NOT NULL,
    duplicate_id uuid,
    product_id uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    assignee_id uuid,
    import_job_id uuid,
    first_seen_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    repeat_count integer DEFAULT 0 NOT NULL,
    evidence jsonb,
    raw_data jsonb,
    source_type text,
    source_version text,
    endpoint_method text,
    endpoint_path text,
    category text DEFAULT 'SAST'::text NOT NULL,
    tenant_id uuid NOT NULL,
    sla_due_at timestamp with time zone,
    sla_breached boolean DEFAULT false NOT NULL,
    sla_breached_at timestamp with time zone,
    sla_profile text,
    sla_source text,
    cwe text[],
    owasp text[],
    severity_rank smallint DEFAULT 0 NOT NULL,
    status_rank smallint DEFAULT 0 NOT NULL,
    CONSTRAINT findings_category_check_v3 CHECK ((category = ANY (ARRAY['SAST'::text, 'SCA'::text, 'SECRETS'::text, 'CONFIG'::text, 'DAST'::text, 'LICENSE'::text, 'UNKNOWN'::text, 'IAC'::text, 'CONTAINER'::text]))),
    CONSTRAINT findings_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT findings_status_check CHECK ((status = ANY (ARRAY['new'::text, 'under_review'::text, 'confirmed'::text, 'false_positive'::text, 'out_of_scope'::text, 'risk_accepted'::text, 'mitigated'::text, 'duplicate'::text])))
);

CREATE TABLE public.idempotency_keys (
    tenant_id uuid NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    request_hash text NOT NULL,
    response_code integer NOT NULL,
    response_body_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scanner text NOT NULL,
    product_name text,
    product_version text,
    product_identifier text,
    status text DEFAULT 'queued'::text NOT NULL,
    findings_total integer DEFAULT 0 NOT NULL,
    findings_new integer DEFAULT 0 NOT NULL,
    duplicates_total integer DEFAULT 0 NOT NULL,
    checksum text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by uuid,
    product_id uuid,
    source_type text,
    source_version text,
    tenant_id uuid NOT NULL,
    gate_failed boolean DEFAULT false NOT NULL
);

CREATE TABLE public.ingest_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    path text NOT NULL,
    sha256 text NOT NULL,
    size_bytes bigint NOT NULL,
    media_type text NOT NULL,
    format_hint text NOT NULL,
    object_key text NOT NULL,
    uploaded_at timestamp with time zone,
    verified_at timestamp with time zone,
    etag text,
    CONSTRAINT ingest_artifacts_sha256_chk CHECK ((sha256 ~ '^[A-Fa-f0-9]{64}$'::text)),
    CONSTRAINT ingest_artifacts_size_bytes_chk CHECK ((size_bytes > 0))
);

CREATE TABLE public.ingest_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    status text NOT NULL,
    x_idempotency_key text NOT NULL,
    metadata_jsonb jsonb NOT NULL,
    metadata_sha256 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    committed_at timestamp with time zone,
    pipeline_id text,
    job_id text,
    commit_sha text,
    ref_name text,
    pipeline_url text,
    job_url text,
    CONSTRAINT ingest_runs_commit_sha_chk CHECK (((commit_sha IS NULL) OR (commit_sha ~ '^[A-Fa-f0-9]{40}$'::text))),
    CONSTRAINT ingest_runs_idempotency_non_empty_chk CHECK ((length(btrim(x_idempotency_key)) > 0)),
    CONSTRAINT ingest_runs_metadata_sha256_chk CHECK ((metadata_sha256 ~ '^[A-Fa-f0-9]{64}$'::text)),
    CONSTRAINT ingest_runs_status_chk CHECK ((status = ANY (ARRAY['INIT'::text, 'UPLOADING'::text, 'COMMITTED'::text, 'FAILED'::text])))
);

CREATE TABLE public.integration_token_events (
    id bigint NOT NULL,
    org_id uuid NOT NULL,
    token_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    at timestamp with time zone DEFAULT now() NOT NULL,
    ip inet,
    user_agent text,
    details jsonb,
    CONSTRAINT integration_token_events_actor_chk CHECK ((actor_type = ANY (ARRAY['user'::text, 'token'::text, 'system'::text]))),
    CONSTRAINT integration_token_events_type_chk CHECK ((event_type = ANY (ARRAY['created'::text, 'revoked'::text, 'rotated'::text, 'used'::text, 'expiry_changed'::text, 'name_changed'::text])))
);

CREATE SEQUENCE public.integration_token_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.integration_token_events_id_seq OWNED BY public.integration_token_events.id;

CREATE TABLE public.integration_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    name text NOT NULL,
    token_hash text NOT NULL,
    scopes text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_by_user_id uuid,
    metadata jsonb,
    CONSTRAINT integration_tokens_expires_after_created_chk CHECK ((expires_at > created_at)),
    CONSTRAINT integration_tokens_name_non_empty_chk CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT integration_tokens_non_empty_scopes_chk CHECK ((cardinality(scopes) >= 1))
);

CREATE TABLE public.org_security_policies (
    org_id uuid NOT NULL,
    default_token_ttl_days integer DEFAULT 90 NOT NULL,
    max_token_ttl_days integer DEFAULT 365 NOT NULL,
    CONSTRAINT org_security_policies_default_lte_max_chk CHECK ((default_token_ttl_days <= max_token_ttl_days)),
    CONSTRAINT org_security_policies_default_ttl_chk CHECK (((default_token_ttl_days >= 1) AND (default_token_ttl_days <= 3650))),
    CONSTRAINT org_security_policies_max_ttl_chk CHECK (((max_token_ttl_days >= 1) AND (max_token_ttl_days <= 3650)))
);

CREATE TABLE public.policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    kind text NOT NULL,
    status text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policies_kind_check CHECK ((kind = ANY (ARRAY['gate'::text, 'sla'::text, 'auto_triage'::text])))
);

CREATE TABLE public.policy_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_id uuid NOT NULL,
    policy_rule_id uuid,
    scope text NOT NULL,
    scope_id uuid,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_assignments_scope_check CHECK ((scope = ANY (ARRAY['global'::text, 'product'::text, 'import_job'::text, 'scan_result'::text])))
);

CREATE TABLE public.policy_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_id uuid NOT NULL,
    policy_rule_id uuid,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    decision text NOT NULL,
    violations jsonb,
    input_hash text NOT NULL,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_results_decision_check CHECK ((decision = ANY (ARRAY['pass'::text, 'fail'::text, 'warn'::text])))
);

CREATE TABLE public.policy_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_id uuid NOT NULL,
    version text NOT NULL,
    format text NOT NULL,
    content text NOT NULL,
    sha256 text NOT NULL,
    entrypoint text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_rules_format_check CHECK ((format = ANY (ARRAY['rego'::text, 'yaml'::text, 'json'::text])))
);

CREATE TABLE public.product_asset_context (
    product_id uuid NOT NULL,
    tenant_id uuid,
    environment text DEFAULT 'unknown'::text NOT NULL,
    internet_exposed boolean DEFAULT false NOT NULL,
    data_classification text DEFAULT 'unknown'::text NOT NULL,
    business_impact text,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_asset_context_business_impact_check CHECK (((business_impact IS NULL) OR (business_impact = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))),
    CONSTRAINT product_asset_context_data_classification_check CHECK ((data_classification = ANY (ARRAY['public'::text, 'internal'::text, 'confidential'::text, 'restricted'::text, 'unknown'::text]))),
    CONSTRAINT product_asset_context_environment_check CHECK ((environment = ANY (ARRAY['prod'::text, 'staging'::text, 'dev'::text, 'unknown'::text])))
);

CREATE TABLE public.product_source_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    object_key text NOT NULL,
    archive_size bigint NOT NULL,
    sha256 text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    idempotency_key text,
    original_filename text,
    label text,
    notes text
);

CREATE TABLE public.product_team_roles (
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    team_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_team_roles_role_check CHECK ((role = ANY (ARRAY['maintainer'::text, 'engineer'::text, 'viewer'::text])))
);

CREATE TABLE public.product_user_roles (
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_user_roles_role_check CHECK ((role = ANY (ARRAY['maintainer'::text, 'engineer'::text, 'viewer'::text])))
);

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    identifier text,
    version text,
    asset_criticality text,
    tenant_id uuid NOT NULL,
    CONSTRAINT products_asset_criticality_check CHECK (((asset_criticality IS NULL) OR (asset_criticality = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))))
);

CREATE TABLE public.risk_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    version text NOT NULL,
    name text NOT NULL,
    weights jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT false NOT NULL
);

CREATE TABLE public.risk_recompute_cursors (
    tenant_id uuid NOT NULL,
    source text NOT NULL,
    last_processed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.risk_rescore_jobs (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    model_version text NOT NULL,
    status text NOT NULL,
    cursor_last_finding_id uuid,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);

CREATE TABLE public.sbom_component_occurrences (
    sbom_id uuid NOT NULL,
    component_id uuid NOT NULL,
    version text,
    direct boolean DEFAULT false NOT NULL,
    bom_ref text,
    supplier text,
    licenses jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sbom_component_vulns (
    sbom_id uuid NOT NULL,
    component_id uuid NOT NULL,
    identifier text NOT NULL,
    severity text NOT NULL,
    cvss_score double precision,
    epss_score double precision,
    fixed_version text,
    source text DEFAULT 'osv'::text NOT NULL
);

CREATE TABLE public.sbom_components (
    sbom_id uuid NOT NULL,
    component_id uuid NOT NULL,
    bom_ref text,
    direct boolean DEFAULT false NOT NULL,
    properties jsonb
);

CREATE TABLE public.sbom_edges (
    sbom_id uuid NOT NULL,
    from_component_id uuid NOT NULL,
    to_component_id uuid NOT NULL
);

CREATE TABLE public.sbom_transitive_exposure (
    sbom_id uuid NOT NULL,
    root_component_id uuid NOT NULL,
    max_depth integer NOT NULL,
    critical_cnt integer DEFAULT 0 NOT NULL,
    high_cnt integer DEFAULT 0 NOT NULL,
    medium_cnt integer DEFAULT 0 NOT NULL,
    low_cnt integer DEFAULT 0 NOT NULL,
    max_cvss double precision,
    max_epss double precision,
    min_distance_to_any_vuln integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sboms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    format text NOT NULL,
    object_key text NOT NULL,
    sha256 text NOT NULL,
    original_filename text NOT NULL,
    size_bytes bigint NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    indexed_at timestamp with time zone,
    index_status text DEFAULT 'queued'::text NOT NULL,
    index_error text,
    component_count integer DEFAULT 0 NOT NULL,
    edge_count integer DEFAULT 0 NOT NULL,
    transitive_status text DEFAULT 'pending'::text NOT NULL,
    transitive_updated_at timestamp with time zone,
    transitive_error text,
    CONSTRAINT sboms_format_check CHECK ((format = ANY (ARRAY['cyclonedx'::text, 'spdx'::text, 'spdx-json'::text])))
);

CREATE TABLE public.sca_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purl text,
    ecosystem text DEFAULT 'unknown'::text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sca_findings (
    finding_id uuid NOT NULL,
    component_id uuid NOT NULL,
    installed_version text NOT NULL,
    fixed_version text,
    vulnerability_id text NOT NULL,
    primary_url text,
    raw_severity text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.scan_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engagement_id uuid,
    scanner text NOT NULL,
    raw_report jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    product_id uuid,
    uploader_id uuid,
    import_job_id uuid,
    source_type text,
    source_version text,
    tenant_id uuid NOT NULL,
    gate_failed boolean DEFAULT false NOT NULL
);

CREATE TABLE public.sla_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid,
    enabled boolean DEFAULT true NOT NULL,
    critical_days integer NOT NULL,
    high_days integer NOT NULL,
    medium_days integer NOT NULL,
    low_days integer NOT NULL,
    due_soon_days integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_user_id uuid,
    CONSTRAINT sla_settings_days_range CHECK ((((critical_days >= 1) AND (critical_days <= 3650)) AND ((high_days >= 1) AND (high_days <= 3650)) AND ((medium_days >= 1) AND (medium_days <= 3650)) AND ((low_days >= 1) AND (low_days <= 3650)) AND ((due_soon_days >= 1) AND (due_soon_days <= 3650))))
);

CREATE TABLE public.team_members (
    tenant_id uuid NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    org_role text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT user_invitations_org_role_check CHECK ((org_role = ANY (ARRAY['owner'::text, 'admin'::text, 'security_manager'::text, 'viewer'::text]))),
    CONSTRAINT user_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text])))
);

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    hashed_password text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    password_changed boolean DEFAULT false NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    full_name text,
    org_role text DEFAULT 'viewer'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_login_at timestamp with time zone,
    deactivated_at timestamp with time zone,
    CONSTRAINT users_org_role_check CHECK ((org_role = ANY (ARRAY['owner'::text, 'admin'::text, 'security_manager'::text, 'viewer'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'deactivated'::text, 'invited'::text])))
);

CREATE TABLE public.vuln_intel (
    identifier text NOT NULL,
    source_version text DEFAULT 'v1'::text NOT NULL,
    nvd_payload jsonb,
    epss_payload jsonb,
    kev_payload jsonb,
    references_payload jsonb,
    cvss_score numeric,
    cvss_version text,
    epss_score numeric,
    epss_percentile numeric,
    kev boolean DEFAULT false NOT NULL,
    last_refreshed_at timestamp with time zone,
    next_retry_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fail_count integer DEFAULT 0 NOT NULL,
    bdu_payload jsonb
);

ALTER TABLE ONLY public.integration_token_events ALTER COLUMN id SET DEFAULT nextval('public.integration_token_events_id_seq'::regclass);

ALTER TABLE ONLY public.analysis_job_scanners
    ADD CONSTRAINT analysis_job_scanners_job_id_scanner_key UNIQUE (job_id, scanner);

ALTER TABLE ONLY public.analysis_job_scanners
    ADD CONSTRAINT analysis_job_scanners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bdu_identifier_map
    ADD CONSTRAINT bdu_identifier_map_pkey PRIMARY KEY (identifier, bdu_id);

ALTER TABLE ONLY public.bdu_sync_status
    ADD CONSTRAINT bdu_sync_status_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bdu_vulnerabilities
    ADD CONSTRAINT bdu_vulnerabilities_pkey PRIMARY KEY (bdu_id);

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_purl_key UNIQUE (purl);

ALTER TABLE ONLY public.engagements
    ADD CONSTRAINT engagements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finding_comments
    ADD CONSTRAINT finding_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finding_events
    ADD CONSTRAINT finding_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finding_risk
    ADD CONSTRAINT finding_risk_pkey PRIMARY KEY (finding_id);

ALTER TABLE ONLY public.finding_vuln_identifiers
    ADD CONSTRAINT finding_vuln_identifiers_pkey PRIMARY KEY (finding_id, identifier);

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (tenant_id, scope, key);

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ingest_artifacts
    ADD CONSTRAINT ingest_artifacts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ingest_runs
    ADD CONSTRAINT ingest_runs_pkey PRIMARY KEY (run_id);

ALTER TABLE ONLY public.integration_token_events
    ADD CONSTRAINT integration_token_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integration_tokens
    ADD CONSTRAINT integration_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.org_security_policies
    ADD CONSTRAINT org_security_policies_pkey PRIMARY KEY (org_id);

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.policy_results
    ADD CONSTRAINT policy_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_asset_context
    ADD CONSTRAINT product_asset_context_tenant_id_product_id_key UNIQUE (tenant_id, product_id);

ALTER TABLE ONLY public.product_source_snapshots
    ADD CONSTRAINT product_source_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_team_roles
    ADD CONSTRAINT product_team_roles_pkey PRIMARY KEY (product_id, team_id);

ALTER TABLE ONLY public.product_user_roles
    ADD CONSTRAINT product_user_roles_pkey PRIMARY KEY (product_id, user_id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.risk_models
    ADD CONSTRAINT risk_models_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risk_recompute_cursors
    ADD CONSTRAINT risk_recompute_cursors_pkey PRIMARY KEY (tenant_id, source);

ALTER TABLE ONLY public.risk_rescore_jobs
    ADD CONSTRAINT risk_rescore_jobs_pkey PRIMARY KEY (job_id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sbom_component_occurrences
    ADD CONSTRAINT sbom_component_occurrences_sbom_id_component_id_version_key UNIQUE (sbom_id, component_id, version);

ALTER TABLE ONLY public.sbom_component_vulns
    ADD CONSTRAINT sbom_component_vulns_sbom_id_component_id_identifier_key UNIQUE (sbom_id, component_id, identifier);

ALTER TABLE ONLY public.sbom_components
    ADD CONSTRAINT sbom_components_pkey PRIMARY KEY (sbom_id, component_id);

ALTER TABLE ONLY public.sbom_edges
    ADD CONSTRAINT sbom_edges_pkey PRIMARY KEY (sbom_id, from_component_id, to_component_id);

ALTER TABLE ONLY public.sbom_transitive_exposure
    ADD CONSTRAINT sbom_transitive_exposure_pkey PRIMARY KEY (sbom_id, root_component_id, max_depth);

ALTER TABLE ONLY public.sboms
    ADD CONSTRAINT sboms_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sca_components
    ADD CONSTRAINT sca_components_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sca_findings
    ADD CONSTRAINT sca_findings_pkey PRIMARY KEY (finding_id);

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sla_settings
    ADD CONSTRAINT sla_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_tenant_name_unique UNIQUE (tenant_id, name);

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_tenant_id_email_status_key UNIQUE (tenant_id, email, status);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE ONLY public.vuln_intel
    ADD CONSTRAINT vuln_intel_pkey PRIMARY KEY (identifier, source_version);

CREATE INDEX idx_analysis_job_scanners_job_id ON public.analysis_job_scanners USING btree (job_id);

CREATE INDEX idx_analysis_job_scanners_status ON public.analysis_job_scanners USING btree (status);

CREATE INDEX idx_analysis_jobs_created_at ON public.analysis_jobs USING btree (created_at DESC);

CREATE UNIQUE INDEX idx_analysis_jobs_idempotency_key ON public.analysis_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX idx_analysis_jobs_product_id ON public.analysis_jobs USING btree (product_id);

CREATE INDEX idx_analysis_jobs_source_snapshot_id ON public.analysis_jobs USING btree (source_snapshot_id);

CREATE INDEX idx_analysis_jobs_status ON public.analysis_jobs USING btree (status);

CREATE INDEX idx_analysis_jobs_tenant_id ON public.analysis_jobs USING btree (tenant_id);

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);

CREATE INDEX idx_audit_log_actor_id ON public.audit_log USING btree (actor_id);

CREATE INDEX idx_audit_log_occurred_at ON public.audit_log USING btree (occurred_at DESC);

CREATE INDEX idx_audit_log_scope_id ON public.audit_log USING btree (scope_id);

CREATE INDEX idx_audit_log_target_type ON public.audit_log USING btree (target_type);

CREATE INDEX idx_audit_log_tenant_action_created_at ON public.audit_log USING btree (tenant_id, action, created_at DESC);

CREATE INDEX idx_audit_log_tenant_actor_created_at ON public.audit_log USING btree (tenant_id, actor_id, created_at DESC);

CREATE INDEX idx_audit_log_tenant_created_at ON public.audit_log USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_audit_log_tenant_target_created_at ON public.audit_log USING btree (tenant_id, target_type, target_id, created_at DESC);

CREATE INDEX idx_bdu_identifier_map_ident ON public.bdu_identifier_map USING btree (identifier);

CREATE INDEX idx_components_ecosystem_name_version ON public.components USING btree (ecosystem, name, version);

CREATE INDEX idx_components_purl ON public.components USING btree (purl);

CREATE INDEX idx_engagements_product_created_at ON public.engagements USING btree (product_id, created_at DESC);

CREATE INDEX idx_finding_comments_finding_id ON public.finding_comments USING btree (finding_id, created_at DESC);

CREATE INDEX idx_finding_events_finding_id ON public.finding_events USING btree (finding_id, created_at DESC);

CREATE INDEX idx_finding_risk_finding_id ON public.finding_risk USING btree (finding_id);

CREATE INDEX idx_finding_risk_tenant_computed ON public.finding_risk USING btree (tenant_id, computed_at DESC);

CREATE INDEX idx_finding_risk_tenant_score ON public.finding_risk USING btree (tenant_id, risk_score DESC);

CREATE INDEX idx_finding_risk_tenant_score_asc ON public.finding_risk USING btree (tenant_id, risk_score, finding_id);

CREATE INDEX idx_finding_risk_tenant_score_desc ON public.finding_risk USING btree (tenant_id, risk_score DESC, finding_id);

CREATE INDEX idx_finding_vuln_identifiers_identifier ON public.finding_vuln_identifiers USING btree (identifier);

CREATE INDEX idx_findings_active ON public.findings USING btree (id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_findings_assignee_id ON public.findings USING btree (assignee_id);

CREATE INDEX idx_findings_cursor_created_at_desc ON public.findings USING btree (tenant_id, product_id, created_at DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_last_seen_desc ON public.findings USING btree (tenant_id, product_id, COALESCE(last_seen_at, created_at) DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_severity_desc ON public.findings USING btree (tenant_id, product_id, severity_rank DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_sla_due_asc ON public.findings USING btree (tenant_id, product_id, COALESCE(sla_due_at, '9999-12-31 23:59:59+00'::timestamp with time zone), id) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_sla_due_desc ON public.findings USING btree (tenant_id, product_id, COALESCE(sla_due_at, '0001-01-01 00:00:00+00'::timestamp with time zone) DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_sort_key ON public.findings USING btree (tenant_id, product_id, COALESCE(last_seen_at, created_at) DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_status_desc ON public.findings USING btree (tenant_id, product_id, status_rank DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_cursor_title_desc ON public.findings USING btree (tenant_id, product_id, title DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_deleted_at ON public.findings USING btree (deleted_at);

CREATE INDEX idx_findings_fingerprint ON public.findings USING btree (fingerprint);

CREATE INDEX idx_findings_fingerprint_trgm ON public.findings USING gin (fingerprint public.gin_trgm_ops);

CREATE INDEX idx_findings_import_job_id ON public.findings USING btree (import_job_id);

CREATE INDEX idx_findings_last_activity ON public.findings USING btree (COALESCE(last_seen_at, created_at) DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_findings_last_seen_at ON public.findings USING btree (last_seen_at DESC);

CREATE INDEX idx_findings_list_created_desc ON public.findings USING btree (tenant_id, created_at DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_last_seen_desc ON public.findings USING btree (tenant_id, COALESCE(last_seen_at, created_at) DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_severity_desc ON public.findings USING btree (tenant_id, severity_rank DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_sla_due_asc ON public.findings USING btree (tenant_id, COALESCE(sla_due_at, '9999-12-31 23:59:59+00'::timestamp with time zone), id) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_sla_due_desc ON public.findings USING btree (tenant_id, COALESCE(sla_due_at, '0001-01-01 00:00:00+00'::timestamp with time zone) DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_status_desc ON public.findings USING btree (tenant_id, status_rank DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_title_asc ON public.findings USING btree (tenant_id, title, id) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE INDEX idx_findings_list_updated_desc ON public.findings USING btree (tenant_id, updated_at DESC, id DESC) WHERE ((deleted_at IS NULL) AND (duplicate_id IS NULL));

CREATE UNIQUE INDEX idx_findings_master_fingerprint_product ON public.findings USING btree (tenant_id, fingerprint, product_id) WHERE ((duplicate_id IS NULL) AND (deleted_at IS NULL));

CREATE INDEX idx_findings_product_id ON public.findings USING btree (product_id);

CREATE INDEX idx_findings_product_status_severity ON public.findings USING btree (product_id, status, severity) WHERE (deleted_at IS NULL);

CREATE INDEX idx_findings_scan_result_id ON public.findings USING btree (scan_result_id);

CREATE INDEX idx_findings_scan_result_severity ON public.findings USING btree (scan_result_id, severity);

CREATE INDEX idx_findings_severity ON public.findings USING btree (severity);

CREATE INDEX idx_findings_sla_due_at ON public.findings USING btree (sla_due_at) WHERE ((sla_due_at IS NOT NULL) AND (sla_breached = false));

CREATE INDEX idx_findings_source_type ON public.findings USING btree (source_type);

CREATE INDEX idx_findings_status ON public.findings USING btree (status);

CREATE INDEX idx_findings_tenant_id ON public.findings USING btree (tenant_id);

CREATE INDEX idx_findings_tenant_severity_status ON public.findings USING btree (tenant_id, severity, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_findings_title_trgm ON public.findings USING gin (title public.gin_trgm_ops);

CREATE INDEX idx_idempotency_keys_tenant_created_at ON public.idempotency_keys USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_import_jobs_created_at ON public.import_jobs USING btree (created_at DESC);

CREATE INDEX idx_import_jobs_product_created_at ON public.import_jobs USING btree (product_id, created_at DESC);

CREATE INDEX idx_import_jobs_tenant_id ON public.import_jobs USING btree (tenant_id);

CREATE INDEX idx_ingest_artifacts_org_project_run ON public.ingest_artifacts USING btree (org_id, project_id, run_id);

CREATE INDEX idx_ingest_artifacts_org_project_sha256 ON public.ingest_artifacts USING btree (org_id, project_id, sha256);

CREATE INDEX idx_ingest_runs_org_project_commit_sha ON public.ingest_runs USING btree (org_id, project_id, commit_sha);

CREATE INDEX idx_ingest_runs_org_project_created_at_desc ON public.ingest_runs USING btree (org_id, project_id, created_at DESC);

CREATE INDEX idx_ingest_runs_org_project_pipeline_id ON public.ingest_runs USING btree (org_id, project_id, pipeline_id);

CREATE INDEX idx_integration_token_events_org_at_desc ON public.integration_token_events USING btree (org_id, at DESC);

CREATE INDEX idx_integration_token_events_org_token_at_desc ON public.integration_token_events USING btree (org_id, token_id, at DESC);

CREATE INDEX idx_integration_token_events_type_at_desc ON public.integration_token_events USING btree (event_type, at DESC);

CREATE INDEX idx_integration_tokens_org_project_created_at_desc ON public.integration_tokens USING btree (org_id, project_id, created_at DESC);

CREATE INDEX idx_integration_tokens_org_project_expires_at ON public.integration_tokens USING btree (org_id, project_id, expires_at);

CREATE INDEX idx_integration_tokens_org_project_last_used_at_desc ON public.integration_tokens USING btree (org_id, project_id, last_used_at DESC);

CREATE INDEX idx_policies_tenant_id ON public.policies USING btree (tenant_id);

CREATE UNIQUE INDEX idx_policies_tenant_name ON public.policies USING btree (tenant_id, name);

CREATE INDEX idx_policy_assignments_policy_id ON public.policy_assignments USING btree (policy_id);

CREATE INDEX idx_policy_assignments_scope ON public.policy_assignments USING btree (scope, scope_id, priority DESC);

CREATE INDEX idx_policy_results_policy_latest ON public.policy_results USING btree (policy_id, evaluated_at DESC);

CREATE INDEX idx_policy_results_subject_evaluated ON public.policy_results USING btree (subject_type, subject_id, evaluated_at DESC);

CREATE INDEX idx_policy_results_subject_latest ON public.policy_results USING btree (subject_type, subject_id, evaluated_at DESC);

CREATE INDEX idx_policy_rules_policy_id ON public.policy_rules USING btree (policy_id);

CREATE UNIQUE INDEX idx_policy_rules_policy_version ON public.policy_rules USING btree (policy_id, version);

CREATE INDEX idx_product_asset_context_tenant_business_impact ON public.product_asset_context USING btree (tenant_id, business_impact);

CREATE INDEX idx_product_asset_context_tenant_exposed ON public.product_asset_context USING btree (tenant_id, internet_exposed);

CREATE INDEX idx_product_asset_context_tenant_product ON public.product_asset_context USING btree (tenant_id, product_id);

CREATE UNIQUE INDEX idx_product_source_snapshots_idempotency_key ON public.product_source_snapshots USING btree (tenant_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX idx_product_source_snapshots_product_created ON public.product_source_snapshots USING btree (product_id, created_at DESC);

CREATE INDEX idx_product_source_snapshots_tenant_product_created ON public.product_source_snapshots USING btree (tenant_id, product_id, created_at DESC);

CREATE INDEX idx_product_team_roles_tenant_product ON public.product_team_roles USING btree (tenant_id, product_id);

CREATE INDEX idx_product_team_roles_tenant_team ON public.product_team_roles USING btree (tenant_id, team_id);

CREATE INDEX idx_product_user_roles_tenant_product ON public.product_user_roles USING btree (tenant_id, product_id);

CREATE INDEX idx_product_user_roles_tenant_user ON public.product_user_roles USING btree (tenant_id, user_id);

CREATE INDEX idx_products_identifier_trgm ON public.products USING gin (identifier public.gin_trgm_ops) WHERE (identifier IS NOT NULL);

CREATE UNIQUE INDEX idx_products_identifier_unique ON public.products USING btree (tenant_id, identifier) WHERE (identifier IS NOT NULL);

CREATE INDEX idx_products_name_trgm ON public.products USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_products_name_version ON public.products USING btree (name, version);

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);

CREATE UNIQUE INDEX idx_risk_models_active_tenant ON public.risk_models USING btree (tenant_id) WHERE is_active;

CREATE UNIQUE INDEX idx_risk_models_tenant_version ON public.risk_models USING btree (tenant_id, version);

CREATE INDEX idx_risk_recompute_cursors_source ON public.risk_recompute_cursors USING btree (source, last_processed_at);

CREATE INDEX idx_risk_rescore_jobs_status ON public.risk_rescore_jobs USING btree (status);

CREATE INDEX idx_risk_rescore_jobs_tenant_model ON public.risk_rescore_jobs USING btree (tenant_id, model_version);

CREATE INDEX idx_sbom_component_occurrences_component ON public.sbom_component_occurrences USING btree (component_id);

CREATE INDEX idx_sbom_component_occurrences_sbom_direct ON public.sbom_component_occurrences USING btree (sbom_id, direct);

CREATE INDEX idx_sbom_component_vulns_component ON public.sbom_component_vulns USING btree (sbom_id, component_id);

CREATE INDEX idx_sbom_component_vulns_identifier ON public.sbom_component_vulns USING btree (sbom_id, identifier);

CREATE INDEX idx_sbom_components_component ON public.sbom_components USING btree (component_id);

CREATE INDEX idx_sbom_components_sbom_direct ON public.sbom_components USING btree (sbom_id, direct);

CREATE INDEX idx_sbom_edges_from ON public.sbom_edges USING btree (sbom_id, from_component_id);

CREATE INDEX idx_sbom_edges_to ON public.sbom_edges USING btree (sbom_id, to_component_id);

CREATE INDEX idx_sbom_transitive_exposure_sbom_depth ON public.sbom_transitive_exposure USING btree (sbom_id, max_depth);

CREATE INDEX idx_sboms_product_created_at ON public.sboms USING btree (product_id, created_at DESC);

CREATE INDEX idx_sca_components_name ON public.sca_components USING btree (name);

CREATE UNIQUE INDEX idx_sca_components_unique_name_ecosystem ON public.sca_components USING btree (ecosystem, name) WHERE (purl IS NULL);

CREATE UNIQUE INDEX idx_sca_components_unique_purl ON public.sca_components USING btree (purl) WHERE (purl IS NOT NULL);

CREATE INDEX idx_sca_findings_component_id ON public.sca_findings USING btree (component_id);

CREATE INDEX idx_sca_findings_vulnerability_id ON public.sca_findings USING btree (vulnerability_id);

CREATE INDEX idx_scan_results_engagement_created_at ON public.scan_results USING btree (engagement_id, created_at DESC);

CREATE INDEX idx_scan_results_import_job_id ON public.scan_results USING btree (import_job_id);

CREATE INDEX idx_scan_results_product_id ON public.scan_results USING btree (product_id);

CREATE INDEX idx_scan_results_scanner ON public.scan_results USING btree (scanner);

CREATE INDEX idx_scan_results_tenant_id ON public.scan_results USING btree (tenant_id);

CREATE INDEX idx_scan_results_uploader_id ON public.scan_results USING btree (uploader_id);

CREATE INDEX idx_team_members_tenant_team ON public.team_members USING btree (tenant_id, team_id);

CREATE INDEX idx_team_members_tenant_user ON public.team_members USING btree (tenant_id, user_id);

CREATE INDEX idx_teams_tenant_created_at ON public.teams USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_user_invitations_tenant_created ON public.user_invitations USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_user_invitations_tenant_email ON public.user_invitations USING btree (tenant_id, email);

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);

CREATE INDEX idx_users_tenant_org_role_created ON public.users USING btree (tenant_id, org_role, created_at DESC);

CREATE INDEX idx_users_tenant_status_created ON public.users USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_vuln_intel_identifier ON public.vuln_intel USING btree (identifier);

CREATE INDEX idx_vuln_intel_next_retry ON public.vuln_intel USING btree (next_retry_at) WHERE (next_retry_at IS NOT NULL);

CREATE INDEX ix_sla_settings_tenant_id ON public.sla_settings USING btree (tenant_id);

CREATE UNIQUE INDEX ux_ingest_artifacts_run_sha256_path ON public.ingest_artifacts USING btree (run_id, sha256, path);

CREATE UNIQUE INDEX ux_ingest_runs_org_project_idempotency ON public.ingest_runs USING btree (org_id, project_id, x_idempotency_key);

CREATE UNIQUE INDEX ux_integration_tokens_org_project_name_unrevoked ON public.integration_tokens USING btree (org_id, project_id, name) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX ux_sla_settings_tenant_org_default ON public.sla_settings USING btree (tenant_id) WHERE (product_id IS NULL);

CREATE UNIQUE INDEX ux_sla_settings_tenant_product ON public.sla_settings USING btree (tenant_id, product_id) WHERE (product_id IS NOT NULL);

CREATE TRIGGER trg_integration_tokens_active_name_uniqueness BEFORE INSERT OR UPDATE OF org_id, project_id, name, expires_at, revoked_at ON public.integration_tokens FOR EACH ROW EXECUTE FUNCTION public.enforce_integration_token_active_name_uniqueness();

ALTER TABLE ONLY public.analysis_job_scanners
    ADD CONSTRAINT analysis_job_scanners_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_job_scanners
    ADD CONSTRAINT analysis_job_scanners_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.analysis_jobs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_engagement_id_fkey FOREIGN KEY (engagement_id) REFERENCES public.engagements(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_semgrep_import_job_id_fkey FOREIGN KEY (semgrep_import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_source_snapshot_id_fkey FOREIGN KEY (source_snapshot_id) REFERENCES public.product_source_snapshots(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.analysis_jobs
    ADD CONSTRAINT analysis_jobs_trivy_import_job_id_fkey FOREIGN KEY (trivy_import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.bdu_identifier_map
    ADD CONSTRAINT bdu_identifier_map_bdu_id_fkey FOREIGN KEY (bdu_id) REFERENCES public.bdu_vulnerabilities(bdu_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.engagements
    ADD CONSTRAINT engagements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finding_comments
    ADD CONSTRAINT finding_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.finding_comments
    ADD CONSTRAINT finding_comments_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finding_events
    ADD CONSTRAINT finding_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.finding_events
    ADD CONSTRAINT finding_events_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finding_risk
    ADD CONSTRAINT finding_risk_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finding_vuln_identifiers
    ADD CONSTRAINT finding_vuln_identifiers_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_duplicate_id_fkey FOREIGN KEY (duplicate_id) REFERENCES public.findings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT findings_scan_result_id_fkey FOREIGN KEY (scan_result_id) REFERENCES public.scan_results(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ingest_artifacts
    ADD CONSTRAINT ingest_artifacts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ingest_runs(run_id);

ALTER TABLE ONLY public.integration_token_events
    ADD CONSTRAINT integration_token_events_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.integration_tokens(id);

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.policy_assignments
    ADD CONSTRAINT policy_assignments_policy_rule_id_fkey FOREIGN KEY (policy_rule_id) REFERENCES public.policy_rules(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.policy_results
    ADD CONSTRAINT policy_results_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.policy_results
    ADD CONSTRAINT policy_results_policy_rule_id_fkey FOREIGN KEY (policy_rule_id) REFERENCES public.policy_rules(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.policy_rules
    ADD CONSTRAINT policy_rules_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES public.policies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_asset_context
    ADD CONSTRAINT product_asset_context_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_source_snapshots
    ADD CONSTRAINT product_source_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.product_source_snapshots
    ADD CONSTRAINT product_source_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_team_roles
    ADD CONSTRAINT product_team_roles_tenant_product_fk FOREIGN KEY (tenant_id, product_id) REFERENCES public.products(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_team_roles
    ADD CONSTRAINT product_team_roles_tenant_team_fk FOREIGN KEY (tenant_id, team_id) REFERENCES public.teams(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_user_roles
    ADD CONSTRAINT product_user_roles_tenant_product_fk FOREIGN KEY (tenant_id, product_id) REFERENCES public.products(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_user_roles
    ADD CONSTRAINT product_user_roles_tenant_user_fk FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_component_occurrences
    ADD CONSTRAINT sbom_component_occurrences_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.sca_components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_component_occurrences
    ADD CONSTRAINT sbom_component_occurrences_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.sboms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_component_vulns
    ADD CONSTRAINT sbom_component_vulns_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.sca_components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_component_vulns
    ADD CONSTRAINT sbom_component_vulns_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.sboms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_components
    ADD CONSTRAINT sbom_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_components
    ADD CONSTRAINT sbom_components_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.sboms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_edges
    ADD CONSTRAINT sbom_edges_from_component_id_fkey FOREIGN KEY (from_component_id) REFERENCES public.sca_components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_edges
    ADD CONSTRAINT sbom_edges_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.sboms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_edges
    ADD CONSTRAINT sbom_edges_to_component_id_fkey FOREIGN KEY (to_component_id) REFERENCES public.sca_components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_transitive_exposure
    ADD CONSTRAINT sbom_transitive_exposure_root_component_id_fkey FOREIGN KEY (root_component_id) REFERENCES public.sca_components(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sbom_transitive_exposure
    ADD CONSTRAINT sbom_transitive_exposure_sbom_id_fkey FOREIGN KEY (sbom_id) REFERENCES public.sboms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sboms
    ADD CONSTRAINT sboms_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sca_findings
    ADD CONSTRAINT sca_findings_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.sca_components(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.sca_findings
    ADD CONSTRAINT sca_findings_finding_id_fkey FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_engagement_id_fkey FOREIGN KEY (engagement_id) REFERENCES public.engagements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_import_job_id_fkey FOREIGN KEY (import_job_id) REFERENCES public.import_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.sla_settings
    ADD CONSTRAINT sla_settings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sla_settings
    ADD CONSTRAINT sla_settings_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_tenant_team_fk FOREIGN KEY (tenant_id, team_id) REFERENCES public.teams(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_tenant_user_fk FOREIGN KEY (tenant_id, user_id) REFERENCES public.users(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
