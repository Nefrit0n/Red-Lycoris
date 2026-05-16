# ASOC Platform — Red Lycoris

## Что это

Платформа для централизованного хранения, дедупликации, корреляции и обогащения уязвимостей.
Замена DefectDojo с фокусом на производительность при 1M+ findings.

**Не ASMP.** Мы не запускаем сканеры. Мы принимаем их результаты, обогащаем и приоритизируем.

Текущая версия — см. файл `VERSION` в корне (формат `MAJOR.MINOR.PATCH[suffix]`).

## Стек

- **Backend:** Go 1.25 (stdlib `net/http` + `chi` router)
- **Database:** PostgreSQL 16 (главное хранилище)
- **Cache/Queue:** Redis 7 (кэш + Redis Streams для async pipeline)
- **Frontend:** React 19 + TypeScript 5.9 + Vite 8 + TanStack (Query, Table, Virtual)
- **UI:** Tailwind CSS 4 + shadcn/ui + Base UI + Lucide icons
- **API:** REST (OpenAPI 3.1), JSON
- **Миграции:** golang-migrate (SQL-файлы)
- **Парольное хэширование:** Argon2id (`alexedwards/argon2id`)
- **HTML sanitization:** `bluemonday`
- **Excel-экспорт:** `xuri/excelize/v2`
- **Swagger UI:** `swaggest/swgui`
- **Деплой:** Docker Compose (dev и prod overlays)

## Структура проекта

