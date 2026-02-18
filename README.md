<p align="center">
  <img src="docs/ux/logo/logo_full.svg" alt="Red Lycoris" width="420"/>
</p>

<h3 align="center">Application Security Orchestration & Correlation Platform</h3>

<p align="center">
  <a href="https://github.com/Nefrit0n/Red-Lycoris/actions"><img src="https://github.com/Nefrit0n/Red-Lycoris/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white" alt="Go 1.24">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white" alt="Python 3.12+">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License"></a>
</p>

---

## 🇬🇧 English

### 🔍 What is Red Lycoris?

Your team runs a dozen security scanners — Semgrep, Trivy, Gitleaks, Snyk, and more. Each one produces its own report in its own format. Vulnerabilities get duplicated, priorities are unclear, and nothing talks to each other.

**Red Lycoris fixes that.** It pulls findings from 20 scanners into a single dashboard, removes duplicates, enriches them with real-world threat data, scores risk automatically, and lets you set policies so the important stuff gets handled first.

### ✨ Key Features

| | Feature | Description |
|---|---------|-------------|
| 📥 | **20 Scanner Parsers** | Semgrep, Trivy, Gitleaks, Grype, Checkov, KICS, Bandit, GoSec, CodeQL, Snyk, Nuclei, ZAP, TFSec, Terrascan, Detect-Secrets, TruffleHog, npm-audit, pip-audit, SARIF, plain text |
| 🧹 | **Smart Deduplication** | Fingerprint-based matching eliminates noise across scanners |
| 🧠 | **Threat Intelligence** | Auto-enrichment with NVD, EPSS scores, and CISA KEV catalog |
| 📊 | **Risk Scoring** | Prioritize what matters — calculated from severity, exploitability, and context |
| 📜 | **Policy Engine** | OPA/Rego rules for auto-assignment, SDLC gates, and SLA enforcement |
| 🏢 | **Multi-Tenancy** | Full tenant isolation — one instance, many teams |
| 🔐 | **RBAC** | Role-based access: admin, analyst, viewer |
| 📦 | **SBOM Support** | Software Bill of Materials indexing and tracking |

### 🖼️ Screenshots

<!-- TODO: Add screenshots before release -->
<!-- <img src="docs/assets/dashboard.png" alt="Dashboard" width="800"/> -->
<!-- <img src="docs/assets/findings.png" alt="Findings view" width="800"/> -->

> Screenshots will be added in the first public release.

### 🚀 Quick Start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

```bash
# 1. Clone the repository
git clone https://github.com/Nefrit0n/Red-Lycoris.git
cd Red-Lycoris

# 2. Create the config file
cp .env.example .env

# 3. Start everything
make dev

# 4. Open the UI
#    https://localhost:8443
```

That's it. The platform will start 12 services (database, message broker, workers, API, and frontend) — all configured and ready to go.


### ⚡ Quick start (no install)

Run `lw` without local Go toolchain/build step:

```bash
curl -fsSL https://<your-host>/lw.sh | sh -s -- upload \
  --endpoint https://localhost:8443 \
  --project my-project \
  --token "$LW_TOKEN" \
  --artifact reports/semgrep.sarif
```

Or use Python (stdlib-only bootstrap):

```bash
python3 scripts/lw.py upload \
  --endpoint https://localhost:8443 \
  --project my-project \
  --token "$LW_TOKEN" \
  --artifact reports/semgrep.sarif
```

Example GitLab CI job:

```yaml
upload_scan_results:
  stage: security
  image: alpine:3.20
  script:
    - apk add --no-cache curl python3
    - curl -fsSL https://<your-host>/lw.sh | sh -s -- upload \
        --endpoint "$LW_ENDPOINT" \
        --project "$CI_PROJECT_PATH" \
        --ci gitlab \
        --token "$LW_TOKEN" \
        --artifact gl-sast-report.json:format=sarif
```

> `--insecure` is for local/dev self-signed TLS only. For production, use a valid certificate chain or pass `--ca-file /path/to/ca.pem`.
>
> Never enable `CI_DEBUG_TRACE` to troubleshoot uploads and never print full environment variables in logs.


