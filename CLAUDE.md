# ASOC Platform — Red Lycoris

## Что это

Платформа для централизованного хранения, дедупликации, корреляции и обогащения уязвимостей.
Замена DefectDojo с фокусом на производительность при 1M+ findings.

**Не ASMP.** Мы не запускаем сканеры. Мы принимаем их результаты, обогащаем и приоритизируем.

## Стек

- **Backend:** Go 1.22+ (stdlib net/http + chi router)
- **Database:** PostgreSQL 16 (главное хранилище)
- **Cache/Queue:** Redis 7 (кэш + Redis Streams для async pipeline)
- **Frontend:** React 18 + TypeScript + Vite + TanStack (Table, Query, Virtual)
- **Стилизация:** Tailwind CSS + shadcn/ui
- **API:** REST (OpenAPI 3.1), JSON
- **Миграции:** golang-migrate
- **Деплой:** Docker Compose

## Структура проекта

```
Red-Lycoris/
├── CLAUDE.md
├── CHANGELOG.md
├── Makefile
├── VERSION
├── docker-compose.yml
├── docker-compose.prod.yml
├── env.example
├── vuln_seeder_ru.py              # Генератор тестовых уязвимостей (Python)
├── backend/
│   ├── Dockerfile
│   ├── go.mod / go.sum
│   ├── api/
│   │   └── openapi.yaml           # OpenAPI 3.1 спецификация
│   ├── cmd/
│   │   ├── server/main.go         # Точка входа HTTP-сервера
│   │   ├── admin/main.go          # CLI для управления пользователями
│   │   ├── seed/main.go           # Seed данных для разработки
│   │   └── loadtest/main.go       # Нагрузочное тестирование
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go          # Env-based конфиг
│   │   ├── api/
│   │   │   ├── router.go          # Chi router, маршруты
│   │   │   ├── middleware.go      # Logging, CORS, recovery
│   │   │   ├── response.go        # Хелперы JSON-ответов
│   │   │   ├── auth.go            # Хендлеры аутентификации (login/logout)
│   │   │   ├── auth_middleware.go # JWT + session проверка
│   │   │   ├── session_middleware.go
│   │   │   ├── audit_middleware.go
│   │   │   ├── ratelimit.go       # Rate limiting
│   │   │   ├── request_id.go
│   │   │   ├── findings.go        # Хендлеры findings
│   │   │   ├── findings_facets.go # Фасетная фильтрация
│   │   │   ├── projects.go        # Хендлеры projects
│   │   │   ├── project_members.go # Управление участниками проекта
│   │   │   ├── scans.go           # Хендлеры сканирований
│   │   │   ├── triage.go          # Хендлеры триажа (статус, комментарии)
│   │   │   ├── comments.go        # Комментарии к findings
│   │   │   ├── saved_views.go     # Сохранённые фильтры
│   │   │   ├── enrichment.go      # Хендлеры enrichment status
│   │   │   ├── import.go          # Хендлер импорта
│   │   │   ├── export.go          # Экспорт (CSV, JSON)
│   │   │   ├── export_html.go     # HTML-отчёты
│   │   │   ├── dashboard.go       # Хендлеры дашборда
│   │   │   ├── admin_users.go     # Управление пользователями (admin)
│   │   │   ├── admin_users_v2.go
│   │   │   ├── admin_guards.go    # Проверки прав администратора
│   │   │   ├── admin_audit.go     # Audit log API
│   │   │   ├── api_tokens.go      # API токены
│   │   │   ├── workspace.go       # Workspace настройки
│   │   │   ├── users_search.go    # Поиск пользователей
│   │   │   ├── health.go          # Health check endpoint
│   │   │   ├── version.go         # Version endpoint
│   │   │   └── docs.go            # Swagger/ReDoc endpoint
│   │   ├── domain/
│   │   │   ├── finding.go         # Структуры Finding
│   │   │   ├── finding_event.go   # История изменений finding
│   │   │   ├── finding_kind.go    # Категории (vuln, secret, sast, iac...)
│   │   │   ├── project.go         # Структуры Project
│   │   │   ├── user.go            # Структуры User, UserStatus, GlobalRole
│   │   │   ├── session.go         # Структуры Session
│   │   │   ├── role.go            # ProjectRole (viewer/triager/project_admin)
│   │   │   ├── team.go            # Структуры Team
│   │   │   ├── scan.go            # Структуры Scan
│   │   │   ├── api_token.go       # Структуры APIToken
│   │   │   ├── triage_action.go   # Действия триажа
│   │   │   ├── closure_reason.go  # Причины закрытия
│   │   │   ├── admin_user_dto.go  # DTO для admin API
│   │   │   ├── scoring.go         # Вычисление priority_score
│   │   │   ├── dedup.go           # Логика дедупликации (fingerprint)
│   │   │   ├── cvss/
│   │   │   │   └── parser.go      # Парсер CVSS-строк (v2/v3/v4)
│   │   │   ├── cwe/
│   │   │   │   ├── hierarchy.go   # Иерархия CWE (parent/child)
│   │   │   │   └── mapping.go     # Маппинг CWE ID → описание
│   │   │   ├── epss/
│   │   │   │   └── trend.go       # Тренд EPSS (delta за период)
│   │   │   ├── kev/
│   │   │   │   └── urgency.go     # Уровень срочности KEV
│   │   │   └── osv/
│   │   │       ├── ecosystem.go   # Экосистемы OSV
│   │   │       └── ranges.go      # Диапазоны версий OSV
│   │   ├── storage/
│   │   │   ├── postgres.go        # Подключение, пул, хелперы
│   │   │   ├── cache.go           # Redis кэш-хелперы
│   │   │   ├── findings_repo.go   # SQL-запросы findings
│   │   │   ├── projects_repo.go   # SQL-запросы projects
│   │   │   ├── users_repo.go      # SQL-запросы users
│   │   │   ├── sessions_repo.go   # SQL-запросы sessions
│   │   │   ├── scans_repo.go      # SQL-запросы scans
│   │   │   ├── api_tokens_repo.go
│   │   │   ├── user_project_roles_repo.go
│   │   │   ├── finding_events_repo.go
│   │   │   ├── saved_views_repo.go
│   │   │   ├── closure_reasons_repo.go
│   │   │   ├── audit_log_repo.go
│   │   │   ├── workspace_repo.go
│   │   │   ├── matview_refresher.go
│   │   │   ├── admin_users_query.go
│   │   │   ├── dashboard_repo.go
│   │   │   └── enrichment_repo.go  # (через enrich.go)
│   │   ├── auth/
│   │   │   ├── service.go         # Аутентификация (login, сессии)
│   │   │   ├── token.go           # JWT / session токены
│   │   │   ├── password.go        # Хэширование паролей (bcrypt)
│   │   │   └── api_tokens.go      # Генерация/проверка API токенов
│   │   ├── audit/
│   │   │   └── writer.go          # Запись audit log событий
│   │   ├── enrichment/
│   │   │   ├── pipeline.go        # Оркестрация обогащения
│   │   │   ├── enrich.go          # Применение обогащения к findings
│   │   │   ├── worker.go          # Worker для async обогащения
│   │   │   ├── scheduler.go       # Cron-расписание синхронизации
│   │   │   ├── nvd/sync.go        # NVD API 2.0 syncer
│   │   │   ├── nvd/cpe.go         # CPE matching для NVD
│   │   │   ├── nvd/refs.go        # Ссылки NVD (advisories, patches)
│   │   │   ├── epss/sync.go       # EPSS CSV daily sync
│   │   │   ├── kev/sync.go        # CISA KEV JSON sync
│   │   │   ├── bdu/sync.go        # БДУ ФСТЭК XML sync
│   │   │   ├── osv/sync.go        # OSV GCS bucket sync
│   │   │   ├── cwe/sync.go        # CWE XML sync
│   │   │   └── cpe/sync.go        # CPE dictionary sync
│   │   ├── parser/
│   │   │   ├── parser.go          # Интерфейс парсера
│   │   │   ├── detect.go          # Автоопределение формата
│   │   │   ├── sarif.go           # SARIF 2.1.0
│   │   │   ├── trivy.go           # Trivy JSON
│   │   │   ├── grype.go           # Grype JSON (Anchore)
│   │   │   ├── trufflehog.go      # TruffleHog v3 JSON (NDJSON + array)
│   │   │   ├── gitleaks.go        # Gitleaks JSON
│   │   │   ├── gosec.go           # gosec JSON (Go security)
│   │   │   ├── semgrep.go         # Semgrep JSON
│   │   │   ├── checkov.go         # Checkov JSON (IaC)
│   │   │   ├── zap.go             # OWASP ZAP JSON
│   │   │   └── generic.go         # Универсальный JSON формат
│   │   ├── export/
│   │   │   ├── html.go            # HTML-отчёты по findings
│   │   │   └── templates/
│   │   │       └── report.html.tmpl
│   │   ├── observability/
│   │   │   ├── health.go          # Health check логика
│   │   │   └── metrics.go         # Prometheus-метрики
│   │   ├── loadtest/              # Сценарии нагрузочного тестирования
│   │   │   ├── sarif_generate.go
│   │   │   ├── sarif_seed.go
│   │   │   ├── scenario_browse.go
│   │   │   ├── scenario_dashboard.go
│   │   │   ├── scenario_export.go
│   │   │   └── report.go
│   │   └── version/
│   │       └── version.go         # Версия приложения (из VERSION файла)
│   └── migrations/
│       ├── 001_init.{up,down}.sql
│       ├── 002_enrichment_tables.{up,down}.sql
│       ├── 003_materialized_views.{up,down}.sql
│       ├── 004_findings_categories.{up,down}.sql
│       ├── 005_users_sessions.{up,down}.sql
│       ├── 006_user_project_roles.{up,down}.sql
│       ├── 007_saved_views.{up,down}.sql
│       ├── 008_closure_reasons.{up,down}.sql
│       ├── 009_findings_triage.{up,down}.sql
│       ├── 010_finding_events.{up,down}.sql
│       ├── 011_audit_log.{up,down}.sql
│       ├── 012_cvss_v2_columns.{up,down}.sql
│       ├── 013_epss_history.{up,down}.sql
│       ├── 014_audit_log_current_partitions.{up,down}.sql
│       ├── 015_kev_full_fields.{up,down}.sql
│       ├── 016_bdu_full_fields.{up,down}.sql
│       ├── 017_audit_log_enriched_fields.{up,down}.sql
│       ├── 018_projects_list_view_fields.{up,down}.sql
│       ├── 019_projects_sla_visibility.{up,down}.sql
│       ├── 020_teams.{up,down}.sql
│       ├── 021_user_enhancements.{up,down}.sql
│       ├── 022_user_credentials.{up,down}.sql
│       ├── 023_user_identities.{up,down}.sql
│       ├── 024_session_enhancements_mfa.{up,down}.sql
│       ├── 025_roles_permissions.{up,down}.sql
│       ├── 026_groups_project_access.{up,down}.sql
│       ├── 027_api_tokens_and_scans.{up,down}.sql
│       ├── 028_access_schema_hardening.{up,down}.sql
│       ├── 029_findings_perf_indexes.{up,down}.sql
│       └── 030_secret_fingerprint.{up,down}.sql
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── vite.config.ts
│   ├── components.json            # shadcn/ui конфиг
│   ├── eslint.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api/
│       │   ├── client.ts          # Fetch wrapper с типами
│       │   ├── auth.ts            # API аутентификации
│       │   ├── findings.ts        # API findings
│       │   ├── projects.ts        # API projects
│       │   ├── enrichment.ts      # API enrichment
│       │   ├── dashboard.ts       # API дашборда
│       │   ├── comments.ts        # API комментариев
│       │   ├── saved-views.ts     # API сохранённых фильтров
│       │   ├── project-security.ts # API членов проекта / токенов
│       │   ├── admin-users.ts     # API администрирования пользователей
│       │   ├── audit.ts           # API audit log
│       │   └── version.ts         # API версии
│       ├── store/
│       │   ├── filters.ts         # Zustand store для фильтров findings
│       │   └── findings-selection.ts # Zustand store для выделения строк
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── ChangePassword.tsx
│       │   ├── Dashboard.tsx
│       │   ├── FindingsList.tsx
│       │   ├── FindingDetail.tsx
│       │   ├── ProjectsList.tsx
│       │   ├── ProjectDetail.tsx
│       │   ├── ProjectScans.tsx
│       │   ├── ProjectSettingsTokens.tsx
│       │   ├── Import.tsx
│       │   ├── EnrichmentStatus.tsx
│       │   ├── AdminUsers.tsx
│       │   ├── AdminAudit.tsx
│       │   └── admin/access/      # Вложенные страницы RBAC-управления
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── RequireAuth.tsx    # Guard для аутентифицированных роутов
│       │   ├── ErrorBoundary.tsx
│       │   ├── CodeSnippet.tsx
│       │   ├── FindingsTable.tsx  # TanStack Table + Virtual
│       │   ├── ImportUpload.tsx
│       │   ├── DashboardWidgets.tsx
│       │   ├── EnrichmentTabs.tsx
│       │   ├── PriorityScore.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── findings/          # Компоненты таблицы findings
│       │   │   ├── FlatFindingsTable.tsx
│       │   │   ├── GroupedFindingsTable.tsx
│       │   │   ├── FiltersPanel.tsx
│       │   │   ├── FindingsToolbar.tsx
│       │   │   ├── BulkActionsBar.tsx
│       │   │   ├── PreviewPanel.tsx
│       │   │   ├── SeverityBadge.tsx
│       │   │   ├── KindBadge.tsx
│       │   │   ├── EnrichmentBadges.tsx
│       │   │   ├── SavedViewsBar.tsx
│       │   │   ├── ColumnChooser.tsx
│       │   │   └── columns.tsx
│       │   ├── enrichment/        # Секции вкладок обогащения
│       │   │   ├── NvdSection.tsx
│       │   │   ├── EpssSection.tsx
│       │   │   ├── KevSection.tsx
│       │   │   ├── BduSection.tsx
│       │   │   ├── OsvSection.tsx
│       │   │   ├── CweSection.tsx
│       │   │   └── CvssBreakdown.tsx
│       │   ├── admin/access/      # Компоненты управления пользователями
│       │   │   ├── UsersTable.tsx
│       │   │   ├── CreateUserModal.tsx
│       │   │   └── ...
│       │   ├── projects/
│       │   │   └── CreateProjectWizardDialog.tsx
│       │   └── ui/                # shadcn/ui компоненты
│       ├── lib/
│       │   ├── severity.ts
│       │   ├── finding-kind.ts
│       │   ├── findings-filter.ts
│       │   ├── project-wizard.ts
│       │   ├── projects-query.ts
│       │   └── utils.ts
│       ├── hooks/
│       │   ├── use-hotkey.ts
│       │   ├── use-expanded-groups.ts
│       │   └── admin/             # Хуки для admin-страниц
│       └── types/
│           └── index.ts           # TypeScript типы
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   ├── deployment.md
│   ├── security-model.md
│   ├── network_requirements.md
│   ├── KNOWN_ISSUES.md
│   ├── ops/                       # Операционная документация
│   └── release-notes/
├── ops/
│   └── backup/                    # Скрипты резервного копирования
│       ├── backup.sh
│       ├── restore.sh
│       └── verify.sh
└── scripts/
    ├── build.sh                   # Сборка образов
    ├── seed.sh                    # Генерация тестовых данных
    └── sync-all.sh                # Ручной запуск всех синхронизаций
```

