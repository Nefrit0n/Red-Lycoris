# ASOC Platform — Архитектурный план

## Философия проекта

**Главная ошибка DefectDojo** — он пытается быть всем сразу: и ASOC, и ASMP, и таск-трекер, и дашборд. В итоге он плохо делает всё. Мы делаем одну вещь, но делаем её отлично:

> **Централизованное хранение, дедупликация, корреляция и обогащение уязвимостей с производительностью на масштабе 1M+ findings.**

Никаких интеграций со сканерами на первом этапе. Никакого ASMP. Только ядро.

---

## Фаза 0 — Фундамент (не пропускать)

### Границы системы (что делаем, что НЕ делаем)

**Делаем (Core):**
- Импорт findings из любых источников через универсальный формат
- Дедупликация и корреляция (один и тот же баг от разных сканеров = одна запись)
- Обогащение из локальных зеркал CVE/NVD/БДУ/OSV/KEV/EPSS/CPE/CWE
- Приоритизация на основе обогащённых данных
- Быстрый поиск и фильтрация по миллионам записей
- API-first (всё через REST/gRPC)

**НЕ делаем (пока):**
- Запуск сканеров (ASMP)
- Тикет-система (пусть интегрируется с Jira/GitLab)
- CI/CD пайплайны
- Ролевая модель сложнее чем admin/viewer

### Принцип "модульного монолита"

Не микросервисы (оверкилл на старте), не монолит (потом не разобрать). Модульный монолит: один бинарник, но внутри чёткие границы между модулями с контрактами.

```
┌─────────────────────────────────────────────────┐
│                   API Gateway                    │
│              (REST + gRPC + WebSocket)            │
├──────────┬──────────┬───────────┬────────────────┤
│ Findings │ Enrichment│ Dedup     │ Analytics      │
│ Module   │ Module    │ Engine    │ Module         │
├──────────┴──────────┴───────────┴────────────────┤
│              Event Bus (внутренний)               │
├──────────────────────────────────────────────────┤
│         Storage Layer (PostgreSQL + Redis)        │
└──────────────────────────────────────────────────┘
```

---

## Фаза 1 — Стек и инфраструктура

### Технологический стек

| Компонент | Технология | Почему |
|-----------|-----------|--------|
| Backend | **Go** | Производительность, конкурентность, один бинарник. Python (FastAPI) как альтернатива, если команда не знает Go |
| Database | **PostgreSQL 16+** | Partitioning, BRIN-индексы, jsonb, full-text search |
| Cache | **Redis** | Кэш обогащения, rate limiting, pub/sub для событий |
| Search | **PostgreSQL FTS** (старт) → **Meilisearch** (масштаб) | Не тащить Elasticsearch сразу |
| Queue | **Redis Streams** (старт) → **NATS** (масштаб) | Для пайплайна обогащения |
| Frontend | **React + TypeScript** | Виртуализация списков, оптимистичный UI |
| API | **REST** (публичный) + **gRPC** (внутренний) | REST для интеграций, gRPC для скорости |

### Почему не Django/Python как DefectDojo

DefectDojo тормозит не потому что Python медленный. Он тормозит потому что:
1. Django ORM генерирует N+1 запросы на каждом шагу
2. Нет партиционирования таблиц
3. Сериализация через DRF на больших объёмах — убийца
4. Синхронная обработка обогащения
5. Фронт перерисовывает всю таблицу целиком

Go + правильный PostgreSQL + React с виртуализацией решают все 5 пунктов.

---

## Фаза 2 — Модель данных

### Ключевой принцип: разделение Raw и Normalized

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Raw Finding     │────→│ Normalized       │────→│ Enriched         │
│  (как пришло)    │     │ Finding          │     │ Finding          │
│                  │     │ (дедуплицировано)│     │ (+CVE,EPSS,KEV…) │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### Таблицы PostgreSQL