```
Red-Lycoris/
├── CLAUDE.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── NOTICE
├── README.md
├── SECURITY.md
├── THIRD_PARTY_LICENSES.md
├── Makefile
├── VERSION
├── docker-compose.yml
├── docker-compose.prod.yml
├── env.example
├── vuln_seeder_ru.py              # Генератор тестовых уязвимостей (Python)
│
├── .github/
│   ├── .gitleaks.toml             # Конфиг Gitleaks для CI
│   ├── .hadolint.yaml             # Конфиг Hadolint для Dockerfile-линта
│   └── workflows/
│       ├── ci.yml
│       ├── codeql.yml
│       └── pr.yml
│
├── backend/
│   ├── Dockerfile
│   ├── go.mod / go.sum
│   ├── .golangci.yml              # Конфиг golangci-lint
│   ├── api/
│   │   └── openapi.yaml           # OpenAPI 3.1 спецификация
│   ├── cmd/
│   │   ├── server/main.go         # HTTP сервер
│   │   ├── admin/main.go          # CLI для управления пользователями
│   │   ├── seed/main.go           # Seed тестовых данных
│   │   └── loadtest/main.go       # Нагрузочное тестирование
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go          # Env-based конфиг
│   │   ├── api/
│   │   │   ├── router.go          # Chi router, маршруты
│   │   │   ├── middleware.go      # Logging, CORS, recovery
│   │   │   ├── request_id.go
│   │   │   ├── response.go        # Хелперы JSON-ответов
│   │   │   ├── ratelimit.go       # Rate limiting
│   │   │   ├── auth.go            # Login / logout
│   │   │   ├── auth_middleware.go # JWT + session проверка
│   │   │   ├── session_middleware.go
│   │   │   ├── audit_middleware.go
│   │   │   ├── admin_guards.go    # Проверки прав администратора
│   │   │   ├── admin_users.go     # Управление пользователями (admin)
│   │   │   ├── admin_users_v2.go
│   │   │   ├── admin_audit.go     # Audit log API
│   │   │   ├── api_tokens.go      # API токены
│   │   │   ├── workspace.go       # Workspace настройки
│   │   │   ├── users_search.go    # Поиск пользователей
│   │   │   ├── projects.go
│   │   │   ├── project_members.go
│   │   │   ├── scans.go
│   │   │   ├── findings.go
│   │   │   ├── findings_facets.go # Фасетная фильтрация
│   │   │   ├── triage.go          # Статусы, действия триажа
│   │   │   ├── comments.go        # Комментарии к findings
│   │   │   ├── saved_views.go     # Сохранённые фильтры
│   │   │   ├── enrichment.go      # Статус обогащения, ручной sync
│   │   │   ├── import.go          # Импорт отчётов сканеров
│   │   │   ├── export.go          # CSV / JSON / Excel экспорт
│   │   │   ├── export_html.go     # HTML-отчёты
│   │   │   ├── dashboard.go
│   │   │   ├── health.go
│   │   │   ├── version.go
│   │   │   └── docs.go            # Swagger / ReDoc endpoint
│   │   ├── domain/
│   │   │   ├── finding.go
│   │   │   ├── finding_event.go   # История изменений finding
│   │   │   ├── finding_kind.go    # Категории (vuln, secret, sast, iac…)
│   │   │   ├── project.go
│   │   │   ├── user.go            # User, UserStatus, GlobalRole
│   │   │   ├── session.go
│   │   │   ├── role.go            # ProjectRole (viewer/triager/project_admin)
│   │   │   ├── team.go
│   │   │   ├── scan.go
│   │   │   ├── api_token.go
│   │   │   ├── triage_action.go
│   │   │   ├── closure_reason.go
│   │   │   ├── admin_user_dto.go
│   │   │   ├── scoring.go         # Вычисление priority_score
│   │   │   ├── dedup.go           # Логика дедупликации (fingerprint)
│   │   │   ├── cvss/parser.go     # Парсер CVSS-строк (v2/v3/v4)
│   │   │   ├── cwe/
│   │   │   │   ├── hierarchy.go   # Иерархия CWE (parent/child)
│   │   │   │   └── mapping.go     # CWE ID → описание
│   │   │   ├── epss/trend.go      # Тренд EPSS (delta за период)
│   │   │   ├── kev/urgency.go     # Уровень срочности KEV
│   │   │   └── osv/
│   │   │       ├── ecosystem.go   # Экосистемы OSV
│   │   │       └── ranges.go      # Диапазоны версий OSV
│   │   ├── storage/
│   │   │   ├── postgres.go        # Пул, хелперы pgx
│   │   │   ├── cache.go           # Redis-хелперы
│   │   │   ├── findings_repo.go
│   │   │   ├── finding_events_repo.go
│   │   │   ├── projects_repo.go
│   │   │   ├── users_repo.go
│   │   │   ├── user_project_roles_repo.go
│   │   │   ├── sessions_repo.go
│   │   │   ├── scans_repo.go
│   │   │   ├── api_tokens_repo.go
│   │   │   ├── saved_views_repo.go
│   │   │   ├── closure_reasons_repo.go
│   │   │   ├── audit_log_repo.go
│   │   │   ├── workspace_repo.go
│   │   │   ├── dashboard_repo.go
│   │   │   ├── admin_users_query.go
│   │   │   └── matview_refresher.go
│   │   ├── auth/
│   │   │   ├── service.go         # Login, сессии
│   │   │   ├── token.go           # JWT / session токены
│   │   │   ├── password.go        # Argon2id хэширование
│   │   │   └── api_tokens.go      # Генерация/проверка API токенов
│   │   ├── audit/
│   │   │   └── writer.go          # Запись audit log событий
│   │   ├── enrichment/
│   │   │   ├── pipeline.go        # Оркестрация обогащения
│   │   │   ├── enrich.go          # Применение обогащения к findings
│   │   │   ├── worker.go          # Worker для async pipeline
│   │   │   ├── scheduler.go       # Cron-расписание sync
│   │   │   ├── nvd/
│   │   │   │   ├── sync.go        # NVD API 2.0 syncer
│   │   │   │   ├── cpe.go         # CPE matching для NVD
│   │   │   │   └── refs.go        # Ссылки NVD (advisories, patches)
│   │   │   ├── epss/sync.go       # EPSS CSV daily sync
│   │   │   ├── kev/sync.go        # CISA KEV JSON sync
│   │   │   ├── bdu/sync.go        # БДУ ФСТЭК XML sync
│   │   │   ├── osv/sync.go        # OSV GCS bucket sync
│   │   │   ├── cwe/sync.go        # CWE XML sync
│   │   │   └── cpe/sync.go        # CPE dictionary sync
│   │   ├── parser/
│   │   │   ├── parser.go          # Интерфейс парсера
│   │   │   ├── detect.go          # Автоопределение формата
│   │   │   ├── generic.go         # Универсальный JSON формат
│   │   │   ├── sarif.go           # SARIF 2.1.0
│   │   │   ├── trivy.go           # Trivy JSON
│   │   │   ├── grype.go           # Grype JSON (Anchore)
│   │   │   ├── trufflehog.go      # TruffleHog v3 (NDJSON + array)
│   │   │   ├── gitleaks.go        # Gitleaks JSON
│   │   │   ├── gosec.go           # gosec JSON (Go SAST)
│   │   │   ├── semgrep.go         # Semgrep JSON
│   │   │   ├── checkov.go         # Checkov JSON (IaC)
│   │   │   └── zap.go             # OWASP ZAP JSON
│   │   ├── export/
│   │   │   ├── html.go            # HTML-отчёты по findings
│   │   │   └── templates/
│   │   │       └── report.html.tmpl
│   │   ├── observability/
│   │   │   ├── health.go
│   │   │   └── metrics.go         # Prometheus-метрики
│   │   ├── loadtest/              # Сценарии нагрузочного тестирования
│   │   │   ├── crypto_random.go
│   │   │   ├── httpclient.go
│   │   │   ├── real_cves.go
│   │   │   ├── sarif_generate.go
│   │   │   ├── sarif_seed.go
│   │   │   ├── scenario_browse.go
│   │   │   ├── scenario_dashboard.go
│   │   │   ├── scenario_export.go
│   │   │   └── report.go
│   │   └── version/
│   │       └── version.go         # Версия (из VERSION файла)
│   └── migrations/                # 001..030 (см. раздел «Миграции»)
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── components.json            # shadcn/ui конфиг
│   ├── eslint.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── assets/                # Логотипы, hero-картинки
│       ├── api/
│       │   ├── client.ts          # Fetch wrapper
│       │   ├── auth.ts
│       │   ├── findings.ts
│       │   ├── projects.ts
│       │   ├── enrichment.ts
│       │   ├── dashboard.ts
│       │   ├── comments.ts
│       │   ├── saved-views.ts
│       │   ├── project-security.ts # Участники проекта / API токены
│       │   ├── admin-users.ts
│       │   ├── audit.ts
│       │   └── version.ts
│       ├── store/
│       │   ├── filters.ts         # Zustand: фильтры findings
│       │   └── findings-selection.ts
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
│       │   └── admin/access/      # RBAC-управление
│       │       ├── AccessPageShell.tsx
│       │       ├── UsersListView.tsx
│       │       ├── GroupsPlaceholder.tsx
│       │       ├── RolesPlaceholder.tsx
│       │       └── UserDetailPlaceholder.tsx
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── RequireAuth.tsx    # Guard для роутов
│       │   ├── ErrorBoundary.tsx
│       │   ├── CodeSnippet.tsx
│       │   ├── FindingsTable.tsx
│       │   ├── ImportUpload.tsx
│       │   ├── DashboardWidgets.tsx
│       │   ├── EnrichmentTabs.tsx
│       │   ├── PriorityScore.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── findings/          # Таблица findings и связанное
│       │   │   ├── FlatFindingsTable.tsx
│       │   │   ├── GroupedFindingsTable.tsx
│       │   │   ├── FiltersPanel.tsx
│       │   │   ├── FindingsToolbar.tsx
│       │   │   ├── BulkActionsBar.tsx
│       │   │   ├── BulkStatusCommentDialog.tsx
│       │   │   ├── CloseFindingDialog.tsx
│       │   │   ├── AssignFindingPopover.tsx
│       │   │   ├── PreviewPanel.tsx
│       │   │   ├── FindingHistory.tsx
│       │   │   ├── CommentForm.tsx
│       │   │   ├── CommentList.tsx
│       │   │   ├── SeverityBadge.tsx
│       │   │   ├── KindBadge.tsx
│       │   │   ├── KindTabs.tsx
│       │   │   ├── EnrichmentBadges.tsx
│       │   │   ├── SavedViewsBar.tsx
│       │   │   ├── GroupActionsMenu.tsx
│       │   │   ├── ColumnChooser.tsx
│       │   │   ├── ProjectPill.tsx
│       │   │   ├── columns.tsx
│       │   │   └── findingsTableConfig.ts
│       │   ├── enrichment/        # Вкладки обогащения
│       │   │   ├── NvdSection.tsx
│       │   │   ├── EpssSection.tsx
│       │   │   ├── KevSection.tsx
│       │   │   ├── BduSection.tsx
│       │   │   ├── OsvSection.tsx
│       │   │   ├── CweSection.tsx
│       │   │   ├── CvssBreakdown.tsx
│       │   │   └── cvss-metrics.ts
│       │   ├── admin/access/      # Управление пользователями / RBAC
│       │   │   ├── UsersTable.tsx
│       │   │   ├── UsersToolbar.tsx
│       │   │   ├── UsersBulkBar.tsx
│       │   │   ├── UserKebabMenu.tsx
│       │   │   ├── UserStatusBadge.tsx
│       │   │   ├── CreateUserModal.tsx
│       │   │   ├── FilterPopover.tsx
│       │   │   ├── GroupsCell.tsx
│       │   │   ├── LastLoginCell.tsx
│       │   │   ├── MfaCell.tsx
│       │   │   ├── RoleBadge.tsx
│       │   │   ├── SourceBadge.tsx
│       │   │   └── AvatarInitials.tsx
│       │   ├── projects/
│       │   │   └── CreateProjectWizardDialog.tsx
│       │   └── ui/                # shadcn/ui примитивы
│       ├── hooks/
│       │   ├── use-hotkey.ts
│       │   ├── use-expanded-groups.ts
│       │   ├── use-local-storage.ts
│       │   └── admin/
│       │       ├── usePasswordStrength.ts
│       │       ├── useUserActionsAvailability.ts
│       │       └── useUsersFilters.ts
│       ├── lib/
│       │   ├── severity.ts
│       │   ├── finding-kind.ts
│       │   ├── findings-filter.ts
│       │   ├── project-color.ts
│       │   ├── project-wizard.ts
│       │   ├── projects-list-utils.ts
│       │   ├── projects-query.ts
│       │   ├── local-storage.ts
│       │   ├── string.ts
│       │   └── utils.ts
│       └── types/
│           └── index.ts
│
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   ├── deployment.md
│   ├── security-model.md
│   ├── network_requirements.md
│   ├── gitlab-ci.md
│   ├── KNOWN_ISSUES.md
│   ├── ops/
│   │   ├── backup-restore.md
│   │   ├── migrations.md
│   │   └── observability.md
│   └── release-notes/
│
├── licenses/
│   ├── backend-licenses.md
│   ├── frontend-licenses.json
│   ├── frontend-licenses.md
│   └── go-licenses.tpl
│
├── ops/
│   └── backup/
│       ├── backup.sh
│       ├── restore.sh
│       └── verify.sh
│
├── deployments/
│   └── docker-compose.prod.yml    # Overlay для production
│
└── scripts/
    ├── build.sh                              # Сборка образов
    ├── seed.sh                               # Генерация тестовых данных
    ├── build-third-party-licenses.ps1        # Сборка списка лицензий (PS)
    └── frontend-licenses-to-md.cjs           # Frontend-лицензии → Markdown
```