## Соглашения по коду

### Go Backend

- **Нет ORM.** Только raw SQL через `pgx/v5`. Запросы пишем руками, никакого GORM/Ent.
- **Нет генерации кода** типа sqlc на первом этапе. Проще руками — меньше магии.
- **Chi router** — минимальный, совместим с stdlib.
- **Структура хендлера:** принимает `http.ResponseWriter, *http.Request`, парсит input, вызывает domain/storage, возвращает JSON.
- **Ошибки** возвращаются как `error`, не паникуем. В хендлерах — `respondError(w, status, msg)`.
- **Конфиг** — только через env-переменные. Структура `Config` заполняется из `os.Getenv` с дефолтами.
- **Логирование** — `slog` (stdlib). Structured JSON в production.
- **Контекст** — `context.Context` пробрасывается через все слои для отмены и таймаутов.
- **Пул соединений** — `pgxpool.Pool`, один на приложение, передаётся через DI.
- **Миграции** — SQL файлы в `migrations/`, применяются при старте через golang-migrate.
- **Тесты** — `_test.go` рядом с файлом. Интеграционные тесты используют testcontainers.

### SQL

- Все таблицы — `snake_case`.
- Primary key — `UUID` (gen_random_uuid()).
- Timestamp — всегда `TIMESTAMPTZ`.
- Массивы — `TEXT[]` или `INT[]` для CVE/CWE ID.
- JSONB — только для сырых данных и полуструктурированных полей.
- Индексы именуются: `idx_{table}_{columns}`.
- Партиционирование `raw_findings` по `imported_at` (RANGE, помесячно).
- **Cursor-based пагинация** везде. Никаких OFFSET.