```sql
-- Партиционирование по дате создания (ключ к производительности)
CREATE TABLE raw_findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     TEXT NOT NULL,          -- "semgrep", "trivy", "bandit"...
    source_id       TEXT,                   -- ID в исходном отчёте
    raw_data        JSONB NOT NULL,         -- Оригинал без изменений
    fingerprint     TEXT NOT NULL,          -- Хэш для дедупликации
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    project_id      UUID NOT NULL
) PARTITION BY RANGE (imported_at);

-- Основная рабочая таблица
CREATE TABLE findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    severity        SMALLINT NOT NULL,      -- 0-4 (info/low/med/high/crit)
    confidence      SMALLINT,               -- 0-3
    status          SMALLINT NOT NULL DEFAULT 0, -- open/confirmed/fp/resolved/risk_accepted
    
    -- Локация
    file_path       TEXT,
    line_start      INT,
    line_end        INT,
    component       TEXT,                   -- пакет/библиотека/сервис
    component_version TEXT,
    
    -- Идентификаторы
    cve_ids         TEXT[],                 -- {"CVE-2024-1234", "CVE-2024-5678"}
    cwe_ids         INT[],                  -- {79, 89}
    cpe_uri         TEXT,
    
    -- Метаданные
    fingerprint     TEXT NOT NULL UNIQUE,   -- Дедупликация
    first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
    times_seen      INT NOT NULL DEFAULT 1,
    
    -- Связи
    project_id      UUID NOT NULL,
    
    -- Полнотекстовый поиск
    search_vector   TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(file_path, '')), 'C')
    ) STORED
);

-- BRIN-индекс для временных запросов (компактнее B-tree в 100 раз)
CREATE INDEX idx_findings_first_seen_brin ON findings USING BRIN (first_seen);
CREATE INDEX idx_findings_severity ON findings (severity) WHERE status = 0;
CREATE INDEX idx_findings_project ON findings (project_id, status);
CREATE INDEX idx_findings_cve ON findings USING GIN (cve_ids);
CREATE INDEX idx_findings_search ON findings USING GIN (search_vector);
CREATE INDEX idx_findings_fingerprint ON findings (fingerprint);

-- Обогащение хранится отдельно (не раздувает основную таблицу)
CREATE TABLE finding_enrichments (
    finding_id      UUID NOT NULL REFERENCES findings(id),
    source          TEXT NOT NULL,          -- "nvd", "epss", "kev", "bdu", "osv"
    data            JSONB NOT NULL,
    enriched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (finding_id, source)
);

-- Вычисляемый скоринг
CREATE TABLE finding_scores (
    finding_id      UUID PRIMARY KEY REFERENCES findings(id),
    base_score      REAL,                   -- CVSS base
    epss_score      REAL,                   -- EPSS probability
    epss_percentile REAL,
    is_kev          BOOLEAN DEFAULT FALSE,  -- В каталоге KEV
    is_bdu          BOOLEAN DEFAULT FALSE,  -- В БДУ ФСТЭК
    priority_score  REAL,                   -- Наш вычисляемый скоринг
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Стратегия дедупликации

Fingerprint = хэш от нормализованных полей. Алгоритм:

```
fingerprint = SHA256(
    lowercase(vulnerability_id) +   -- CVE если есть
    lowercase(file_path) +          -- Где найдено
    str(cwe_id) +                   -- Тип уязвимости
    lowercase(component) +          -- Компонент
    lowercase(component_version)    -- Версия
)
```

Если находка с таким fingerprint уже есть → обновляем `last_seen` и `times_seen`, а не создаём дубль.

---

## Фаза 3 — Локальные зеркала баз обогащения

### Архитектура синхронизации

```
┌──────────────────────────────────────────────┐
│              Sync Scheduler (cron)            │
├──────┬──────┬──────┬──────┬──────┬───────────┤
│ NVD  │ OSV  │ KEV  │ EPSS │ BDU  │ CWE/CPE  │
│ Sync │ Sync │ Sync │ Sync │ Sync │ Sync      │
├──────┴──────┴──────┴──────┴──────┴───────────┤
│           Local DB (PostgreSQL)               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌────────┐ │
│  │ nvd │ │ osv │ │ kev │ │epss │ │bdu_fstec│ │
│  └─────┘ └─────┘ └─────┘ └─────┘ └────────┘ │
└──────────────────────────────────────────────┘
```

### Источники и методы синхронизации

#### 1. NVD (National Vulnerability Database)

**API:** `https://services.nvd.nist.gov/rest/json/cves/2.0`
**Формат:** JSON
**Стратегия:**
- Полная загрузка: ~260k CVE, пагинация по 2000, ~130 запросов
- Инкрементальная: параметр `lastModStartDate` / `lastModEndDate`
- Rate limit: 5 req/30s (без ключа), 50 req/30s (с ключом)
- **Частота:** полная 1 раз/неделю, инкрементальная каждые 2 часа

