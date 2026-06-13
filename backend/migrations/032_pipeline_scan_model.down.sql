-- Откат двухуровневой модели сканов.

-- 1. Убрать привязку к tool_run из линков.
DROP INDEX IF EXISTS idx_finding_scan_links_tool_run_id;
ALTER TABLE finding_scan_links DROP COLUMN IF EXISTS tool_run_id;

-- 2. Удалить таблицу запусков инструментов.
DROP TABLE IF EXISTS scan_tool_runs;

-- 3. Вернуть scans к исходной схеме.
DROP INDEX IF EXISTS idx_scans_project_pipeline;

ALTER TABLE scans
    DROP COLUMN IF EXISTS ci_pipeline_id,
    DROP COLUMN IF EXISTS completion,
    DROP COLUMN IF EXISTS completed_at,
    ALTER COLUMN commit_sha SET NOT NULL,
    ALTER COLUMN branch     SET NOT NULL,
    ALTER COLUMN scanner    SET NOT NULL;

-- Статусы сканов после отката — всё 'completed', т.к. оригинальные значения потеряны.
-- Это приемлемо: down применяется только в dev/test окружениях.
UPDATE scans SET status = 'completed' WHERE status IN ('open', 'timed_out');