## Соглашения по коду

### Go Backend

- **Go 1.25.** Никаких пре-1.25 хаков.
- **Нет ORM.** Только raw SQL через `pgx/v5`. Запросы пишем руками — никакого GORM/Ent.
- **Нет sqlc / кодогенерации.** Проще руками — меньше магии.
- **Chi router** — минимальный, совместим со stdlib.
- **Структура хендлера:** принимает `http.ResponseWriter, *http.Request`, парсит вход, вызывает domain/storage, возвращает JSON через хелперы из `response.go`.
- **Ошибки** возвращаются как `error`, не паникуем. В хендлерах — `respondError(w, status, code, msg)`.
- **Конфиг** — только через env-переменные. `internal/config/config.go` заполняется из `os.Getenv` с дефолтами.
- **Логирование** — `slog` (stdlib). Structured JSON в production.
- **Контекст** — `context.Context` пробрасывается через все слои.
- **Пул соединений** — один `pgxpool.Pool` на приложение, передаётся через DI (в конструкторы).
- **Миграции** — SQL в `backend/migrations/`, применяются через golang-migrate при старте `cmd/server` (или вручную через CLI).
- **Тесты** — `_test.go` рядом с файлом, table-driven для domain-логики. Интеграционные тесты — по запросу, через testcontainers.
- **Пароли** — Argon2id (`alexedwards/argon2id`), никаких bcrypt.
- **HTML экспорт** — обязательно через `bluemonday` (UGC policy) для пользовательского контента.
- **Линтер** — `golangci-lint` с конфигом `backend/.golangci.yml`.

