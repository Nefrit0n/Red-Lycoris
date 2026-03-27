-- Local BDU FSTEC vulnerability database (parsed from vullist.xlsx).
CREATE TABLE IF NOT EXISTS bdu_vulnerabilities (
    bdu_id          TEXT PRIMARY KEY,               -- BDU:2014-00001
    name            TEXT NOT NULL DEFAULT '',        -- Наименование уязвимости
    description     TEXT NOT NULL DEFAULT '',        -- Описание уязвимости
    vendor          TEXT NOT NULL DEFAULT '',        -- Вендор ПО
    software_name   TEXT NOT NULL DEFAULT '',        -- Название ПО
    software_version TEXT NOT NULL DEFAULT '',       -- Версия ПО
    software_type   TEXT NOT NULL DEFAULT '',        -- Тип ПО
    os_hardware     TEXT NOT NULL DEFAULT '',        -- Наименование ОС и тип аппаратной платформы
    vuln_class      TEXT NOT NULL DEFAULT '',        -- Класс уязвимости
    detection_date  TEXT NOT NULL DEFAULT '',        -- Дата выявления
    cvss_v2         TEXT NOT NULL DEFAULT '',        -- CVSS 2.0 vector
    cvss_v3         TEXT NOT NULL DEFAULT '',        -- CVSS 3.0 vector
    cvss_v4         TEXT NOT NULL DEFAULT '',        -- CVSS 4.0 vector
    severity        TEXT NOT NULL DEFAULT '',        -- Уровень опасности уязвимости
    remediation     TEXT NOT NULL DEFAULT '',        -- Возможные меры по устранению
    status          TEXT NOT NULL DEFAULT '',        -- Статус уязвимости
    exploit_exists  TEXT NOT NULL DEFAULT '',        -- Наличие эксплойта
    fix_info        TEXT NOT NULL DEFAULT '',        -- Информация об устранении
    source_urls     TEXT NOT NULL DEFAULT '',        -- Ссылки на источники
    other_ids       TEXT NOT NULL DEFAULT '',        -- Идентификаторы других систем (CVE и др.)
    other_info      TEXT NOT NULL DEFAULT '',        -- Прочая информация
    incident_info   TEXT NOT NULL DEFAULT '',        -- Связь с инцидентами ИБ
    exploitation_method TEXT NOT NULL DEFAULT '',    -- Способ эксплуатации
    fix_method      TEXT NOT NULL DEFAULT '',        -- Способ устранения
    published_date  TEXT NOT NULL DEFAULT '',        -- Дата публикации
    updated_date    TEXT NOT NULL DEFAULT '',        -- Дата последнего обновления
    consequences    TEXT NOT NULL DEFAULT '',        -- Последствия эксплуатации
    vuln_state      TEXT NOT NULL DEFAULT '',        -- Состояние уязвимости
    cwe_description TEXT NOT NULL DEFAULT '',        -- Описание ошибки CWE
    cwe_id          TEXT NOT NULL DEFAULT '',        -- Тип ошибки CWE (CWE-259)
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: CVE/CWE identifier → BDU record(s).
CREATE TABLE IF NOT EXISTS bdu_identifier_map (
    identifier  TEXT NOT NULL,          -- CVE-2011-4859 or CWE-259
    bdu_id      TEXT NOT NULL REFERENCES bdu_vulnerabilities(bdu_id) ON DELETE CASCADE,
    PRIMARY KEY (identifier, bdu_id)
);

CREATE INDEX IF NOT EXISTS idx_bdu_identifier_map_ident ON bdu_identifier_map(identifier);

-- Singleton row for sync status and admin settings.
CREATE TABLE IF NOT EXISTS bdu_sync_status (
    id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_synced_at      TIMESTAMPTZ,
    record_count        INTEGER NOT NULL DEFAULT 0,
    sync_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_error          TEXT,
    is_syncing          BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bdu_sync_status (id) VALUES (1) ON CONFLICT DO NOTHING;