### 🏗️ How It Works

```
┌──────────────────────────────────────────────────────────┐
│                     Security Scanners                     │
│  Semgrep · Trivy · Gitleaks · Snyk · ZAP · 15 more...   │
└──────────────────────┬───────────────────────────────────┘
                       │ reports (JSON, SARIF, text)
                       ▼
              ┌─────────────────┐
              │   Parse & Norm  │  ← 20 format parsers
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │   Deduplicate   │  ← fingerprint matching
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │     Enrich      │  ← NVD + EPSS + KEV
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │   Score & Rank  │  ← risk calculation
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  Policy Engine  │  ← OPA/Rego rules
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │    Dashboard    │  ← triage & action
              └─────────────────┘
```

### 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | Go 1.24, Fiber |
| Frontend | React 19, TypeScript, MUI 7, Vite |
| Async Workers | Python 3.12, FastAPI, Celery |
| Database | PostgreSQL 16 |
| Message Broker | NATS JetStream |
| Cache / Queue | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Policy Engine | Open Policy Agent (Rego) |
| Proxy | NGINX with TLS |
| Infrastructure | Docker Compose (12 services) |

### 📖 Documentation

Detailed documentation lives in the [`docs/`](docs/) directory:

- Architecture and design decisions
- API contract specifications
- Guides: adding scanners, policies, risk scoring
- UX specifications and brand assets

### 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run the tests:
   ```bash
   # Backend
   cd backend && go test ./...

   # Frontend
   cd frontend && npm ci && npm run lint && npm run test

   # Python
   cd python_api && ruff check . && pytest
   ```
5. Commit and open a Pull Request

### 📄 License

[Apache License 2.0](LICENSE) — use it freely, contribute back if you can.

---

## 🇷🇺 Русский

### 🔍 Что такое Red Lycoris?

Ваша команда использует десяток сканеров безопасности — Semgrep, Trivy, Gitleaks, Snyk и другие. Каждый выдаёт свой отчёт в своём формате. Уязвимости дублируются, приоритеты непонятны, а единой картины нет.

**Red Lycoris решает эту проблему.** Платформа собирает результаты из 20 сканеров в единый дашборд, убирает дубликаты, обогащает данными об актуальных угрозах, автоматически считает риски и позволяет настроить политики, чтобы важное обрабатывалось в первую очередь.

### ✨ Ключевые возможности

| | Возможность | Описание |
|---|------------|----------|
| 📥 | **20 парсеров сканеров** | Semgrep, Trivy, Gitleaks, Grype, Checkov, KICS, Bandit, GoSec, CodeQL, Snyk, Nuclei, ZAP, TFSec, Terrascan, Detect-Secrets, TruffleHog, npm-audit, pip-audit, SARIF, plain text |
| 🧹 | **Умная дедупликация** | Сопоставление по отпечаткам устраняет шум между сканерами |
| 🧠 | **Обогащение данными** | Автоматическое обогащение из NVD, оценки EPSS и каталога CISA KEV |
| 📊 | **Скоринг рисков** | Приоритизация на основе severity, эксплуатируемости и контекста |
| 📜 | **Движок политик** | OPA/Rego-правила для авто-назначения, SDLC-гейтов и контроля SLA |
| 🏢 | **Мультитенантность** | Полная изоляция — один инстанс, много команд |
| 🔐 | **RBAC** | Ролевая модель: администратор, аналитик, наблюдатель |
| 📦 | **Поддержка SBOM** | Индексация и отслеживание Software Bill of Materials |

### 🖼️ Скриншоты

<!-- TODO: Добавить скриншоты перед релизом -->
<!-- <img src="docs/assets/dashboard.png" alt="Дашборд" width="800"/> -->
<!-- <img src="docs/assets/findings.png" alt="Список находок" width="800"/> -->

> Скриншоты будут добавлены в первом публичном релизе.

### 🚀 Быстрый старт

