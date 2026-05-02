<p align="center">
  <img src="frontend/public/logo_full.svg" alt="Red Lycoris" width="360">
</p>

<p align="center"><b>On-premise ASOC-платформа</b> для централизованного хранения, дедупликации и приоритизации уязвимостей.</p>

<p align="center">
  <img src="https://img.shields.io/badge/ASOC_PLATFORM-930000?style=for-the-badge&logoColor=white" alt="ASOC">
  <img src="https://img.shields.io/badge/ON--PREMISE-930000?style=for-the-badge" alt="On-Premise">
  <img src="https://img.shields.io/badge/AIR--GAPPED-930000?style=for-the-badge" alt="Air-Gapped">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GO-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/REACT-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/POSTGRESQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/REDIS-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/DOCKER-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</p>

---

## Что это

RedLycoris принимает результаты SAST/SCA/DAST/IaC/Secrets-сканеров, дедуплицирует их по fingerprint, обогащает данными из NVD, EPSS, KEV, БДУ ФСТЭК, OSV и CWE, вычисляет priority score и предоставляет REST API + веб-интерфейс.

**Не запускает сканеры.** Только принимает их результаты.

---

## Возможности

**Импорт и нормализация**
- 10 встроенных парсеров: SARIF 2.1.0, Trivy, Semgrep, gosec, Grype, ZAP, TruffleHog v3 (NDJSON + array), Gitleaks, Checkov, Generic JSON
- Автоопределение формата входящего файла
- Привязка импорта к проекту и историчная цепочка сканов

**Дедупликация и история**
- Fingerprint SHA256 по `cve + file_path + cwe + component + version`
- Повторный импорт инкрементирует `times_seen` и обновляет `last_seen` без создания дублей
- Полная история событий по каждому finding (статусы, назначения, комментарии)

**Обогащение (async pipeline на Redis Streams)**
- NVD API 2.0, EPSS, CISA KEV, БДУ ФСТЭК, OSV, CWE MITRE, NVD CPE
- Три consumer-воркера, XACK только при успехе, авто-восстановление зависших сообщений через `processPending()`
- Локальные зеркала справочников для air-gapped развёртываний

**Приоритизация**
- Формула c учётом CVSS, EPSS, KEV, БДУ ФСТЭК, давности публикации и exposure-фактора
- Materialized view с автообновлением каждые 5 минут

**Работа с findings**
- Cursor-based пагинация (без OFFSET) на всех списочных endpoint-ах
- Фасетные фильтры: severity, status, project, CVE, CWE, assignee, source_type, теги
- Bulk-операции: смена статуса, закрытие, переоткрытие, назначение
- Сохранённые представления (saved views), комментарии, причины закрытия
- Экспорт: CSV, XLSX, NDJSON, HTML

**Многопроектная архитектура**
- Workspace → Projects → Findings
- Roles: Viewer, Triager, Project Admin, Global Admin
- Teams и группы для делегирования доступа
- API-токены с ограниченным scope per project

**Аутентификация и аудит**
- Cookie-сессии (`rl_session`, `Secure` + `HttpOnly` + `SameSite=Strict`)
- Bootstrap admin при первом запуске + принудительная смена пароля
- Rate limit на `/api/v1/auth/login`: 5 попыток / 15 минут per IP+email → HTTP 429 + `Retry-After`
- Audit log с diff всех изменений, партиционированный по месяцам, стриминг через SSE

**Наблюдаемость**
- `/healthz` (liveness), `/readyz` (readiness — postgres + redis), `/metrics` (Prometheus text format)
- Structured JSON logging (`slog`)
- Graceful shutdown: SIGTERM → drain HTTP (15 с) → XACK текущего сообщения → закрытие пулов

**UI**
- React 18 + TypeScript strict + TanStack Table/Query/Virtual + shadcn/ui + Tailwind CSS
- Виртуализированные списки на 100k+ строк
- Полностью русскоязычный интерфейс

---

## Архитектура

