# Red Lycoris

Платформа для централизованного хранения, дедупликации, корреляции и обогащения уязвимостей. Замена DefectDojo с фокусом на производительность при 1M+ findings.

## Quick Start

```bash
git clone https://github.com/Nefrit0n/Red-Lycoris.git && cd Red-Lycoris
cp env.example .env
make dev
```

Откройте http://localhost:3000 (UI) и http://localhost:8080/health (API).

Для тестовых данных (100k findings):

```bash
make seed
```

## Архитектура

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Backend (Go)   │────▶│  PostgreSQL 16   │
│  React + TS  │     │   Chi Router     │     │  findings, views │
│  Vite / nginx│     │   REST API       │     │  enrichment data │
└──────────────┘     └───────┬──────────┘     └──────────────────┘
                             │
                             ▼
                     ┌──────────────────┐
                     │    Redis 7       │
                     │  кэш + Streams   │
                     │  (enrichment     │
                     │   pipeline)      │
                     └──────────────────┘
```

- **Backend** принимает результаты сканеров (SARIF, Trivy JSON, generic), дедуплицирует по fingerprint, обогащает из NVD/EPSS/KEV/BDU/OSV/CWE/CPE
- **Materialized Views** (`dashboard_stats`, `enrichment_coverage`) обновляются каждые 5 минут для быстрого дашборда
- **Redis** кэширует dashboard stats (60с), sync status (30с), enrichment данные (5мин)

## API

Base URL: `http://localhost:8080/api/v1`

### Health

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Статус сервера, БД, Redis |

### Projects

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/projects` | Список проектов |
| POST | `/api/v1/projects` | Создать проект |
| GET | `/api/v1/projects/{id}` | Получить проект |
| PUT | `/api/v1/projects/{id}` | Обновить проект |
| DELETE | `/api/v1/projects/{id}` | Удалить проект |

### Findings

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/findings` | Список findings (cursor pagination) |
| GET | `/api/v1/findings/{id}` | Детали finding + enrichments + score |
| PATCH | `/api/v1/findings/{id}/status` | Обновить статус |
| POST | `/api/v1/findings/{id}/enrich` | Запустить обогащение finding |
| PATCH | `/api/v1/findings/bulk/status` | Массовое обновление статуса |
| DELETE | `/api/v1/findings/{id}` | Удалить finding |

**Параметры списка findings:**

```
GET /api/v1/findings?limit=50&cursor=...&sort=-priority_score
    &severity=3,4&status=0&project_id=...&q=sql+injection
```

| Параметр | Описание |
|----------|----------|
| `limit` | Количество (1-200, по умолчанию 50) |
| `cursor` | Opaque cursor для пагинации |
| `sort` | Поле сортировки: `first_seen`, `last_seen`, `severity`, `priority_score` (префикс `-` для DESC) |
| `severity` | Фильтр по severity (0-4, через запятую) |
| `status` | Фильтр по статусу (0-4, через запятую) |
| `project_id` | UUID проекта |
| `q` | Полнотекстовый поиск |
| `cve` | Фильтр по CVE ID |
| `cwe` | Фильтр по CWE ID |

### Dashboard

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/dashboard/stats` | Статистика (из materialized views, кэш 60с) |

### Import

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/import` | Импорт findings (SARIF, Trivy JSON, generic JSON) |

### Enrichment

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/v1/enrichment/status` | Статус всех источников синхронизации |
| POST | `/api/v1/enrichment/enrich-all` | Обогатить все необогащённые findings |
| POST | `/api/v1/enrichment/sync/{source}` | Ручной запуск синхронизации (nvd, epss, kev, bdu, osv, cwe, cpe) |

### Формат ответов

Успех:
```json
{
  "data": { ... },
  "meta": { "total": 15000, "next_cursor": "eyJp...", "has_more": true }
}
```

Ошибка:
```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "severity must be between 0 and 4" }
}
```

## Конфигурация

Все настройки через переменные окружения (файл `.env`):

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `POSTGRES_DB` | `vulnscope` | Имя базы данных |
| `POSTGRES_USER` | `vulnscope` | Пользователь БД |
| `POSTGRES_PASSWORD` | `vulnscope_secret` | Пароль БД |
| `POSTGRES_PORT` | `5432` | Порт PostgreSQL (host) |
| `REDIS_PORT` | `6379` | Порт Redis (host) |
| `API_PORT` | `8080` | Порт backend API (host) |
| `LOG_LEVEL` | `info` | Уровень логирования: debug, info, warn, error |
| `FRONTEND_PORT` | `3000` | Порт frontend (host) |
| `FRONTEND_TARGET` | `development` | Docker build target: development / production |
| `ENRICHMENT_ENABLED` | `true` | Включить автоматическое обогащение |
| `NVD_API_KEY` | — | API ключ NVD (увеличивает rate limit 5 → 50 req/30s) |

## Команды (Make)

```
make help          # Список всех команд
make dev           # Запуск в dev режиме (hot reload)
make prod          # Запуск в production (nginx + warn logs)
make seed          # Генерация 100k тестовых findings
make sync          # Ручной запуск всех синхронизаций
make logs          # Логи всех сервисов (follow)
make clean         # Остановка + удаление всех данных
```

## Стек

- **Backend:** Go 1.22, Chi router, pgx/v5
- **Database:** PostgreSQL 16 (materialized views, BRIN/GIN индексы, cursor pagination)
- **Cache:** Redis 7 (кэш + Redis Streams для async enrichment)
- **Frontend:** React 18, TypeScript, Vite, TanStack (Table/Query/Virtual), Tailwind CSS, shadcn/ui
- **Deploy:** Docker Compose

## Источники обогащения

| Источник | Описание | Частота |
|----------|----------|---------|
| NVD | CVSS scores, CWE mapping | Каждые 2 часа |
| EPSS | Вероятность эксплуатации | Ежедневно |
| CISA KEV | Известные эксплуатируемые уязвимости | Каждые 6 часов |
| БДУ ФСТЭК | Российский реестр уязвимостей | Еженедельно |
| OSV | Open Source уязвимости | Ежедневно |
| CWE | Каталог типов уязвимостей | Ежемесячно |
| CPE | Словарь продуктов | Еженедельно |
