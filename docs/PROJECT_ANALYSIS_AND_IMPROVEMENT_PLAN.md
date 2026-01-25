# Комплексный анализ проекта Lotus-Warden

## Краткое описание проекта

**Lotus-Warden** — это ASOC (Application Security Operations Center) платформа для:
- Импорта и триажа уязвимостей из различных сканеров (Trivy, Semgrep, ZAP, SARIF)
- Обогащения данных через NVD, EPSS, KEV
- Risk-скоринга и SLA-контроля
- Policy-as-code через OPA/Rego
- SBOM-управления

---

## Технологический стек

| Компонент | Технологии |
|-----------|------------|
| Backend API | Go 1.24, Fiber v2.52.5 |
| Frontend | React 18.3, TypeScript 5.5, MUI v5 |
| Workers | Go (analysis, intel, SBOM), Python + Celery |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, NATS JetStream |
| Storage | MinIO (S3-compatible) |
| Gateway | NGINX 1.27 with TLS |
| CI/CD | GitHub Actions |

---

## 1. Fullstack Developer

### Сильные стороны
- Чистое разделение: Go API + React SPA + Python workers
- RESTful API с OpenAPI спецификацией
- Строгая TypeScript типизация
- Clean Architecture в Go (handlers → storage → models)

### Проблемы
- Нет стратегии API versioning (только `/v1/`)
- TypeScript DTOs и Go structs не синхронизированы автоматически
- Нет OpenAPI codegen для клиента

---

## 2. Web-Designer

### Сильные стороны
- Dark theme, современный визуальный стиль
- MUI Icons с семантическими иконками
- Консистентная цветовая система по severity

### Проблемы
- Нет Design System документации (Storybook отсутствует)
- Нет Figma/Sketch файлов
- Ограниченная брендинговость

---

## 3. UX/UI Designer

### Сильные стороны
- Логичная информационная архитектура
- Loading states везде (Skeletons, spinners)
- Keyboard navigation (CommandPalette с Cmd+K)
- Bulk actions с select all

### Проблемы
- Нет Onboarding для новых пользователей
- Нет Undo операций для bulk delete
- Нет User Preferences page
- Нет Keyboard Shortcuts Help (`?`)

---

## 4. Frontend Developer

### Сильные стороны
- 13 custom React hooks
- TypeScript strict mode
- Правильная организация: pages/, components/, hooks/, api/
- Performance: useMemo, useCallback, AbortController

### Проблемы
- Нет React Query / SWR
- Нет Error Boundaries
- Нет i18n (hardcoded русский текст)
- FindingsTable.tsx = 1550 строк (нужен рефакторинг)

---

## 5. AppSec инженер

### Сильные стороны
- JWT + bcrypt authentication
- RBAC middleware
- SQL Injection: parameterized queries везде
- Input validation: go-playground/validator

### КРИТИЧЕСКИЕ ПРОБЛЕМЫ

| Проблема | Severity | Файл |
|----------|----------|------|
| Hardcoded credentials в `.env` | CRITICAL | `.env`, `docker-compose.yml` |
| JWT_SECRET в git | CRITICAL | `.env` |
| DB SSL disabled | HIGH | `config.go` |
| CSP header commented out | MEDIUM | `nginx/default.conf:82` |
| No account lockout | MEDIUM | `auth.go` |
| No JWT refresh tokens | MEDIUM | `middleware/jwt.go` |

---

## 6. DevSecOps инженер

### Сильные стороны
- GitHub Actions CI с parallel jobs
- Trivy scanning в CI (fs + config)
- Container security: non-root, multi-stage, Alpine
- Policy-as-code: OPA/Rego
- Contract testing: Schemathesis, oasdiff

### Проблемы
- Нет SAST в CI (Semgrep только как target)
- Нет dependency scanning (npm audit / govulncheck)
- Нет image scanning для Docker
- Нет secrets scanning (gitleaks/truffleHog)
- Python tests `|| true` — failures игнорируются

---

## 7. Security архитектор

### Сильные стороны
- Multi-tenancy (TenantID в JWT claims)
- Defense in Depth (NGINX → Go → DB)
- Audit Logging (IP, User-Agent, Request ID)
- TLS 1.2/1.3 с современными ciphers

### Архитектурные gaps
- Нет WAF
- Нет Service Mesh для inter-service auth
- Нет at-rest encryption
- Нет key rotation

---

## 8. Pentester / Red Team

### Найденные векторы атаки

| Вектор | Risk | Детали |
|--------|------|--------|
| JWT token 24h expiry | Medium | Stolen token valid too long |
| No brute-force protection | High | 10 req/s = 864k attempts/day |
| Default credentials | Critical | `root:root`, `minioadmin:minioadmin` |
| SSRF в intel worker | Medium | External fetches |

---

## 9. Security QA

### Покрытие тестами
- Auth handlers: частичное
- RBAC: есть `roles_test.go`
- Input validation: минимальное

### Отсутствующие тесты
- Negative auth tests
- RBAC bypass attempts
- Input fuzzing
- Rate limit tests
- Concurrent access (race conditions)

---

## 10. Product Owner / Business

