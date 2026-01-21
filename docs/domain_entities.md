# Доменные сущности Lotus Warden

Документ описывает базовые доменные сущности и их поля, выравнивая naming и типы с текущими таблицами в `backend/migrations`. Все типы указаны в терминах PostgreSQL (`UUID`, `TEXT`, `JSONB`, `TIMESTAMPTZ`, `INT`).

## Соответствие сущностей таблицам

| Сущность | Основная таблица | Связанные таблицы |
| --- | --- | --- |
| Asset / Product | `products` | `engagements`, `scan_results`, `findings`, `import_jobs`, `analysis_jobs` |
| Scan Result | `scan_results` | `import_jobs`, `products`, `users` |
| Import Job | `import_jobs` | `scan_results`, `findings`, `products`, `users` |
| Finding | `findings` | `finding_comments`, `finding_events`, `finding_vuln_identifiers` |
| Evidence | `findings.evidence` | `findings.raw_data` |
| Source | полевая модель для `scan_results`, `import_jobs`, `findings`, `vuln_intel` | `vuln_intel` |

## Asset / Product (`products`)

**Назначение:** логический актив/продукт, к которому привязаны сканы и findings.

**Ключевые поля (PostgreSQL типы):**
- `id` (UUID)
- `name` (TEXT)
- `slug` (TEXT)
- `description` (TEXT, nullable)
- `identifier` (TEXT, nullable)
- `version` (TEXT, nullable)
- `asset_criticality` (TEXT, nullable) — критичность актива. Рекомендуемые значения: `low`, `medium`, `high`, `critical`.
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Замечания:**
- `asset_criticality` логически соответствует критичности продукта и может использовать те же значения, что и `findings.severity`.

## Scan Result (`scan_results`)

**Назначение:** результат запуска конкретного сканера с привязкой к продукту и (опционально) import job.

**Ключевые поля:**
- `id` (UUID)
- `engagement_id` (UUID, nullable)
- `product_id` (UUID, nullable)
- `import_job_id` (UUID, nullable)
- `uploader_id` (UUID, nullable)
- `scanner` (TEXT) — имя сканера (например, `semgrep`, `trivy`, `zap`).
- `source_type` (TEXT, nullable) — тип источника (например, `scanner`, `manual`, `intel`).
- `source_version` (TEXT, nullable) — версия источника (например, версия сканера).
- `raw_report` (JSONB, nullable) — «сырое» содержимое отчёта.
- `processed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

## Import Job (`import_jobs`)

**Назначение:** пакетный импорт результатов сканера (особенно при загрузке отчётов через API/UI).

**Ключевые поля:**
- `id` (UUID)
- `scanner` (TEXT)
- `source_type` (TEXT, nullable)
- `source_version` (TEXT, nullable)
- `product_id` (UUID, nullable)
- `product_name` (TEXT, nullable)
- `product_version` (TEXT, nullable)
- `product_identifier` (TEXT, nullable)
- `status` (TEXT)
- `findings_total` (INT)
- `findings_new` (INT)
- `duplicates_total` (INT)
- `checksum` (TEXT)
- `error_message` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `started_at` (TIMESTAMPTZ, nullable)
- `finished_at` (TIMESTAMPTZ, nullable)
- `created_by` (UUID, nullable)

## Finding (`findings`)

**Назначение:** нормализованная запись об уязвимости/проблеме, привязанная к продукту и источнику.

**Ключевые поля:**
- `id` (UUID)
- `scan_result_id` (UUID, nullable)
- `import_job_id` (UUID, nullable)
- `product_id` (UUID, nullable)
- `fingerprint` (TEXT)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `severity` (TEXT)
- `status` (TEXT)
- `duplicate_id` (UUID, nullable)
- `assignee_id` (UUID, nullable)
- `first_seen_at` (TIMESTAMPTZ, nullable)
- `last_seen_at` (TIMESTAMPTZ, nullable)
- `repeat_count` (INT)
- `source_type` (TEXT, nullable)
- `source_version` (TEXT, nullable)
- `endpoint_method` (TEXT, nullable) — HTTP метод (например, `GET`, `POST`).
- `endpoint_path` (TEXT, nullable) — путь эндпоинта (например, `/api/v1/users`).
- `evidence` (JSONB, nullable)
- `raw_data` (JSONB, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ, nullable)

## Evidence (`findings.evidence`)

**Назначение:** структурированные доказательства, которые показываются в карточке finding.

**Рекомендуемая структура (JSONB):**
```json
{
  "payload": { "request": "...", "headers": {"Content-Type": "..."} },
  "response": { "status": 200, "body": "...", "headers": {"Server": "..."} },
  "location": { "file": "main.go", "line": 42 },
  "snippet": "...",
  "metadata": { "scanner": "semgrep", "rule": "..." }
}
```

## Source (логическая модель)

**Назначение:** описание источника данных (сканер/интел/ручной ввод). В БД фиксируется через поля `scanner`, `source_type`, `source_version` и JSONB‑payload источника.

**Ключевые поля:**
- `source_type` (TEXT) — тип источника (`scanner`, `intel`, `manual` и т.п.).
- `source_version` (TEXT) — версия источника.

## Extensible metadata (JSONB)

Для будущих сканеров и расширений используются JSONB‑поля, которые допускают произвольные расширения без миграций. Текущие и рекомендованные JSONB‑поля:

- `scan_results.raw_report` — сырые отчёты сканеров.
- `findings.evidence` — структурированное доказательство (payload/response/metadata).
- `findings.raw_data` — «сырая» нормализованная нагрузка сканера.
- `finding_events.payload` — произвольные события в истории finding.
- `vuln_intel.nvd_payload`, `vuln_intel.epss_payload`, `vuln_intel.kev_payload`, `vuln_intel.references_payload` — внешнее обогащение.

**Рекомендации по ключам:**
- `metadata.scanner`: имя и версия сканера.
- `metadata.asset`: ссылка/контекст продукта.
- `metadata.endpoint`: метод/путь/хост.
- `metadata.tags`: список тегов.
- `metadata.custom`: вендорские расширения.
