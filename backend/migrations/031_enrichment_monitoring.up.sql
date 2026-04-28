CREATE TABLE IF NOT EXISTS enrichment_source_stats (
    source_code TEXT NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL,
    record_count BIGINT NOT NULL,
    PRIMARY KEY (source_code, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_ess_source_time
    ON enrichment_source_stats USING BRIN (snapshot_at);

CREATE TABLE IF NOT EXISTS enrichment_jobs (
    job_id UUID NOT NULL,
    source_code TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL,
    message TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    PRIMARY KEY (job_id, started_at)
) PARTITION BY RANGE (started_at);

DO $$
DECLARE
    d date := (CURRENT_DATE - INTERVAL '7 day')::date;
    max_d date := (CURRENT_DATE + INTERVAL '8 day')::date;
BEGIN
    WHILE d < max_d LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS enrichment_jobs_%s PARTITION OF enrichment_jobs FOR VALUES FROM (%L) TO (%L);',
            to_char(d, 'YYYYMMDD'),
            d::text,
            (d + INTERVAL '1 day')::date::text
        );
        d := (d + INTERVAL '1 day')::date;
    END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_started_brin ON enrichment_jobs USING BRIN (started_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_source_status ON enrichment_jobs (source_code, status, occurred_at DESC);