```
Сканер ──multipart──► POST /api/v1/import
                              │
                              ▼
                      Парсер (auto-detect)
                              │
                              ▼
                  Дедупликация по fingerprint
                              │
                       ┌──────┴──────┐
                       │             │
                    новый          дубль
                       ▼             ▼
                    INSERT      UPDATE last_seen
                                times_seen++
                       │
                       ▼
                Redis Streams ──► Enrichment workers ×3
                                  ├─ NVD       ├─ KEV
                                  ├─ EPSS      ├─ БДУ ФСТЭК
                                  ├─ OSV       └─ CWE / CPE
                       │
                       ▼
              Priority Score (materialized view, refresh 5m)
                       │
                       ▼
                   REST API ──► React UI
```

Подробнее — [docs/architecture.md](docs/architecture.md).

### Стек

| Слой | Технологии |
|------|------------|
| Backend | Go 1.22+, chi router, pgx/v5, golang-migrate, slog, bcrypt, go-redis |
| База | PostgreSQL 16 (партиционирование, materialized views) |
| Кэш / очередь | Redis 7 (Streams + AOF) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Table/Query/Virtual, Zustand, shadcn/ui |
| Деплой | Docker Compose (multi-stage builds, non-root user) |

---

## Быстрый старт

```bash
git clone https://github.com/nefrit0n/red-lycoris.git
cd red-lycoris

cp env.example .env
# Обязательно задайте: POSTGRES_PASSWORD, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD

./scripts/build.sh
docker compose up -d
```

