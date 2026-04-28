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
RedLycoris/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── cmd/
│   │   └── server/
│   │       └── main.go
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go           # Env-based конфиг
│   │   ├── api/
│   │   │   ├── router.go           # Chi router, маршруты
│   │   │   ├── middleware.go        # Logging, CORS, recovery
│   │   │   ├── response.go         # Хелперы JSON-ответов
│   │   │   ├── findings.go         # Хендлеры findings
│   │   │   ├── projects.go         # Хендлеры projects
│   │   │   ├── enrichment.go       # Хендлеры enrichment status
│   │   │   ├── import.go           # Хендлер импорта
│   │   │   └── dashboard.go        # Хендлеры дашборда
│   │   ├── domain/
│   │   │   ├── finding.go          # Структуры и бизнес-логика findings
│   │   │   ├── project.go          # Структуры projects
│   │   │   ├── enrichment.go       # Структуры обогащения
│   │   │   ├── scoring.go          # Вычисление priority_score
│   │   │   └── dedup.go            # Логика дедупликации (fingerprint)
│   │   ├── storage/
│   │   │   ├── postgres.go         # Подключение, пул, хелперы
│   │   │   ├── findings_repo.go    # SQL-запросы findings
│   │   │   ├── projects_repo.go    # SQL-запросы projects
│   │   │   ├── enrichment_repo.go  # SQL-запросы enrichment
│   │   │   └── dashboard_repo.go   # SQL-запросы дашборда
│   │   ├── enrichment/
│   │   │   ├── pipeline.go         # Оркестрация обогащения
│   │   │   ├── scheduler.go        # Cron-расписание синхронизации
│   │   │   ├── nvd/
│   │   │   │   └── sync.go         # NVD API 2.0 syncer
│   │   │   ├── epss/
│   │   │   │   └── sync.go         # EPSS CSV daily sync
│   │   │   ├── kev/
│   │   │   │   └── sync.go         # CISA KEV JSON sync
│   │   │   ├── bdu/
│   │   │   │   └── sync.go         # БДУ ФСТЭК XML sync
│   │   │   ├── osv/
│   │   │   │   └── sync.go         # OSV GCS bucket sync
│   │   │   ├── cwe/
│   │   │   │   └── sync.go         # CWE XML sync
│   │   │   └── cpe/
│   │   │       └── sync.go         # CPE dictionary sync
│   │   └── parser/
│   │       ├── parser.go           # Интерфейс парсера
│   │       ├── sarif.go            # SARIF 2.1.0
│   │       ├── trivy.go            # Trivy JSON
│   │       ├── trufflehog.go      # TruffleHog v3 JSON (NDJSON + array)
│   │       ├── generic.go          # Наш универсальный JSON
│   │       └── detect.go           # Автоопределение формата
│   └── migrations/
│       ├── 001_init.up.sql
│       ├── 001_init.down.sql
│       ├── 002_enrichment_tables.up.sql
│       ├── 002_enrichment_tables.down.sql
│       ├── 003_materialized_views.up.sql
│       └── 003_materialized_views.down.sql
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts            # Fetch wrapper с типами
│       │   ├── findings.ts          # API findings
│       │   ├── projects.ts          # API projects
│       │   └── enrichment.ts        # API enrichment
│       ├── store/
│       │   └── filters.ts           # Zustand store для фильтров
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── FindingsList.tsx
│       │   ├── FindingDetail.tsx
│       │   ├── ProjectsList.tsx
│       │   ├── Import.tsx
│       │   └── EnrichmentStatus.tsx
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   ├── FindingsTable.tsx     # TanStack Table + Virtual
│       │   ├── FacetedFilters.tsx
│       │   ├── SeverityBadge.tsx
│       │   ├── StatusBadge.tsx
│       │   ├── PriorityScore.tsx
│       │   ├── EnrichmentTabs.tsx
│       │   ├── DashboardWidgets.tsx
│       │   └── ImportUpload.tsx
│       └── types/
│           └── index.ts             # TypeScript типы
└── scripts/
    ├── seed.sh                      # Генерация тестовых данных
    └── sync-all.sh                  # Ручной запуск всех синхронизаций
```

## Соглашения по коду

### Go Backend

- **Нет ORM.** Только raw SQL через `pgx/v5`. Запросы пишем руками, никакого GORM/Ent.
- Для findings вида `secrets` дедупликация и группировка используют `secret_fingerprint` (SHA256), фактические значения секретов в БД не храним.
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

- На этапе 3 имя cookie для сессии фиксируется как `rl_session`.

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
    FindingID     uuid.UUID `json:"finding_id"`
    BaseScore     float64   `json:"base_score"`
    EPSSScore     float64   `json:"epss_score"`
    EPSSPercentile float64  `json:"epss_percentile"`
    IsKEV         bool      `json:"is_kev"`
    IsBDU         bool      `json:"is_bdu"`
    PriorityScore float64   `json:"priority_score"`
    CalculatedAt  time.Time `json:"calculated_at"`
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

- `docker-compose.yml` в корне проекта
- Backend: multi-stage build (Go build → scratch/alpine)
- Frontend: multi-stage build (npm build → nginx)
- PostgreSQL 16 с volume для данных
- Redis 7 с volume для persistence
- Nginx как reverse proxy (опционально, можно без него на старте)
- Все конфиги через .env

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
