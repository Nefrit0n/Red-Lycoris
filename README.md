# RedLycoris

**On-premise ASOC-платформа** для централизованного хранения, дедупликации и приоритизации уязвимостей.

Замена DefectDojo с фокусом на производительность при **1M+ findings**, поддержкой воздушных зазоров и русскоязычным интерфейсом.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![DevSecOps](https://img.shields.io/badge/DevSecOps-platform-red)
![Self Hosted](https://img.shields.io/badge/Self--Hosted-ready-success)
![Status](https://img.shields.io/badge/status-active_development-orange)

---

## Что это

RedLycoris принимает результаты SAST/SCA/DAST/IaC/Secrets-сканеров, дедуплицирует их по fingerprint, обогащает данными из NVD, EPSS, KEV, БДУ ФСТЭК, OSV и CWE, вычисляет priority score и предоставляет REST API + веб-интерфейс.

**Не запускает сканеры.** Только принимает их результаты.

---

## Возможности

- **Агрегация** — единое хранилище для SAST/SCA/DAST/IaC/Secrets findings
- **Дедупликация** — SHA256-fingerprint, без дублей при повторном импорте
- **Обогащение** — NVD, EPSS, CISA KEV, БДУ ФСТЭК, OSV, CWE (локальные зеркала, offline-режим)
- **Приоритизация** — формула с учётом CVSS, EPSS, KEV-статуса, давности публикации
- **Масштаб** — cursor-based пагинация, materialized views, протестировано на 100k+ findings
- **RBAC** — Viewer / Triager / Project Admin / Global Admin
- **Аудит** — полная история изменений с diff
- **Экспорт** — CSV, XLSX, NDJSON, HTML
- **Наблюдаемость** — `/healthz`, `/readyz`, `/metrics` (Prometheus)
- **Русский UI** — React 18 + TanStack Table/Query/Virtual + shadcn/ui

---

## Быстрый старт

```bash
git clone https://github.com/nefrit0n/red-lycoris.git
cd red-lycoris

cp env.example .env
# Обязательно: POSTGRES_PASSWORD, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD

./scripts/build.sh
docker compose up -d
```

Откройте [http://localhost:3000](http://localhost:3000).

Логин по умолчанию задаётся через `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` в `.env`.

### Production-развёртывание

```bash
./scripts/build.sh
docker compose -f docker-compose.yml -f deployments/docker-compose.prod.yml up -d
```

Отличия production-режима: порты postgres/redis закрыты, увеличены лимиты ресурсов, LOG_LEVEL=warn.

---

## Поддерживаемые сканеры

| Сканер | Формат | Парсер |
|--------|--------|--------|
| Semgrep / OpenGrep | SARIF 2.1.0 | `SARIFParser` |
| Trivy | JSON | `TrivyParser` |
| Checkov | JSON | `CheckovParser` |
| Gitleaks | JSON | `GitleaksParser` |
| TruffleHog v3 | JSON / NDJSON | `TruffleHogParser` |
| Любой | Generic JSON | `GenericParser` |

Формат определяется автоматически. Добавить новый парсер — реализовать интерфейс `parser.Parser`.

---

## Источники обогащения

| База | Частота | Режим |
|------|---------|-------|
| NVD API 2.0 | 2 часа (инкремент) | online / зеркало |
| EPSS (Cyentia) | ежедневно | daily CSV |
| CISA KEV | 6 часов | JSON feed |
| БДУ ФСТЭК | еженедельно | XML в ZIP |
| OSV | ежедневно | GCS bucket ZIP |
| CWE (MITRE) | ежемесячно | XML в ZIP |
| NVD CPE | еженедельно | JSON API |

Все источники работают в фоне через Redis Streams. При отключении внешних сетей используются локально кешированные данные.

---

## Архитектура

```
Сканер → POST /api/v1/import
              │
              ▼
        Парсер (SARIF/Trivy/...)
              │
              ▼
        Дедупликация (fingerprint SHA256)
              │
         ┌────┴────┐
         │ новый   │ дубль
         ▼         ▼
      INSERT    UPDATE last_seen
                times_seen++
              │
              ▼
        Redis Streams → Enrichment Workers (×3)
              │           NVD / EPSS / KEV / БДУ / OSV / CWE
              ▼
        Priority Score (materialized view, обновление каждые 5 мин)
              │
              ▼
        REST API → React UI
```

Подробнее: [docs/architecture.md](docs/architecture.md)

---

## Конфигурация

Все параметры — через переменные окружения. Полный список с описанием: [docs/configuration.md](docs/configuration.md).

Критичные параметры для production:

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `POSTGRES_PASSWORD` | да | Пароль БД |
| `BOOTSTRAP_ADMIN_EMAIL` | да | Email первого администратора |
| `BOOTSTRAP_ADMIN_PASSWORD` | да | Пароль первого администратора |
| `COOKIE_SECURE` | рекомендуется | `true` при HTTPS |
| `TRUST_PROXY` | только за nginx | `true` если за reverse proxy |
| `NVD_API_KEY` | нет | Увеличивает rate limit NVD с 5 до 50 req/30s |

---

## API

REST API с OpenAPI 3.1 спецификацией. В dev-режиме доступна документация: [http://localhost:8080/api/docs](http://localhost:8080/api/docs).

```bash
# Версия сервиса (публичный endpoint)
curl http://localhost:8080/api/v1/version

# Импорт результатов сканирования
curl -X POST http://localhost:8080/api/v1/import \
     -H "Cookie: rl_session=<token>" \
     -F "file=@trivy-results.json" \
     -F "project_id=<uuid>"

# Список findings с фильтрацией
curl "http://localhost:8080/api/v1/findings?severity=high,critical&status=open&limit=50"
```

---

## Разработка

```bash
# Только инфраструктура
docker compose up -d postgres redis

# Backend
cd backend && go run ./cmd/server

# Frontend
cd frontend && npm install && npm run dev
```

### Make-команды

```bash
make up          # docker compose up -d
make down        # docker compose down
make logs        # tail логов
make migrate     # применить миграции вручную
make seed        # загрузить тестовые данные
make build       # ./scripts/build.sh
```

### Тесты

```bash
cd backend && go test ./...
```

---

## Документация

- [Быстрый старт и развёртывание](docs/deployment.md)
- [Конфигурация](docs/configuration.md)
- [Архитектура](docs/architecture.md)
- [Модель безопасности](docs/security-model.md)
- [CI/CD (GitLab)](docs/gitlab-ci.md)
- [Резервное копирование и восстановление](docs/ops/backup-restore.md)
- [Наблюдаемость](docs/ops/observability.md)
- [Нагрузочное тестирование](docs/ops/load-testing.md)
- [Известные проблемы](docs/KNOWN_ISSUES.md)

---

## Требования

- Docker 24+ и Docker Compose v2
- 4 ГБ RAM (минимум), 8 ГБ (рекомендуется для production)
- 20 ГБ дискового пространства (для данных PostgreSQL + Redis AOF)
- Сетевой доступ к источникам обогащения (или pre-loaded данные для air-gapped)

---

## Лицензия

См. [LICENSE](LICENSE).