### SQL

- Все таблицы — `snake_case`.
- Primary key — `UUID` (`gen_random_uuid()`).
- Timestamp — всегда `TIMESTAMPTZ`.
- Массивы — `TEXT[]` или `INT[]` для CVE/CWE ID.
- JSONB — только для сырых данных и полуструктурированных полей.
- Индексы именуются: `idx_{table}_{columns}`.
- `raw_findings` партиционируется по `imported_at` (RANGE, помесячно).
- `audit_log` — партиционирование по времени (см. миграцию 014).
- **Cursor-based пагинация** везде. Никаких `OFFSET`.
- Никаких `SELECT *`. Только явный список колонок.

### React Frontend

- **React 19**, функциональные компоненты + хуки. Никаких классов.
- **React Router v7** — маршрутизация (`react-router-dom`).
- **TanStack Query** для серверного стейта. Никаких `useEffect` + `fetch`.
- **TanStack Table** для таблиц с сортировкой/фильтрацией.
- **TanStack Virtual** для виртуализации длинных списков.
- **Zustand** для клиентского стейта (фильтры, UI state).
- **Tailwind CSS 4** через `@tailwindcss/vite`. Никакого CSS-in-JS.
- **shadcn/ui** — примитивы (Button, Dialog, Select, Badge, Tabs, Card, Dropdown и т. п.) в `components/ui/`.
- **Base UI** (`@base-ui/react`) — для сложных композитных компонентов, где shadcn не хватает.
- **Иконки** — `lucide-react`.
- **TypeScript strict mode** — никаких `any`.
- **Язык интерфейса:** весь текст, который виден пользователю, — на русском.
- **Форматы:** даты через `date-fns`, числа — `Intl.NumberFormat`.
- **Markdown** — `react-markdown` + `remark-gfm`, обязательно с `rehype-sanitize`.
- **Подсветка кода** — `prism-react-renderer`.
- **Тесты** — `vitest`, файлы `*.test.ts(x)` рядом с исходником.

