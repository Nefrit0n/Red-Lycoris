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

```bash
cp env.example .env
# Задайте BOOTSTRAP_ADMIN_PASSWORD в .env
docker compose up --build -d
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
# Откройте frontend по адресу FRONTEND_PORT из .env
docker compose logs -f backend
```

[Быстрый старт: от установки до первой находки](https://github.com/Nefrit0n/Red-Lycoris/wiki/Быстрый-старт-Требования).

Полная документация: [GitHub Wiki](https://github.com/Nefrit0n/Red-Lycoris/wiki). Изменения Wiki вносятся в [`wiki/`](wiki/README.md), не через веб-интерфейс GitHub Wiki.
