-- Создаём партиции audit_log для текущего месяца и +3 месяца вперёд.
-- После этого планировщик в main.go будет сам создавать новые.
-- Используем DO-блок чтобы сгенерировать SQL динамически на основе
-- текущей даты в момент применения миграции.
DO $$
DECLARE
    start_month DATE := date_trunc('month', CURRENT_DATE)::DATE;
    i INT;
    part_name TEXT;
    range_start DATE;
    range_end DATE;
BEGIN
    FOR i IN 0..3 LOOP
        range_start := start_month + (i || ' months')::INTERVAL;
        range_end := start_month + ((i + 1) || ' months')::INTERVAL;
        part_name := 'audit_log_' || to_char(range_start, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
            part_name, range_start, range_end
        );
    END LOOP;
END $$;