### Cookie / Auth соглашения

- Имя cookie для сессии: **`rl_session`**.
- API токены — bearer-токены, заголовок `Authorization: Bearer <token>`.

### API Контракт

Все ответы:
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

OpenAPI 3.1 спецификация — `backend/api/openapi.yaml`. Swagger UI отдаётся хендлером `internal/api/docs.go`.

## Модель данных (ключевые сущности)

### Finding
```go
type Finding struct {
    ID               uuid.UUID  `json:"id"`
    Title            string     `json:"title"`
    Description      string     `json:"description,omitempty"`
    Severity         int        `json:"severity"`         // 0=info,1=low,2=med,3=high,4=crit
    Confidence       int        `json:"confidence"`       // 0=low,1=med,2=high,3=confirmed
    Status           int        `json:"status"`           // 0=open,1=confirmed,2=fp,3=resolved,4=risk_accepted
    FilePath         string     `json:"file_path,omitempty"`
    LineStart        int        `json:"line_start,omitempty"`
    LineEnd          int        `json:"line_end,omitempty"`
    Component        string     `json:"component,omitempty"`
    ComponentVersion string     `json:"component_version,omitempty"`
    CVEIDs           []string   `json:"cve_ids"`
    CWEIDs           []int      `json:"cwe_ids"`
    CPEURI           string     `json:"cpe_uri,omitempty"`
    Fingerprint      string     `json:"fingerprint"`
    FirstSeen        time.Time  `json:"first_seen"`
    LastSeen         time.Time  `json:"last_seen"`
    TimesSeen        int        `json:"times_seen"`
    ProjectID        uuid.UUID  `json:"project_id"`
    SourceType       string     `json:"source_type"`
    PriorityScore    *float64   `json:"priority_score,omitempty"`
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

// ProjectRole — роль пользователя в конкретном проекте.
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

Где `recency = 10 * exp(-days_since_published / 365)`, `exposure` — конфигурируемый коэффициент.

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

Для секретов используется отдельный fingerprint (см. миграцию 030).

Если finding с таким fingerprint уже есть:
- Обновить `last_seen = now()`
- Инкрементировать `times_seen`
- НЕ создавать новую запись

## Миграции

Файлы в `backend/migrations/`, применяются golang-migrate. Каждая миграция имеет пару `*.up.sql` / `*.down.sql`.

| #   | Описание |
|-----|----------|
| 001 | init (базовая схема findings/projects) |
| 002 | enrichment_tables |
| 003 | materialized_views |
| 004 | findings_categories |
| 005 | users_sessions |
| 006 | user_project_roles |
| 007 | saved_views |
| 008 | closure_reasons |
| 009 | findings_triage |
| 010 | finding_events |
| 011 | audit_log |
| 012 | cvss_v2_columns |
| 013 | epss_history |
| 014 | audit_log_current_partitions |
| 015 | kev_full_fields |
| 016 | bdu_full_fields |
| 017 | audit_log_enriched_fields |
| 018 | projects_list_view_fields |
| 019 | projects_sla_visibility |
| 020 | teams |
| 021 | user_enhancements |
| 022 | user_credentials |
| 023 | user_identities |
| 024 | session_enhancements_mfa |
| 025 | roles_permissions |
| 026 | groups_project_access |
| 027 | api_tokens_and_scans |
| 028 | access_schema_hardening |
| 029 | findings_perf_indexes |
| 030 | secret_fingerprint |

Новая миграция добавляется как следующий номер по порядку; уже применённые миграции не редактируем.

## Поддерживаемые парсеры

| Парсер | Формат | Тип уязвимостей |
|--------|--------|-----------------|
| SARIF 2.1.0 | JSON | SAST (универсальный) |
| Trivy | JSON | Container / OS CVE |
| Grype (Anchore) | JSON | Container / OS CVE |
| TruffleHog v3 | NDJSON / JSON array | Secrets |
| Gitleaks | JSON | Secrets |
| gosec | JSON | Go SAST |
| Semgrep | JSON | SAST |
| Checkov | JSON | IaC |
| OWASP ZAP | JSON | DAST |
| Generic | JSON | Универсальный fallback |

Автоопределение формата — `internal/parser/detect.go`.

## Обогащение — источники

| База | URL | Формат | Частота |
|------|-----|--------|---------|
| NVD | `https://services.nvd.nist.gov/rest/json/cves/2.0` | JSON API | 2 часа (инкремент) |
| EPSS | `https://epss.cyentia.com/epss_scores-{date}.csv.gz` | CSV gzip | Ежедневно |
| KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | JSON | 6 часов |
| БДУ | `https://bdu.fstec.ru/files/documents/vulxml.zip` | XML в ZIP | Еженедельно |
| OSV | `https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/all.zip` | JSON в ZIP | Ежедневно |
| CWE | `https://cwe.mitre.org/data/xml/cwec_latest.xml.zip` | XML в ZIP | Ежемесячно |
| CPE | `https://services.nvd.nist.gov/rest/json/cpes/2.0` | JSON API | Еженедельно |