```sql
CREATE TABLE nvd_cves (
    cve_id          TEXT PRIMARY KEY,       -- "CVE-2024-1234"
    description     TEXT,
    cvss_v31_score  REAL,
    cvss_v31_vector TEXT,
    cvss_v40_score  REAL,
    cvss_v40_vector TEXT,
    cwe_ids         INT[],
    cpe_matches     JSONB,                  -- Affected configurations
    references      JSONB,
    published_at    TIMESTAMPTZ,
    modified_at     TIMESTAMPTZ,
    raw_data        JSONB,                  -- Полный JSON на всякий случай
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nvd_modified ON nvd_cves (modified_at);
CREATE INDEX idx_nvd_cwe ON nvd_cves USING GIN (cwe_ids);
```

#### 2. EPSS (Exploit Prediction Scoring System)

**Источник:** `https://epss.cyentia.com/epss_scores-YYYY-MM-DD.csv.gz`
**Формат:** CSV (gzip)
**Размер:** ~200k записей, ~5MB compressed
**Стратегия:**
- Скачивать ежедневный CSV целиком (он маленький)
- COPY INTO PostgreSQL (мгновенно)
- **Частота:** ежедневно

```sql
CREATE TABLE epss_scores (
    cve_id          TEXT PRIMARY KEY,
    epss_score      REAL NOT NULL,          -- Вероятность эксплуатации (0-1)
    percentile      REAL NOT NULL,          -- Перцентиль (0-1)
    score_date      DATE NOT NULL,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 3. CISA KEV (Known Exploited Vulnerabilities)

**Источник:** `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
**Формат:** JSON
**Размер:** ~1100 записей
**Стратегия:**
- Скачивать целиком (маленький файл)
- Upsert по CVE ID
- **Частота:** каждые 6 часов

```sql
CREATE TABLE kev_catalog (
    cve_id              TEXT PRIMARY KEY,
    vendor              TEXT,
    product             TEXT,
    vulnerability_name  TEXT,
    date_added          DATE,
    due_date            DATE,               -- Дедлайн устранения по CISA
    known_ransomware    BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 4. БДУ ФСТЭК

**Источник:** `https://bdu.fstec.ru/files/documents/vulxml.zip`
**Формат:** XML внутри ZIP
**Размер:** ~50MB
**Стратегия:**
- Скачать ZIP, распаковать, парсить XML
- Маппинг BDU ID ↔ CVE ID для корреляции
- **Частота:** еженедельно (обновляется редко)

```sql
CREATE TABLE bdu_fstec (
    bdu_id          TEXT PRIMARY KEY,       -- "BDU:2024-01234"
    name            TEXT,
    description     TEXT,
    severity        TEXT,                   -- "Критический", "Высокий"...
    cvss_v3_score   REAL,
    cvss_v3_vector  TEXT,
    cve_ids         TEXT[],                 -- Связанные CVE
    cwe_ids         INT[],
    vendor          TEXT,
    product         TEXT,
    affected_versions TEXT,
    remediation     TEXT,
    published_at    DATE,
    modified_at     DATE,
    raw_data        JSONB,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bdu_cve ON bdu_fstec USING GIN (cve_ids);
```

#### 5. OSV (Open Source Vulnerabilities)

**Источник:** `https://osv-vulnerabilities.storage.googleapis.com/` (GCS bucket)
**Формат:** JSON (по экосистемам: Go, npm, PyPI, Maven и т.д.)
**Размер:** ~200k записей суммарно
**Стратегия:**
- Скачивать по экосистемам (zip-архивы)
- Хорошо для SCA — уязвимости в пакетах
- **Частота:** ежедневно