### Бизнес-ценность
- Multi-scanner import: Trivy, Semgrep, ZAP, SARIF
- Risk scoring: EPSS + asset criticality
- SLA tracking с breach detection
- Policy gates через OPA/Rego
- SBOM management

### Missing Features
- JIRA/ServiceNow integration
- Slack/Teams notifications
- SSO (SAML/OIDC)
- Scheduled scans
- Custom dashboards

---

## 11. Compliance / GRC

### Compliance Status

| Standard | Requirement | Status |
|----------|-------------|--------|
| SOC2 | Access Controls | ✅ RBAC |
| SOC2 | Audit Logging | ⚠️ Needs retention policy |
| SOC2 | Encryption at Rest | ❌ Not implemented |
| PCI-DSS | MFA | ❌ Not implemented |
| PCI-DSS | Key Management | ❌ Keys in plaintext |

---

# План улучшений

## Фаза 0: Критические исправления (Немедленно)

| # | Задача | Детали |
|---|--------|--------|
| 0.1 | Удалить secrets из git | `.env`, очистить историю |
| 0.2 | Внедрить secrets manager | Vault/AWS Secrets Manager |
| 0.3 | Включить DB SSL | `DB_SSLMODE=require` |
| 0.4 | Сменить default credentials | `ROOT_PASSWORD`, MinIO |
| 0.5 | Включить CSP header | `nginx/default.conf:82` |

## Фаза 1: Безопасность (Sprint 1-2)

| # | Задача | Детали |
|---|--------|--------|
| 1.1 | Account lockout | 5 попыток → блок 15 мин |
| 1.2 | JWT refresh tokens | Access: 15 мин, Refresh: 7 дней |
| 1.3 | Rate limiting на login | 5 req/min |
| 1.4 | SAST в CI | Semgrep для Go/TS |
| 1.5 | Secrets scanning | gitleaks/truffleHog |
| 1.6 | MFA support | TOTP |

## Фаза 2: DevSecOps (Sprint 3-4)

| # | Задача | Детали |
|---|--------|--------|
| 2.1 | Dependency scanning | npm audit, govulncheck |
| 2.2 | Container image scanning | Trivy для images |
| 2.3 | SBOM generation | Syft для собственных images |
| 2.4 | Policy gates в CI | OPA/Conftest для Dockerfile |
| 2.5 | Fix Python tests | Убрать `|| true` |

## Фаза 3: Frontend (Sprint 5-6)

| # | Задача | Детали |
|---|--------|--------|
| 3.1 | React Query | Заменить manual fetching |
| 3.2 | Error Boundaries | На уровне app и pages |
| 3.3 | i18n (react-i18next) | Вынести все строки |
| 3.4 | Рефакторинг FindingsTable | Разбить 1550 строк |
| 3.5 | OpenAPI codegen | Генерация API клиента |

## Фаза 4: UX/UI (Sprint 7-8)

| # | Задача | Детали |
|---|--------|--------|
| 4.1 | Onboarding wizard | Guided tour |
| 4.2 | Keyboard shortcuts help | `?` → показать шорткаты |
| 4.3 | Undo для bulk operations | 10 сек undo |
| 4.4 | Tooltips на risk score | Объяснение расчёта |
| 4.5 | User preferences | Timezone, notifications |

## Фаза 5: Compliance (Sprint 9-12)

| # | Задача | Для стандарта |
|---|--------|---------------|
| 5.1 | Audit log retention | SOC2 |
| 5.2 | Password policy | PCI-DSS |
| 5.3 | Session timeout | SOC2, PCI |
| 5.4 | Data encryption at rest | SOC2, PCI |
| 5.5 | Security documentation | ISO27001 |

## Фаза 6: Интеграции (Sprint 13-17)

| # | Задача | Бизнес-ценность |
|---|--------|-----------------|
| 6.1 | SSO (SAML/OIDC) | ⭐⭐⭐⭐⭐ |
| 6.2 | JIRA integration | ⭐⭐⭐⭐⭐ |
| 6.3 | Slack/Teams notifications | ⭐⭐⭐⭐ |
| 6.4 | Webhooks | ⭐⭐⭐⭐ |
| 6.5 | Scheduled scans | ⭐⭐⭐⭐ |

## Фаза 7: Архитектура (Long-term)

| # | Задача | Impact |
|---|--------|--------|
| 7.1 | Service Mesh | High |
| 7.2 | WAF (ModSecurity) | High |
| 7.3 | Zero Trust Architecture | High |
| 7.4 | Database encryption (TDE) | Medium |
| 7.5 | GraphQL API | Medium |

---

## Сводная матрица приоритетов

| Фаза | Срок | Ключевые результаты |
|------|------|---------------------|
| 0 | Немедленно | Secrets убраны, DB SSL включен |
| 1 | Sprint 1-2 | Account lockout, MFA, JWT refresh |
| 2 | Sprint 3-4 | Full security pipeline в CI |
| 3 | Sprint 5-6 | React Query, Error Boundaries, i18n |
| 4 | Sprint 7-8 | Onboarding, Undo, Better UX |
| 5 | Sprint 9-12 | SOC2/PCI compliance ready |
| 6 | Sprint 13-17 | SSO, JIRA, Slack integrations |
| 7 | Long-term | Enterprise-grade architecture |

---

*Документ создан: 2026-01-25*
