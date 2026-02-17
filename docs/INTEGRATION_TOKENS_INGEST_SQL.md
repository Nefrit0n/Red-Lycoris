# Integration Tokens + GitLab Ingest SQL model (migration 048)

## Что добавлено

Миграция `048_integration_tokens_ingest` добавляет SQL-модель для:
- `integration_tokens` — хранение токенов интеграций (hash-only, revocation вместо delete).
- `integration_token_events` — append-only аудит/ревизии токенов.
- `org_security_policies` — per-org TTL политики токенов.
- `ingest_runs` — идемпотентные ingestion run'ы GitLab CI.
- `ingest_artifacts` — артефакты run'а с hash/размерами и верификацией.

## Ключевые решения и trade-offs

1. **Append-only / auditability**
   - Журнал `integration_token_events` только на вставку.
   - Отзыв токена через `revoked_at`, а не удаление строки.
   - Это сохраняет полный исторический след для расследований и комплаенса.

2. **Idempotency и ретраи CI**
   - `ingest_runs` имеет `UNIQUE(org_id, project_id, x_idempotency_key)`.
   - Повторный `init` с тем же ключом будет резолвиться в тот же run (на уровне сервиса).
   - Защищает от дублей при ретраях пайплайна/джоба.

3. **Tenant boundary**
   - Во всех ключевых таблицах явно хранится `org_id` (+ `project_id` где применимо).
   - Индексы начинаются с tenant-ключей для deny-by-default выборок.

4. **Уникальность активного имени токена**
   - В PostgreSQL нельзя положить `now()` в partial unique predicate (не immutable).
   - Поэтому сделано:
     - partial unique index по `(org_id, project_id, name) WHERE revoked_at IS NULL`,
     - плюс trigger-проверка, учитывающая `expires_at > now()`.
   - Это чуть сложнее операционно, но сохраняет требуемую бизнес-семантику «активного» имени.

5. **Интеграция с существующим `audit_log`**
   - `audit_log` в проекте уже есть, поэтому новая таблица не дублирует общий аудит.
   - В миграции добавлена техническая запись о применении схемы (если `audit_log` существует).

## Как применять

```bash
go run ./backend/cmd/migrate
```

Откат:

```bash
psql "$DATABASE_URL" -f backend/migrations/048_integration_tokens_ingest.down.sql
```

## Замечания для backend-реализации

- Проверка токена должна идти через сравнение argon2id hash (`token_hash`), без хранения plaintext.
- На каждое использование токена писать событие `integration_token_events` (`used`) с `details` (ingest action, run_id, pipeline/job).
- Все операции lifecycle (`created/revoked/rotated/...`) должны писать append-only событие.