Расписание — `internal/enrichment/scheduler.go`. Ручной запуск — `make sync` или `POST /api/v1/enrichment/sync/{source}`.

## Docker & Make

- `docker-compose.yml` — для разработки (hot reload Vite, открытые порты).
- `docker-compose.prod.yml` + `deployments/docker-compose.prod.yml` — production (nginx, только API порт наружу).
- Backend: multi-stage build (Go build → минимальный alpine).
- Frontend: multi-stage build (npm build → nginx).
- PostgreSQL 16 / Redis 7 — с volumes.
- Все настройки — через `env.example` → `.env`.

Ключевые `make` цели:

| Цель | Что делает |
|------|------------|
| `make dev` | Поднимает dev-стек (Vite hot reload) |
| `make dev-d` | То же, в фоне |
| `make prod` | Поднимает prod-стек |
| `make prod-down` | Останавливает prod-стек |
| `make migrate` | Запускает миграции через backend контейнер |
| `make seed` | Генерирует ~100k тестовых findings |
| `make sync` | Прогоняет sync всех источников обогащения |
| `make logs` / `make logs-api` | Логи всех / только backend |
| `make ps` | Статус сервисов |
| `make stop` / `make clean` | Стоп (с/без volumes) |
| `make build` / `make build-prod` | Сборка образов |

