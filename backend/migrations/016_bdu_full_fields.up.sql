-- Расширение bdu_fstec до полного покрытия полей vulxml.xml.
--
-- Старое affected_versions/vendor/product оставляем ради обратной
-- совместимости, но основным теперь будет software JSONB с массивом
-- объектов, где каждый продукт сохраняет структуру (vendor, name,
-- version, type, platforms).

ALTER TABLE bdu_fstec ADD COLUMN vul_status        TEXT;
ALTER TABLE bdu_fstec ADD COLUMN exploit_status    TEXT;
ALTER TABLE bdu_fstec ADD COLUMN fix_status        TEXT;
ALTER TABLE bdu_fstec ADD COLUMN vul_class         TEXT;
ALTER TABLE bdu_fstec ADD COLUMN exploitation_way  TEXT;
ALTER TABLE bdu_fstec ADD COLUMN mitigation_way    TEXT;

-- CVSS: уже есть cvss_v3_score / cvss_v3_vector.
-- Добавляем v2 и v4, плюс score отдельно для удобных запросов.
ALTER TABLE bdu_fstec ADD COLUMN cvss_v2_score     REAL;
ALTER TABLE bdu_fstec ADD COLUMN cvss_v2_vector    TEXT;
ALTER TABLE bdu_fstec ADD COLUMN cvss_v4_score     REAL;
ALTER TABLE bdu_fstec ADD COLUMN cvss_v4_vector    TEXT;

-- Структурированное ПО вместо трёх плоских строк.
-- Формат: [{"vendor":"...","name":"...","version":"...","type":"...","platforms":[...]}]
ALTER TABLE bdu_fstec ADD COLUMN software       JSONB;
ALTER TABLE bdu_fstec ADD COLUMN environment    JSONB;

-- Ссылки на источники (array of URLs)
ALTER TABLE bdu_fstec ADD COLUMN sources        TEXT[];

-- Индекс для поиска по названию ПО (useful для SCA-корреляции позже)
CREATE INDEX idx_bdu_fstec_software_gin ON bdu_fstec USING GIN (software);
