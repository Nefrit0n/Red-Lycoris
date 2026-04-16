-- CISA KEV отдаёт в JSON несколько важных полей, которые мы раньше
-- не сохраняли или склеивали с notes. Расширяем схему до полного
-- покрытия официальных полей каталога.
ALTER TABLE kev_catalog ADD COLUMN short_description TEXT;
ALTER TABLE kev_catalog ADD COLUMN required_action TEXT;

-- Для быстрой выборки CVE с подходящим дедлайном (самый частый
-- фильтр: "что нужно починить на этой неделе")
CREATE INDEX idx_kev_catalog_due_date ON kev_catalog (due_date)
  WHERE due_date IS NOT NULL;

-- Быстрая выборка ransomware-CVE (их немного, но запрашиваются
-- часто, partial index даст существенный выигрыш)
CREATE INDEX idx_kev_catalog_ransomware ON kev_catalog (cve_id)
  WHERE known_ransomware = true;
