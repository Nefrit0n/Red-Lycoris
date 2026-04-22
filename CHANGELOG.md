# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Версионирование: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0b] — 2026-04-22

Первый публичный бета-релиз.

### Added

**Импорт и парсеры**
- Приём результатов сканирования через `POST /api/v1/import`
- Парсеры: SARIF 2.1.0, Trivy JSON, TruffleHog v3 (NDJSON + array), Gitleaks JSON, Checkov JSON, Generic JSON
- Автоопределение формата входящего файла

**Дедупликация**
- Fingerprint-дедупликация: SHA256(cve_id + file_path + cwe_id + component + version)
- При повторном импорте: `last_seen = now()`, инкремент `times_seen`, без создания дубликата

**Обогащение (async pipeline)**
- Redis Streams consumer group с тремя воркерами
- Источники: NVD API 2.0 (каждые 2 ч), EPSS daily CSV, CISA KEV (каждые 6 ч), БДУ ФСТЭК XML (еженедельно), OSV GCS bucket (ежедневно), CWE XML (ежемесячно), NVD CPE API (еженедельно)
- XACK только при успешной обработке; при краше — автоповтор через `processPending()`

**Приоритизация**
- Формула: `cvss × 0.30 + epss × 0.25 + kev × 0.20 + bdu × 0.10 + recency × 0.10 + exposure × 0.05`
- Materialized view с автообновлением каждые 5 минут

**API**
- Cursor-based пагинация на всех списочных endpoint'ах
- Фильтрация по severity, status, project, CVE, CWE, assignee, source_type
- Bulk-операции: изменение статуса, закрытие, назначение
- Export: CSV, XLSX, NDJSON, HTML
- `GET /api/v1/version` — публичный endpoint с версией/commit/build_date

**Проекты и RBAC**
- Многопроектная архитектура
- Роли: Viewer, Triager, Project Admin, Global Admin
- API-токены per project с ограниченным scope

**Аутентификация**
- Cookie-сессии (`rl_session`, Secure + HttpOnly + SameSite=Strict)
- Rate limit на `/api/v1/auth/login`: 5 попыток / 15 мин per IP+email → HTTP 429 + Retry-After
- Bootstrap admin при первом запуске

**Аудит**
- Audit log с diff всех изменений findings
- Партиционирование по месяцам; стриминг через SSE

**Дашборд**
- Статистика по severity, статусам, источникам
- Топ CVE, тренды по проекту

**Наблюдаемость**
- `/healthz` — liveness, `/readyz` — readiness (проверяет postgres + redis)
- `/metrics` — Prometheus text format (HTTP RPS, latency, DB pool, enrichment queue)
- Structured JSON logging (slog)

**Graceful shutdown**
- SIGTERM → drain HTTP (15 с) → XACK текущего сообщения enrichment → закрытие pgxpool

**Docker**
- Multi-stage build: Go builder → alpine:3.19 (non-root user `app`, uid 1000)
- Frontend: nginx:stable-alpine (USER 101)
- `deployments/docker-compose.prod.yml` — production overlay с resource limits

**Документация**
- `docs/architecture.md` — Mermaid-диаграмма потока данных
- `docs/security-model.md` — модель угроз и рекомендации
- `docs/deployment.md`, `docs/configuration.md`

### Known Issues

- Двунаправленная синхронизация с Jira не реализована (план: 0.2.0)
- SBOM-импорт (CycloneDX / SPDX) не поддерживается (план: 0.2.0)
- OSV sync загружает все экосистемы без фильтрации; при медленном канале возможен таймаут

[0.1.0b]: https://github.com/nefrit0n/red-lycoris/releases/tag/v0.1.0b