```sql
CREATE TABLE osv_vulnerabilities (
    osv_id          TEXT PRIMARY KEY,       -- "GHSA-xxxx-xxxx-xxxx", "PYSEC-2024-1"
    summary         TEXT,
    details         TEXT,
    aliases         TEXT[],                 -- CVE и другие ID
    ecosystem       TEXT,                   -- "PyPI", "npm", "Go"
    package_name    TEXT,
    affected_ranges JSONB,                  -- Версии
    severity        JSONB,                  -- CVSS
    references      JSONB,
    published_at    TIMESTAMPTZ,
    modified_at     TIMESTAMPTZ,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_osv_aliases ON osv_vulnerabilities USING GIN (aliases);
CREATE INDEX idx_osv_package ON osv_vulnerabilities (ecosystem, package_name);
```

#### 6. CWE (Common Weakness Enumeration)

**Источник:** `https://cwe.mitre.org/data/xml/cwec_latest.xml.zip`
**Формат:** XML
**Размер:** ~30MB
**Стратегия:**
- Скачать раз в месяц (меняется редко)
- Построить дерево иерархии CWE
- Нужен для: группировки findings по типу, красивых отчётов

```sql
CREATE TABLE cwe_catalog (
    cwe_id          INT PRIMARY KEY,        -- 79, 89, 502...
    name            TEXT NOT NULL,           -- "Cross-site Scripting"
    description     TEXT,
    extended_desc   TEXT,
    parent_ids      INT[],                  -- Иерархия
    category        TEXT,                   -- "Injection", "Auth"...
    likelihood      TEXT,                   -- Вероятность эксплуатации
    impact          TEXT,
    mitigations     JSONB,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 7. CPE (Common Platform Enumeration)

**Источник:** NVD CPE Dictionary API или `https://nvd.nist.gov/feeds/json/cpematch/1.0/`
**Формат:** JSON
**Стратегия:**
- Нужен для маппинга "компонент+версия" → CPE URI → CVE
- Позволяет автоматически находить CVE для конкретных версий ПО
- **Частота:** еженедельно

```sql
CREATE TABLE cpe_dictionary (
    cpe_uri         TEXT PRIMARY KEY,       -- "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*"
    vendor          TEXT NOT NULL,
    product         TEXT NOT NULL,
    version         TEXT,
    title           TEXT,
    deprecated      BOOLEAN DEFAULT FALSE,
    cve_ids         TEXT[],                 -- CVE связанные через CPE match
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cpe_vendor_product ON cpe_dictionary (vendor, product);
CREATE INDEX idx_cpe_product ON cpe_dictionary (product);
```

---

## Фаза 4 — Пайплайн обогащения

### Поток обработки

```
Finding Imported
    │
    ▼
[1. Normalize] ──→ Привести к единому формату
    │
    ▼
[2. Deduplicate] ──→ fingerprint lookup, merge если дубль
    │
    ▼
[3. Enrich: CVE/NVD] ──→ Подтянуть CVSS, description, references
    │
    ▼
[4. Enrich: EPSS] ──→ Вероятность эксплуатации
    │
    ▼
[5. Enrich: KEV] ──→ Флаг "активно эксплуатируется"
    │
    ▼
[6. Enrich: БДУ] ──→ Российский контекст, рекомендации ФСТЭК
    │
    ▼
[7. Enrich: OSV] ──→ SCA-контекст (affected versions, fixes)
    │
    ▼
[8. Enrich: CWE] ──→ Категория, описание, митигации
    │
    ▼
[9. Score] ──→ Вычислить priority_score
    │
    ▼
[10. Notify] ──→ Webhook / Event для подписчиков
```

### Формула приоритизации (priority_score)

```
priority_score = (
    cvss_base_score * 0.30 +          -- Техническая серьёзность
    epss_score * 100 * 0.25 +         -- Вероятность эксплуатации
    kev_bonus * 0.20 +                -- 10 если в KEV, 0 если нет
    bdu_bonus * 0.10 +                -- 5 если в БДУ ФСТЭК
    recency_factor * 0.10 +           -- Свежие CVE опаснее
    exposure_factor * 0.05            -- Внешний vs внутренний компонент
)
```