**Требования:** [Docker](https://docs.docker.com/get-docker/) и [Docker Compose](https://docs.docker.com/compose/install/)

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/Nefrit0n/Red-Lycoris.git
cd Red-Lycoris

# 2. Создайте файл конфигурации
cp .env.example .env

# 3. Запустите всё
make dev

# 4. Откройте UI
#    https://localhost:8443
```

Готово. Платформа поднимет 12 сервисов (база данных, брокер сообщений, воркеры, API и фронтенд) — всё настроено и готово к работе.


### ⚡ Быстрый старт (без установки)

Запуск `lw` без локального Go toolchain/сборки:

```bash
curl -fsSL https://<your-host>/lw.sh | sh -s -- upload \
  --endpoint https://localhost:8443 \
  --project my-project \
  --token "$LW_TOKEN" \
  --artifact reports/semgrep.sarif
```

Или через Python (только stdlib):

```bash
python3 scripts/lw.py upload \
  --endpoint https://localhost:8443 \
  --project my-project \
  --token "$LW_TOKEN" \
  --artifact reports/semgrep.sarif
```

Пример GitLab CI job:

```yaml
upload_scan_results:
  stage: security
  image: alpine:3.20
  script:
    - apk add --no-cache curl python3
    - curl -fsSL https://<your-host>/lw.sh | sh -s -- upload \
        --endpoint "$LW_ENDPOINT" \
        --project "$CI_PROJECT_PATH" \
        --ci gitlab \
        --token "$LW_TOKEN" \
        --artifact gl-sast-report.json:format=sarif
```

> `--insecure` используйте только в dev/self-signed окружении. В проде используйте корректный сертификат или `--ca-file /path/to/ca.pem`.
>
> Никогда не включайте `CI_DEBUG_TRACE` для дебага загрузок и не печатайте полный `env` в логах.


### 🏗️ Как это работает

```
┌──────────────────────────────────────────────────────────┐
│                    Сканеры безопасности                    │
│  Semgrep · Trivy · Gitleaks · Snyk · ZAP · и ещё 15...  │
└──────────────────────┬───────────────────────────────────┘
                       │ отчёты (JSON, SARIF, text)
                       ▼
              ┌─────────────────┐
              │  Парсинг и норм │  ← 20 парсеров форматов
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  Дедупликация   │  ← сопоставление отпечатков
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │   Обогащение    │  ← NVD + EPSS + KEV
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ Оценка рисков   │  ← расчёт скоринга
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ Движок политик  │  ← OPA/Rego правила
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │    Дашборд      │  ← триаж и действия
              └─────────────────┘
```

### 🛠️ Технологический стек

| Слой | Технология |
|------|------------|
| Backend API | Go 1.24, Fiber |
| Frontend | React 19, TypeScript, MUI 7, Vite |
| Async-воркеры | Python 3.12, FastAPI, Celery |
| База данных | PostgreSQL 16 |
| Брокер сообщений | NATS JetStream |
| Кэш / очередь | Redis 7 |
| Объектное хранилище | MinIO (S3-совместимый) |
| Движок политик | Open Policy Agent (Rego) |
| Прокси | NGINX с TLS |
| Инфраструктура | Docker Compose (12 сервисов) |

### 📖 Документация

Подробная документация находится в директории [`docs/`](docs/):

- Архитектура и проектные решения
- Спецификации API-контрактов
- Гайды: добавление сканеров, политики, скоринг рисков
- UX-спецификации и брендовые ресурсы

### 🤝 Участие в разработке

Мы рады вкладу! Как начать:

1. Сделайте форк репозитория
2. Создайте ветку (`git checkout -b feature/my-feature`)
3. Внесите изменения
4. Запустите тесты:
   ```bash
   # Backend
   cd backend && go test ./...

   # Frontend
   cd frontend && npm ci && npm run lint && npm run test

   # Python
   cd python_api && ruff check . && pytest
   ```
5. Закоммитьте и откройте Pull Request

### 📄 Лицензия

[Apache License 2.0](LICENSE) — используйте свободно, будем рады контрибуциям.
