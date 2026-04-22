-- История EPSS по CVE: каждая строка — снимок на конкретную дату.
-- Партиционируем по score_date с шагом в месяц: старые партиции
-- (> 180 дней) можно DROP'ать без вакуума.
CREATE TABLE epss_history (
    cve_id     TEXT NOT NULL,
    score_date DATE NOT NULL,
    epss_score REAL NOT NULL,
    percentile REAL NOT NULL,
    PRIMARY KEY (cve_id, score_date)
) PARTITION BY RANGE (score_date);

-- Партиции на 6 месяцев вперёд. Именование как в raw_findings:
-- epss_history_YYYY_MM. Создаём партиции начиная с текущего месяца.
CREATE TABLE epss_history_2026_04 PARTITION OF epss_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE epss_history_2026_05 PARTITION OF epss_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE epss_history_2026_06 PARTITION OF epss_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE epss_history_2026_07 PARTITION OF epss_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE epss_history_2026_08 PARTITION OF epss_history
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE epss_history_2026_09 PARTITION OF epss_history
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- Индекс для выборки истории по CVE
CREATE INDEX idx_epss_history_cve_date ON epss_history (cve_id, score_date DESC);