Это настраиваемая формула — пользователь сможет менять веса через конфиг.

---

## Фаза 5 — Производительность (почему это будет быстрее DefectDojo)

### Проблемы DefectDojo и наши решения

| Проблема DD | Наше решение |
|-------------|-------------|
| Django ORM → N+1 запросы | Raw SQL / sqlc (Go) с явными JOIN |
| Одна гигантская таблица | Партиционирование по дате + по проекту |
| Полная загрузка списков | Cursor-based пагинация (keyset) |
| Тяжёлая сериализация DRF | Прямой JSON marshal в Go |
| Синхронное обогащение | Async pipeline через Redis Streams |
| Нет кэша | Redis cache для dashboard counters, aggregations |
| Перерисовка всего DOM | React + TanStack Virtual (виртуальные списки) |
| Агрегации на лету | Materialized views, обновляемые по расписанию |

### Конкретные оптимизации PostgreSQL

```sql
-- Партиции по месяцам (автоматическое создание)
CREATE TABLE raw_findings_y2025m01 
    PARTITION OF raw_findings 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Materialized view для дашборда (обновлять раз в 5 мин)
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
    project_id,
    severity,
    status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE first_seen > now() - interval '7 days') as new_this_week,
    AVG(fs.priority_score) as avg_priority
FROM findings f
LEFT JOIN finding_scores fs ON f.id = fs.finding_id
GROUP BY project_id, severity, status;

CREATE UNIQUE INDEX ON dashboard_stats (project_id, severity, status);

-- Partial index для "открытых критичных" (самый частый запрос)
CREATE INDEX idx_open_critical ON findings (project_id, first_seen DESC)
WHERE status = 0 AND severity >= 3;
```

### Cursor-based пагинация (вместо OFFSET)

```sql
-- DefectDojo делает: OFFSET 50000 LIMIT 20 (сканирует 50020 строк)
-- Мы делаем:
SELECT * FROM findings 
WHERE project_id = $1 
  AND (first_seen, id) < ($last_seen, $last_id)
ORDER BY first_seen DESC, id DESC
LIMIT 20;
-- Всегда сканирует только 20 строк, неважно на какой странице
```

---

## Фаза 6 — Фронтенд

### Принципы

1. **Виртуальные списки** — TanStack Virtual, рендерим только видимые строки
2. **Оптимистичный UI** — статус меняется мгновенно, синк в фоне
3. **Faceted search** — фильтры как в e-commerce (severity, status, source, project)
4. **Keyboard-first** — `j/k` навигация, `/` для поиска, `s` для статуса
5. **Минимум перерисовок** — Zustand + селекторы, никакого глобального ререндера

### Ключевые экраны

```
[Dashboard]
├── Общая статистика (виджеты)
├── Тренды (новые/закрытые за неделю)
├── Top-10 по priority_score
└── Breakdown по severity/status

[Findings List]
├── Виртуальная таблица (1M строк без лагов)
├── Фасетные фильтры (левая панель)
├── Bulk actions (массовое изменение статуса)
├── Quick preview (правая панель)
└── Экспорт (CSV, JSON, PDF)

[Finding Detail]
├── Основная информация
├── Обогащение (CVE/EPSS/KEV/БДУ в табах)
├── История (timeline)
├── Связанные findings
└── Быстрые действия

[Enrichment Status]
├── Статус синхронизации каждой базы
├── Последняя синхронизация
├── Количество записей
└── Ручной запуск синхронизации
```

---

## Фаза 7 — API (универсальный импорт)

### Единый формат импорта

```json
{
  "source": "semgrep",
  "source_version": "1.56.0",
  "scan_date": "2025-01-15T10:30:00Z",
  "project": "backend-api",
  "findings": [
    {
      "source_id": "semgrep-123",
      "title": "SQL Injection in user input",
      "description": "Unsanitized user input in SQL query",
      "severity": "high",
      "confidence": "high",
      "cve_ids": ["CVE-2024-1234"],
      "cwe_ids": [89],
      "file_path": "src/api/users.py",
      "line_start": 42,
      "line_end": 45,
      "component": null,
      "component_version": null,
      "extra": {}
    }
  ]
}
```

