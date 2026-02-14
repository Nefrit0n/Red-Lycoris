# Доменные сущности Red Lycoris

Документ описывает базовые доменные сущности и их поля, выравнивая naming и типы с текущими таблицами в `backend/migrations`. Все типы указаны в терминах PostgreSQL (`UUID`, `TEXT`, `JSONB`, `TIMESTAMPTZ`, `INT`).

## Соответствие сущностей таблицам

| Сущность | Основная таблица | Связанные таблицы |
| --- | --- | --- |
| Asset / Product | `products` | `engagements`, `scan_results`, `findings`, `import_jobs`, `analysis_jobs` |
| Asset Context | `product_asset_context` | `products` |
| Scan Result | `scan_results` | `import_jobs`, `products`, `users` |
| Import Job | `import_jobs` | `scan_results`, `findings`, `products`, `users` |
| Finding | `findings` | `finding_comments`, `finding_events`, `finding_vuln_identifiers` |
| Vulnerability Identifiers | `finding_vuln_identifiers` | `findings`, `vuln_intel` |
| Vulnerability Intel | `vuln_intel` | `finding_vuln_identifiers` |
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

## Asset Context (`product_asset_context`)

**Назначение:** контекст актива для risk‑скоринга (минимальные бизнес‑сигналы, 1:1 с продуктом).

**Ключевые поля:**
- `product_id` (UUID)
- `tenant_id` (UUID, nullable)
- `environment` (TEXT) — окружение (`prod`, `staging`, `dev`, `unknown`).
- `internet_exposed` (BOOLEAN) — признак внешней доступности.
- `data_classification` (TEXT) — классификация данных (`public`, `internal`, `confidential`, `restricted`, `unknown`).
- `business_impact` (TEXT, nullable) — бизнес‑влияние (`low`, `medium`, `high`, `critical`).
- `tags` (TEXT[], nullable) — набор фильтруемых тегов.
- `metadata` (JSONB) — расширяемые данные без миграций.
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

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

## Vulnerability Identifiers (`finding_vuln_identifiers`)

**Назначение:** связывает findings с уязвимостями (CVE, GHSA, OSV и т.д.).

**Ключевые поля:**
- `finding_id` (UUID)
- `identifier` (TEXT)
- `created_at` (TIMESTAMPTZ)

**Индексы и ограничения:**
- `PRIMARY KEY (finding_id, identifier)` — защита от дубликатов.
- `idx_finding_vuln_identifiers_identifier` — быстрый поиск по идентификатору.

## Vulnerability Intelligence (`vuln_intel`)

**Назначение:** кэш обогащения уязвимостей из внешних источников (NVD/EPSS/KEV).

**Ключевые поля:**
- `identifier` (TEXT)
- `source_version` (TEXT)
- `nvd_payload` (JSONB, nullable)
- `epss_payload` (JSONB, nullable)
- `kev_payload` (JSONB, nullable)
- `references_payload` (JSONB, nullable)
- `cvss_score` (NUMERIC, nullable)
- `cvss_version` (TEXT, nullable)
- `epss_score` (NUMERIC, nullable)
- `epss_percentile` (NUMERIC, nullable)
- `kev` (BOOLEAN)
- `fail_count` (INT)
- `last_refreshed_at` (TIMESTAMPTZ, nullable)
- `next_retry_at` (TIMESTAMPTZ, nullable)
- `last_error` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Индексы и ограничения:**
- `PRIMARY KEY (identifier, source_version)`
- `idx_vuln_intel_identifier`
- `idx_vuln_intel_next_retry`

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

## Admin Access Control (Admin v2)

### Команда (`teams`)

**Назначение:** tenant-ограниченная группа пользователей для массового назначения прав на продукты.

**Ключевые поля:**
- `id` (UUID)
- `tenant_id` (UUID)
- `name` (TEXT)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- `UNIQUE (tenant_id, name)`
- `UNIQUE (tenant_id, id)`

### Участники команды (`team_members`)

**Назначение:** связь пользователей с командами в рамках одного tenant.

**Ключевые поля:**
- `tenant_id` (UUID)
- `team_id` (UUID)
- `user_id` (UUID)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- `PRIMARY KEY (team_id, user_id)`
- `FK (tenant_id, team_id) -> teams(tenant_id, id)`
- `FK (tenant_id, user_id) -> users(tenant_id, id)`

### Роли команды в продукте (`product_team_roles`)

**Назначение:** назначение роли команде на продукт (проект).

**Ключевые поля:**
- `tenant_id` (UUID)
- `product_id` (UUID)
- `team_id` (UUID)
- `role` (TEXT: `maintainer | engineer | viewer`)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- `PRIMARY KEY (product_id, team_id)`
- `FK (tenant_id, product_id) -> products(tenant_id, id)`
- `FK (tenant_id, team_id) -> teams(tenant_id, id)`

### Прямые роли пользователя в продукте (`product_user_roles`)

**Назначение:** исключения/прямые права пользователя на продукт.

**Ключевые поля:**
- `tenant_id` (UUID)
- `product_id` (UUID)
- `user_id` (UUID)
- `role` (TEXT: `maintainer | engineer | viewer`)
- `created_at` (TIMESTAMPTZ)

**Ограничения:**
- `PRIMARY KEY (product_id, user_id)`
- `FK (tenant_id, product_id) -> products(tenant_id, id)`
- `FK (tenant_id, user_id) -> users(tenant_id, id)`

### Иерархия ролей проекта (для вычисления эффективных прав)

Порядок сравнения ролей фиксирован:

`viewer < engineer < maintainer`

Эффективная роль пользователя в продукте определяется как максимум из:
- прямой роли из `product_user_roles`;
- ролей, полученных через все команды пользователя из `product_team_roles`.
