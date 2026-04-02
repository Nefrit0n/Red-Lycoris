CREATE TABLE IF NOT EXISTS bdu_components (
    id SERIAL PRIMARY KEY,
    bdu_id TEXT NOT NULL,
    vendor TEXT NOT NULL DEFAULT '',
    software_name TEXT NOT NULL,
    software_version TEXT NOT NULL DEFAULT '',
    software_type TEXT NOT NULL DEFAULT '',
    os_platform TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bdu_comp UNIQUE (bdu_id, software_name, software_version)
);

CREATE INDEX IF NOT EXISTS idx_bdu_comp_name
    ON bdu_components (LOWER(software_name));
CREATE INDEX IF NOT EXISTS idx_bdu_comp_name_ver
    ON bdu_components (LOWER(software_name), LOWER(software_version));