Парсеры для конкретных сканеров (SARIF, Trivy JSON, Semgrep JSON и т.д.) — это отдельные конвертеры, которые приводят к этому формату. Можно делать постепенно.

---

## Фаза 8 — План реализации

### Этап 1 — MVP (4-6 недель)

- [ ] Схема БД + миграции
- [ ] CRUD findings через API
- [ ] Дедупликация по fingerprint
- [ ] Импорт через универсальный JSON
- [ ] Базовый фронт: список + детали + фильтры
- [ ] Один парсер (SARIF — он универсальный)

### Этап 2 — Обогащение (3-4 недели)

- [ ] Синк NVD (инкрементальный)
- [ ] Синк EPSS (ежедневный)
- [ ] Синк KEV
- [ ] Синк CWE + CPE
- [ ] Пайплайн обогащения (Redis Streams)
- [ ] Вычисление priority_score
- [ ] UI: таб обогащения в карточке finding

### Этап 3 — БДУ + OSV (2-3 недели)

- [ ] Парсер БДУ ФСТЭК (XML)
- [ ] Синк OSV по экосистемам
- [ ] Корреляция BDU ↔ CVE
- [ ] UI: статус синхронизации баз

### Этап 4 — Производительность (2 недели)

- [ ] Партиционирование таблиц
- [ ] Materialized views для дашборда
- [ ] Cursor-based пагинация
- [ ] Redis кэш для агрегаций
- [ ] Load test на 1M findings

### Этап 5 — Полировка (2-3 недели)

- [ ] Дашборд с трендами
- [ ] Экспорт (CSV, JSON)
- [ ] Webhook-уведомления
- [ ] Документация API (OpenAPI)
- [ ] Docker Compose для деплоя
- [ ] Нагрузочное тестирование

**Итого: ~13-18 недель до production-ready MVP**

---

## Структура проекта (Go)

```
asoc/
├── cmd/
│   └── server/
│       └── main.go              # Точка входа
├── internal/
│   ├── api/                     # HTTP/gRPC хендлеры
│   │   ├── findings.go
│   │   ├── enrichment.go
│   │   ├── projects.go
│   │   └── middleware.go
│   ├── domain/                  # Бизнес-логика (чистая, без зависимостей)
│   │   ├── finding.go
│   │   ├── enrichment.go
│   │   ├── dedup.go
│   │   └── scoring.go
│   ├── storage/                 # PostgreSQL репозитории
│   │   ├── findings_repo.go
│   │   ├── enrichment_repo.go
│   │   └── migrations/
│   ├── enrichment/              # Синхронизация внешних баз
│   │   ├── pipeline.go          # Оркестрация
│   │   ├── nvd/
│   │   ├── epss/
│   │   ├── kev/
│   │   ├── bdu/
│   │   ├── osv/
│   │   ├── cwe/
│   │   └── cpe/
│   ├── parser/                  # Парсеры форматов сканеров
│   │   ├── sarif.go
│   │   ├── trivy.go
│   │   └── generic.go
│   └── config/
│       └── config.go
├── web/                         # React фронтенд
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/
│   │   └── store/
│   └── package.json
├── deployments/
│   ├── docker-compose.yml
│   └── Dockerfile
├── go.mod
└── README.md
```

---

## Антипаттерны (чтобы не повторять ошибки)

1. **НЕ делай "а давай ещё добавим..."** — каждая фича проходит через вопрос "это нужно для MVP?"
2. **НЕ пиши абстракции заранее** — интерфейс пишется когда появляется второй потребитель, не раньше
3. **НЕ меняй стек на полпути** — выбрал Go, пиши на Go. Хочешь Python — ок, но определись ДО начала
4. **НЕ делай "красиво" раньше "работает"** — сначала crud, потом обогащение, потом UI, потом красота
5. **НЕ оптимизируй раньше 10k findings** — преждевременная оптимизация убивает. Партиции и кэш — на этапе 4
6. **НЕ начинай с фронта** — API-first. Фронт начинается когда API стабильно работает
