-- NVD CVE database
CREATE TABLE nvd_cves (
    cve_id          TEXT        PRIMARY KEY,
    description     TEXT,
    cvss_v31_score  REAL,
    cvss_v31_vector TEXT,
    cvss_v40_score  REAL,
    cvss_v40_vector TEXT,
    cwe_ids         INT[],
    cpe_matches     JSONB,
    "references"    JSONB,
    published_at    TIMESTAMPTZ,
    modified_at     TIMESTAMPTZ,
    raw_data        JSONB,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nvd_cves_modified_at ON nvd_cves (modified_at);
CREATE INDEX idx_nvd_cves_cwe_ids     ON nvd_cves USING GIN (cwe_ids);

-- EPSS scores
CREATE TABLE epss_scores (
    cve_id     TEXT PRIMARY KEY,
    epss_score REAL        NOT NULL,
    percentile REAL        NOT NULL,
    score_date DATE        NOT NULL,
    synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CISA KEV catalog
CREATE TABLE kev_catalog (
    cve_id           TEXT    PRIMARY KEY,
    vendor           TEXT,
    product          TEXT,
    vulnerability_name TEXT,
    date_added       DATE,
    due_date         DATE,
    known_ransomware BOOLEAN NOT NULL DEFAULT false,
    notes            TEXT,
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BDU FSTEC
CREATE TABLE bdu_fstec (
    bdu_id            TEXT        PRIMARY KEY,
    name              TEXT,
    description       TEXT,
    severity          TEXT,
    cvss_v3_score     REAL,
    cvss_v3_vector    TEXT,
    cve_ids           TEXT[],
    cwe_ids           INT[],
    vendor            TEXT,
    product           TEXT,
    affected_versions TEXT,
    remediation       TEXT,
    published_at      DATE,
    modified_at       DATE,
    raw_data          JSONB,
    synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bdu_fstec_cve_ids ON bdu_fstec USING GIN (cve_ids);

-- OSV vulnerabilities
CREATE TABLE osv_vulnerabilities (
    osv_id          TEXT        PRIMARY KEY,
    summary         TEXT,
    details         TEXT,
    aliases         TEXT[],
    ecosystem       TEXT,
    package_name    TEXT,
    affected_ranges JSONB,
    severity        JSONB,
    "references"    JSONB,
    published_at    TIMESTAMPTZ,
    modified_at     TIMESTAMPTZ,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_osv_vulnerabilities_aliases   ON osv_vulnerabilities USING GIN (aliases);
CREATE INDEX idx_osv_vulnerabilities_ecosystem ON osv_vulnerabilities (ecosystem, package_name);

-- CWE catalog
CREATE TABLE cwe_catalog (
    cwe_id        INT         PRIMARY KEY,
    name          TEXT,
    description   TEXT,
    extended_desc TEXT,
    parent_ids    INT[],
    category      TEXT,
    likelihood    TEXT,
    impact        TEXT,
    mitigations   JSONB,
    synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CPE dictionary
CREATE TABLE cpe_dictionary (
    cpe_uri    TEXT    PRIMARY KEY,
    vendor     TEXT,
    product    TEXT,
    version    TEXT,
    title      TEXT,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    cve_ids    TEXT[],
    synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cpe_dictionary_vendor_product ON cpe_dictionary (vendor, product);
CREATE INDEX idx_cpe_dictionary_product        ON cpe_dictionary (product);

-- Sync status tracking
CREATE TABLE sync_status (
    source           TEXT        PRIMARY KEY,
    last_sync_at     TIMESTAMPTZ,
    records_count    INT         NOT NULL DEFAULT 0,
    status           TEXT        NOT NULL DEFAULT 'pending',
    error_message    TEXT,
    duration_seconds INT,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
