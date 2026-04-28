# Архитектура RedLycoris

## Поток данных

```mermaid
flowchart TD
    Scanner["Сканер\n(Semgrep / Trivy / Gitleaks / ...)"]
    Import["POST /api/v1/import"]
    Parser["Парсер\nSARIF · Trivy · TruffleHog · Checkov · Gitleaks · Generic"]
    Dedup{"Дедупликация\nfingerprint = SHA256(...)\nsecret_fingerprint = SHA256(secret_kind:secret_value)"}
    Insert["INSERT findings"]
    Update["UPDATE last_seen\ntimes_seen++"]
    Stream["Redis Streams\nfindings:enrich"]
    Workers["Enrichment Workers ×3\n(consumer group)"]
    NVD["NVD API 2.0"]
    EPSS["EPSS CSV"]
    KEV["CISA KEV"]
    BDU["БДУ ФСТЭК"]
    OSV["OSV"]
    CWE["CWE MITRE"]
    Score["Priority Score\n(materialized view)"]
    API["REST API\nGo · chi"]
    UI["React UI\nTanStack Table/Query/Virtual"]

    Scanner -->|multipart/form-data| Import
    Import --> Parser
    Parser --> Dedup
    Dedup -->|новый| Insert
    Dedup -->|дубль| Update
    Insert --> Stream
    Stream --> Workers
    Workers --> NVD & EPSS & KEV & BDU & OSV & CWE
    Workers -->|XACK| Stream
    Insert & Update --> Score
    Score --> API
    API --> UI
```

## Компоненты

### Backend (Go 1.24)

| Пакет | Назначение |
|-------|------------|
| `cmd/server` | Точка входа: конфиг, миграции, graceful shutdown |
| `internal/api` | Chi-роутер, хендлеры, middleware |
| `internal/domain` | Структуры данных, бизнес-логика (scoring, dedup) |
| `internal/storage` | SQL-запросы через pgx/v5 (без ORM) |
| `internal/parser` | Парсеры форматов сканеров |
| `internal/enrichment` | Redis Streams workers, планировщик синхронизации |
| `internal/observability` | /healthz, /readyz, /metrics (Prometheus) |
| `internal/audit` | Audit log writer + партиционирование |
| `internal/version` | Build-time версионирование через ldflags |

### Хранилище

**PostgreSQL 16** — основная БД:
- `findings` — партиционирована по `imported_at` (RANGE, помесячно)
- `finding_enrichments` — результаты обогащения (JSONB)
- `finding_scores` — priority scores
- `sync_status` — состояние источников обогащения
- `audit_log` — аудит изменений (партиции по месяцам)
- Materialized view `finding_priority` — обновляется каждые 5 мин

**Redis 7** — кэш + очереди:
- Stream `findings:enrich` — задачи обогащения
- Consumer group `enrichment-workers` — три воркера с балансировкой
- Rate limiting — `ratelimit:login:{ip}:{email}`

### Frontend (React 18 + TypeScript)

| Библиотека | Использование |
|------------|---------------|
| TanStack Query | Серверный стейт, кэширование |
| TanStack Table | Таблица findings с сортировкой/фильтрацией |
| TanStack Virtual | Виртуализация длинных списков |
| Zustand | Клиентский стейт (фильтры, UI) |
| shadcn/ui | Компоненты (Button, Badge, Dialog, ...) |
| Tailwind CSS | Стилизация |
| React Router v6 | Маршрутизация |

## Пагинация

Cursor-based пагинация на всех списочных endpoint'ах:

```
GET /api/v1/findings?limit=50&cursor=eyJpZCI6...&sort=-priority_score
```

Курсор = base64(JSON{id, sort_field_value}). Без OFFSET, стабильно при параллельных вставках.

## Обогащение — жизненный цикл сообщения

```
Import → INSERT finding
       → XADD findings:enrich {finding_id, source_types}
       
Worker → XREADGROUP (block 5s)
       → обработка (HTTP запрос к источнику, INSERT enrichment)
       → XACK  ← только при успехе
       
При перезапуске:
       → processPending() — XPENDING + XCLAIM просроченных
```

## Graceful Shutdown

```
SIGTERM
  → HTTP server.Shutdown(ctx, 15s)   # дожидается активных запросов
  → auditWriter.Close(ctx, 15s)      # сбрасывает буфер аудита
  → context.cancel()                 # останавливает enrichment workers
    (workers завершают текущее сообщение + XACK, затем выходят)
  → pool.Close()                     # pgxpool закрывается последним
```