Откройте [http://localhost:3000](http://localhost:3000).

Логин — значения из `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. При первом входе будет запрошена смена пароля (если `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE=true`).

### Make-команды

```bash
make dev         # docker compose up --build (foreground)
make dev-d       # то же, в фоне
make prod        # production-overlay (nginx, закрытые порты БД)
make migrate     # применить миграции вручную
make seed        # сгенерировать тестовые данные
make sync        # ручной запуск всех источников обогащения
make logs        # tail логов всех сервисов
make logs-api    # только backend
make stop        # остановить (данные сохраняются)
make clean       # остановить + удалить volume-ы (данные ПОТЕРЯЮТСЯ)
make help        # список всех целей
```

---

## Production-развёртывание

```bash
./scripts/build.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Отличия production-overlay от dev:
- Порты PostgreSQL и Redis не выставляются наружу
- Frontend собирается в production-stage (nginx вместо Vite)
- Нет bind-mount исходников
- Увеличенные лимиты ресурсов
- `ENV=production` (включает `Secure`-cookie по умолчанию)

Перед публикацией наружу обязательно настройте: `COOKIE_SECURE=true`, явный список `CORS_ORIGINS`, `TRUST_PROXY=true` (если за reverse proxy), уникальные пароли. Чек-лист — [docs/security-model.md](docs/security-model.md).

---

## Поддерживаемые сканеры
![SAST](https://img.shields.io/badge/SAST-supported-22c55e?style=flat-square)
![SCA](https://img.shields.io/badge/SCA-supported-22c55e?style=flat-square)
![DAST](https://img.shields.io/badge/DAST-supported-22c55e?style=flat-square)
![IaC](https://img.shields.io/badge/IaC-supported-22c55e?style=flat-square)
![Secrets](https://img.shields.io/badge/Secrets-supported-22c55e?style=flat-square)
![SARIF](https://img.shields.io/badge/SARIF-2.1.0-930000?style=flat-square)
| Сканер | Формат | Парсер |
|--------|--------|--------|
| Semgrep / OpenGrep | SARIF 2.1.0 / native JSON | `SARIFParser`, `SemgrepParser` |
| Trivy | JSON | `TrivyParser` |
| gosec | JSON / SARIF | `GosecParser` |
| Grype | JSON | `GrypeParser` |
| OWASP ZAP | JSON | `ZAPParser` |
| TruffleHog v3 | JSON / NDJSON | `TruffleHogParser` |
| Gitleaks | JSON | `GitleaksParser` |
| Checkov | JSON | `CheckovParser` |
| Любой | Generic JSON | `GenericParser` |

Формат определяется автоматически (`internal/parser/detect.go`). Чтобы добавить парсер — реализуйте интерфейс `parser.Parser` и зарегистрируйте его в `parsers`.

---

## Источники обогащения
![NVD](https://img.shields.io/badge/NVD-mirror-003366?style=flat-square)
![EPSS](https://img.shields.io/badge/EPSS-integrated-8B0000?style=flat-square)
![CISA KEV](https://img.shields.io/badge/CISA_KEV-integrated-C8102E?style=flat-square)
![БДУ ФСТЭК](https://img.shields.io/badge/%D0%91%D0%94%D0%A3_%D0%A4%D0%A1%D0%A2%D0%AD%D0%9A-integrated-FFB300?style=flat-square)
![OSV](https://img.shields.io/badge/OSV-integrated-10B981?style=flat-square)
![CWE](https://img.shields.io/badge/CWE-Top_25-06B6D4?style=flat-square)
![OWASP](https://img.shields.io/badge/OWASP-Top_10-000000?style=flat-square&logo=owasp&logoColor=white)
| База | Частота | Режим |
|------|---------|-------|
| NVD API 2.0 | каждые 2 ч (инкремент) | online / локальное зеркало |
| EPSS (Cyentia) | ежедневно | daily CSV gzip |
| CISA KEV | каждые 6 ч | JSON feed |
| БДУ ФСТЭК | еженедельно | XML в ZIP |
| OSV | ежедневно | GCS bucket ZIP |
| CWE (MITRE) | ежемесячно | XML в ZIP |
| NVD CPE | еженедельно | JSON API |

Все источники работают в фоне через Redis Streams consumer-group. При отсутствии внешней сети используются ранее загруженные данные. Ручной запуск любого источника — `POST /api/v1/enrichment/sync/{source}` или `make sync`.

Список IP/host-ов для allow-list: [docs/network_requirements.md](docs/network_requirements.md).

---

## Приоритизация

```
priority_score = cvss_base × 0.30
               + epss × 100 × 0.25
               + (10 if kev else 0) × 0.20
               + (5 if bdu else 0) × 0.10
               + recency × 0.10
               + exposure × 0.05
```

где `recency = 10 × exp(-days_since_published / 365)`, `exposure` — конфигурируемый коэффициент per project.

Реализация — `internal/domain/scoring.go`. Скоринг хранится в materialized view с автообновлением каждые 5 минут.

---

## Дедупликация

```
fingerprint = SHA256(
    lower(cve_id || "") +
    lower(file_path || "") +
    str(cwe_id || 0) +
    lower(component || "") +
    lower(component_version || "")
)
```

При совпадении fingerprint:
- `last_seen = now()`
- `times_seen += 1`
- Новая запись **не** создаётся

---

## API

REST + OpenAPI 3.1. В dev-режиме доступна интерактивная документация: [http://localhost:8080/api/docs](http://localhost:8080/api/docs).

```bash
# Версия (публичный endpoint)
curl http://localhost:8080/api/v1/version

# Импорт результатов сканирования
curl -X POST http://localhost:8080/api/v1/import \
  -H "Cookie: rl_session=<token>" \
  -F "file=@trivy-results.json" \
  -F "project_id=<uuid>"

# Список findings
curl "http://localhost:8080/api/v1/findings?severity=high,critical&status=open&limit=50&sort=-priority_score" \
  -H "Cookie: rl_session=<token>"

# Экспорт
curl "http://localhost:8080/api/v1/findings/export.xlsx?project_id=<uuid>" \
  -H "Cookie: rl_session=<token>" -o findings.xlsx
```

Все ответы — в формате:

```json
{ "data": { ... }, "meta": { "total": 15000, "next_cursor": "...", "has_more": true } }
```

Cursor-based пагинация на всех списочных endpoint-ах. Без OFFSET.

---

## Конфигурация

Все параметры — через переменные окружения. Полный список с описанием — [docs/configuration.md](docs/configuration.md).

Минимальный набор для production:

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `POSTGRES_PASSWORD` | да | Пароль БД (минимум 20 символов) |
| `BOOTSTRAP_ADMIN_EMAIL` | да | Email первого администратора |
| `BOOTSTRAP_ADMIN_PASSWORD` | да | Пароль первого администратора |
| `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE` | рекомендуется | `true` — потребовать смену при первом входе |
| `COOKIE_SECURE` | при HTTPS | `true` |
| `CORS_ORIGINS` | при публикации | явный список origin (без `*`) |
| `TRUST_PROXY` | за reverse proxy | `true` для разбора `X-Forwarded-For` |
| `NVD_API_KEY` | нет | поднимает rate limit NVD с 5 до 50 req/30s |
| `SESSION_DURATION` | нет | по умолчанию `168h` |

---

## Разработка

```bash
# Только инфраструктура
docker compose up -d postgres redis

# Backend
cd backend && go run ./cmd/server

# Frontend (Vite dev server)
cd frontend && npm install && npm run dev
```

### CLI-утилиты

| Команда | Назначение |
|---------|-----------|
| `go run ./backend/cmd/server` | API-сервер |
| `go run ./backend/cmd/admin create-user` | создать пользователя |
| `go run ./backend/cmd/admin reset-password` | сбросить пароль |
| `go run ./backend/cmd/admin list-users` | список пользователей |
| `go run ./backend/cmd/admin deactivate` | деактивировать пользователя |
| `go run ./backend/cmd/seed` | сгенерировать тестовые данные |
| `go run ./backend/cmd/loadtest` | нагрузочное тестирование |

### Структура репозитория

```
.
├── backend/                  # Go API
│   ├── cmd/{server,admin,seed,loadtest}/
│   ├── internal/
│   │   ├── api/              # chi handlers + middleware
│   │   ├── auth/             # сессии, argon2id
│   │   ├── audit/            # audit log + SSE
│   │   ├── domain/           # бизнес-логика, scoring, dedup
│   │   ├── storage/          # pgx/v5 SQL (без ORM)
│   │   ├── parser/           # парсеры сканеров
│   │   ├── enrichment/       # Redis Streams workers
│   │   ├── export/           # CSV/XLSX/NDJSON/HTML
│   │   ├── observability/    # health + Prometheus metrics
│   │   └── version/          # build-info
│   └── migrations/           # 030 SQL-миграций (golang-migrate)
├── frontend/                 # React 18 + TS + Vite
│   └── src/{api,pages,components,store,hooks,types}/
├── docs/                     # архитектура, deployment, ops, релиз-ноты
├── deployments/              # альтернативный prod-overlay
├── ops/backup/               # скрипты бэкапа
├── scripts/                  # build.sh, seed.sh
├── docker-compose.yml
├── docker-compose.prod.yml
├── env.example
└── Makefile
```

---

## Тестирование

```bash
cd backend && go test ./...
cd frontend && npm run lint && npm test
```

CI на каждый PR прогоняет: `go vet`, `go test`, `eslint`, `vitest`, build обоих образов. Конфигурация — [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Документация

- [Развёртывание](docs/deployment.md)
- [Конфигурация](docs/configuration.md)
- [Архитектура](docs/architecture.md)
- [Модель безопасности](docs/security-model.md)
- [Сетевые требования (allow-list)](docs/network_requirements.md)
- [GitLab CI/CD интеграция](docs/gitlab-ci.md)
- [Резервное копирование](docs/ops/backup-restore.md)
- [Миграции](docs/ops/migrations.md)
- [Наблюдаемость](docs/ops/observability.md)
- [Известные проблемы](docs/KNOWN_ISSUES.md)
- [CHANGELOG](CHANGELOG.md)
- [Релиз-ноты 0.1.0b](docs/release-notes/0.1.0b.md)

---

## Требования

- Docker 24+ и Docker Compose v2
- 4 ГБ RAM минимум, 8 ГБ рекомендуется для production
- 20 ГБ свободного диска (PostgreSQL + Redis AOF + локальные зеркала справочников)
- Сетевой доступ к источникам обогащения — либо предзагруженные данные для air-gapped установки

---

## Лицензия

Apache 2.0 — см. [LICENSE](LICENSE).
