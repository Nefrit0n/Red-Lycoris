-- Двухуровневая модель сканов: скан = прогон пайплайна, внутри — запуски инструментов.

-- 1. Расширяем scans: добавляем поля пайплайна и делаем scanner/commit_sha/branch опциональными.
ALTER TABLE scans
    ADD COLUMN ci_pipeline_id TEXT,
    ADD COLUMN completion      TEXT,
    ADD COLUMN completed_at    TIMESTAMPTZ,
    ALTER COLUMN commit_sha    DROP NOT NULL,
    ALTER COLUMN branch        DROP NOT NULL,
    ALTER COLUMN scanner       DROP NOT NULL;

-- Уникальный индекс для апсерта по (project_id, ci_pipeline_id).
-- Partial: только строки с непустым ci_pipeline_id.
CREATE UNIQUE INDEX idx_scans_project_pipeline
    ON scans (project_id, ci_pipeline_id)
    WHERE ci_pipeline_id IS NOT NULL;

-- 2. Таблица запусков инструментов.
CREATE TABLE scan_tool_runs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id           UUID        NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    scanner           TEXT        NOT NULL,
    scanner_version   TEXT,
    report_format     TEXT        NOT NULL,
    status            TEXT        NOT NULL,
    error             TEXT,
    findings_imported INT         NOT NULL DEFAULT 0,
    findings_updated  INT         NOT NULL DEFAULT 0,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_tool_runs_scan_id ON scan_tool_runs (scan_id);

-- 3. Привязка finding → tool_run.
ALTER TABLE finding_scan_links
    ADD COLUMN tool_run_id UUID REFERENCES scan_tool_runs(id) ON DELETE CASCADE;

CREATE INDEX idx_finding_scan_links_tool_run_id
    ON finding_scan_links (tool_run_id)
    WHERE tool_run_id IS NOT NULL;

-- 4. Бэкфилл: один tool_run на каждый существующий скан.
INSERT INTO scan_tool_runs (
    id, scan_id, scanner, scanner_version, report_format, status,
    findings_imported, findings_updated, started_at, finished_at
)
SELECT
    gen_random_uuid(),
    s.id,
    COALESCE(s.scanner, 'unknown'),
    s.scanner_version,
    'unknown',
    CASE WHEN s.status = 'failed' THEN 'failed' ELSE 'success' END,
    s.findings_imported,
    s.findings_updated,
    s.started_at,
    COALESCE(s.finished_at, s.started_at)
FROM scans s;

-- 5. Проставить tool_run_id существующим линкам (один tool_run на скан).
UPDATE finding_scan_links fsl
SET tool_run_id = tr.id
FROM scan_tool_runs tr
WHERE tr.scan_id = fsl.scan_id;

-- 6. Перевести все существующие сканы в статус completed/auto.
UPDATE scans
SET status       = 'completed',
    completion   = 'auto',
    completed_at = COALESCE(finished_at, now())
WHERE status IN ('running', 'completed', 'failed');
