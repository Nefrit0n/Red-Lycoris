CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    project_id,
    severity,
    status,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE first_seen > now() - interval '7 days') AS new_this_week,
    AVG(fs.priority_score) AS avg_priority
FROM findings f
LEFT JOIN finding_scores fs ON f.id = fs.finding_id
GROUP BY project_id, severity, status;

CREATE UNIQUE INDEX idx_dashboard_stats_pk ON dashboard_stats (project_id, severity, status);

CREATE MATERIALIZED VIEW enrichment_coverage AS
SELECT
    source,
    COUNT(DISTINCT finding_id) AS enriched_count,
    (SELECT COUNT(*) FROM findings) AS total_findings
FROM finding_enrichments
GROUP BY source;

CREATE UNIQUE INDEX idx_enrichment_coverage_source ON enrichment_coverage (source);