### React Frontend

- **Функциональные компоненты** + хуки. Никаких классов.
- **TanStack Query** для серверного стейта. Никаких useEffect + fetch.
- **TanStack Table** для таблиц с сортировкой и фильтрацией.
- **TanStack Virtual** для виртуализации списков (рендерить только видимые строки).
- **Zustand** для клиентского стейта (фильтры, UI state).
- **Tailwind CSS** — утилитарные классы, никакого CSS-in-JS.
- **shadcn/ui** — компоненты (Button, Dialog, Select, Badge, Tabs, Card).
- **Язык** - Весь текст который визуально отображается в интерфейсе должен быть на русском языке.
- **React Router v6** — маршрутизация.
- **Форматы:** даты через `date-fns`, числа — `Intl.NumberFormat`.
- **TypeScript strict mode** — никаких `any`.

### Cookie соглашение

- Имя cookie для сессии: `rl_session`.

### API Контракт

Все ответы в формате:
```json
{
  "data": { ... },
  "meta": {
    "total": 15000,
    "next_cursor": "eyJpZCI6...",
    "has_more": true
  }
}
```

Ошибки:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "severity must be between 0 and 4",
    "details": { ... }
  }
}
```

Cursor-based пагинация:
```
GET /api/v1/findings?limit=50&cursor=eyJpZCI6...&sort=-priority_score
```

Фильтрация:
```
GET /api/v1/findings?severity=high,critical&status=open&project_id=xxx&q=sql+injection
```

## Модель данных (ключевые сущности)

### Finding
```go
type Finding struct {
    ID               uuid.UUID   `json:"id"`
    Title            string      `json:"title"`
    Description      string      `json:"description,omitempty"`
    Severity         int         `json:"severity"`         // 0=info,1=low,2=med,3=high,4=crit
    Confidence       int         `json:"confidence"`       // 0=low,1=med,2=high,3=confirmed
    Status           int         `json:"status"`           // 0=open,1=confirmed,2=fp,3=resolved,4=risk_accepted
    FilePath         string      `json:"file_path,omitempty"`
    LineStart        int         `json:"line_start,omitempty"`
    LineEnd          int         `json:"line_end,omitempty"`
    Component        string      `json:"component,omitempty"`
    ComponentVersion string      `json:"component_version,omitempty"`
    CVEIDs           []string    `json:"cve_ids"`
    CWEIDs           []int       `json:"cwe_ids"`
    CPEURI           string      `json:"cpe_uri,omitempty"`
    Fingerprint      string      `json:"fingerprint"`
    FirstSeen        time.Time   `json:"first_seen"`
    LastSeen         time.Time   `json:"last_seen"`
    TimesSeen        int         `json:"times_seen"`
    ProjectID        uuid.UUID   `json:"project_id"`
    SourceType       string      `json:"source_type"`
    PriorityScore    *float64    `json:"priority_score,omitempty"`
}
```

### Project
```go
type Project struct {
    ID          uuid.UUID `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description,omitempty"`
    Tags        []string  `json:"tags"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

### User & RBAC
```go
type User struct {
    ID                 uuid.UUID  `json:"id"`
    Email              string     `json:"email"`
    PasswordHash       string     `json:"-"`
    FullName           string     `json:"full_name"`
    GlobalRole         GlobalRole `json:"global_role"` // 0=user, 1=admin
    Status             UserStatus `json:"status"`      // active, pending, disabled
    IsSystemAccount    bool       `json:"is_system_account"`
    MustChangePassword bool       `json:"must_change_password,omitempty"`
    LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
    CreatedAt          time.Time  `json:"created_at"`
}

// ProjectRole — роль пользователя в конкретном проекте
// 0=viewer, 1=triager, 2=project_admin
type ProjectRole int
```

### Scan
```go
type Scan struct {
    ID               uuid.UUID  `json:"id"`
    ProjectID        uuid.UUID  `json:"project_id"`
    Scanner          string     `json:"scanner"`
    Status           ScanStatus `json:"status"` // running, completed, failed
    FindingsImported int        `json:"findings_imported"`
    FindingsUpdated  int        `json:"findings_updated"`
    StartedAt        time.Time  `json:"started_at"`
    FinishedAt       *time.Time `json:"finished_at,omitempty"`
    CommitSHA        string     `json:"commit_sha"`
    Branch           string     `json:"branch"`
    TokenID          *uuid.UUID `json:"token_id,omitempty"`
}
```

### Enrichment
```go
type FindingEnrichment struct {
    FindingID  uuid.UUID       `json:"finding_id"`
    Source     string          `json:"source"`     // "nvd","epss","kev","bdu","osv","cwe"
    Data       json.RawMessage `json:"data"`
    EnrichedAt time.Time       `json:"enriched_at"`
}
```

### Scoring
```go
type FindingScore struct {
    FindingID      uuid.UUID `json:"finding_id"`
    BaseScore      float64   `json:"base_score"`
    EPSSScore      float64   `json:"epss_score"`
    EPSSPercentile float64   `json:"epss_percentile"`
    IsKEV          bool      `json:"is_kev"`
    IsBDU          bool      `json:"is_bdu"`
    PriorityScore  float64   `json:"priority_score"`
    CalculatedAt   time.Time `json:"calculated_at"`
}
```

## Формула приоритизации

```
priority_score = (
    cvss_base * 0.30 +
    epss * 100 * 0.25 +
    (10 if kev else 0) * 0.20 +
    (5 if bdu else 0) * 0.10 +
    recency * 0.10 +
    exposure * 0.05
)
```

Где `recency` = 10 * exp(-days_since_published / 365), `exposure` = конфигурируемый.

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

Если finding с таким fingerprint уже есть:
- Обновить `last_seen = now()`
- Инкрементировать `times_seen`
- НЕ создавать новую запись

## Поддерживаемые парсеры

| Парсер | Формат | Тип уязвимостей |
|--------|--------|-----------------|
| SARIF 2.1.0 | JSON | SAST (универсальный) |
| Trivy | JSON | Container/OS CVE |
| Grype (Anchore) | JSON | Container/OS CVE |
| TruffleHog v3 | NDJSON / JSON array | Secrets |
| Gitleaks | JSON | Secrets |
| gosec | JSON | Go SAST |
| Semgrep | JSON | SAST |
| Checkov | JSON | IaC |
| OWASP ZAP | JSON | DAST |
| Generic | JSON | Универсальный |

## Обогащение — источники

| База | URL | Формат | Частота |
|------|-----|--------|---------|
| NVD | `https://services.nvd.nist.gov/rest/json/cves/2.0` | JSON API | 2 часа (инкремент) |
| EPSS | `https://epss.cyentia.com/epss_scores-{date}.csv.gz` | CSV gzip | Ежедневно |
| KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | JSON | 6 часов |
| БДУ | `https://bdu.fstec.ru/files/documents/vulxml.zip` | XML в ZIP | Еженедельно |
| OSV | `https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/all.zip` | JSON в ZIP | Ежедневно |
| CWE | `https://cwe.mitre.org/data/xml/cwec_latest.xml.zip` | XML в ZIP | Ежемесячно |
| CPE | NVD CPE API `https://services.nvd.nist.gov/rest/json/cpes/2.0` | JSON API | Еженедельно |

## Docker

- `docker-compose.yml` — для разработки
- `docker-compose.prod.yml` — production overlay
- Backend: multi-stage build (Go build → scratch/alpine)
- Frontend: multi-stage build (npm build → nginx)
- PostgreSQL 16 с volume для данных
- Redis 7 с volume для persistence
- Nginx как reverse proxy
- Все конфиги через `env.example` → `.env`

## Правила для Claude Code

1. **Не добавляй зависимости без явной просьбы.** Используй stdlib Go где возможно.
2. **Не создавай файлы, которых нет в структуре выше**, без явной просьбы.
3. **Каждый SQL-запрос** должен быть оптимизирован: никаких SELECT *, никаких OFFSET, используй подготовленные выражения.
4. **Не пиши абстракции «на будущее».** Интерфейс появляется только когда есть 2+ реализации.
5. **Фронтенд:** не используй useEffect для загрузки данных — только TanStack Query.
6. **Тесты:** пиши table-driven тесты для domain-логики. Интеграционные — по запросу.
7. **Комментарии:** только «почему», а не «что». Код должен быть самодокументируемым.
8. **Ошибки:** всегда оборачивай с контекстом: `fmt.Errorf("storage.FindByID: %w", err)`.
9. **Не используй глобальные переменные.** Всё через dependency injection (конструкторы).
10. **Git:** каждый промт = один логический коммит. Пиши осмысленные commit messages.