## CI / Качество кода

`.github/workflows/`:
- `ci.yml` — основные проверки (build, lint, тесты).
- `pr.yml` — PR-валидация.
- `codeql.yml` — статический анализ.

Дополнительно:
- `.github/.gitleaks.toml` — конфиг для поиска секретов.
- `.github/.hadolint.yaml` — линт Dockerfile.
- `backend/.golangci.yml` — конфиг golangci-lint.

## Правила для Claude Code

1. **Не добавляй зависимости** без явной просьбы. Сначала stdlib Go / уже подключённые пакеты.
2. **Не создавай файлы**, которых нет в структуре выше, без явной просьбы. Если файл нужен — упомяни и обоснуй.
3. **Каждый SQL-запрос** оптимизирован: без `SELECT *`, без `OFFSET`, использует подготовленные выражения и индексы.
4. **Никаких абстракций «на будущее».** Интерфейс появляется только когда есть 2+ реализации.
5. **Frontend:** не используй `useEffect` для загрузки данных — только TanStack Query.
6. **Тесты:** table-driven для domain-логики. Интеграционные — по запросу.
7. **Комментарии:** только «почему», а не «что». Код должен быть самодокументируемым.
8. **Ошибки:** оборачивай с контекстом — `fmt.Errorf("storage.FindByID: %w", err)`.
9. **Никаких глобальных переменных.** Всё через DI (конструкторы).
10. **Git:** один промт = один логический коммит. Осмысленные сообщения.
11. **UI-текст** — на русском. Идентификаторы, ключи, API-поля — на английском.
12. **Никакого `any` в TS.** Если тип сложный — типизируй через `unknown` + narrowing или generic.
