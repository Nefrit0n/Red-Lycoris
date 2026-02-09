# CLAUDE.md — Red Lycoris

## Project Overview

Red Lycoris is an **Application Security Orchestration and Correlation (ASOC) platform**. It aggregates vulnerability findings from multiple security scanners, deduplicates and normalizes them, and provides triage, enrichment, policy automation, and risk scoring through a web UI.

**Supported scanners (20 parsers):** Semgrep, Trivy, Gitleaks, Grype, Checkov, KICS, Bandit, GoSec, CodeQL, Snyk, Nuclei, ZAP, TFSec, Terrascan, Detect-Secrets, TruffleHog, npm-audit, pip-audit, SARIF (generic), plain text.

## Repository Structure

```
Red-Lycoris/
├── backend/                  # Go 1.24 — Fiber REST API + workers
│   ├── cmd/
│   │   ├── server/           # Main API server (port 8080)
│   │   ├── migrate/          # Database migration runner
│   │   ├── analysis_worker/  # Processes scan reports, runs scanners via Docker
│   │   ├── intel_worker/     # Enriches findings with NVD/EPSS/KEV data
│   │   ├── sbom_worker/      # SBOM indexing
│   │   └── scancli/          # CLI tool for scanning
│   ├── internal/
│   │   ├── handlers/         # HTTP route handlers (~35 files)
│   │   ├── models/           # Domain models and database types (~15 files)
│   │   ├── storage/          # PostgreSQL data access layer (~50 files)
│   │   ├── dto/v1/           # Data transfer objects (versioned, API shapes)
│   │   ├── parser/           # Scanner report parsers (20 formats, see above)
│   │   ├── importing/        # Report import orchestration + plugin registry
│   │   ├── dedup/            # Finding deduplication via fingerprinting
│   │   ├── policies/         # OPA/Rego policy evaluation engine
│   │   ├── intel/            # Vulnerability intelligence (NVD, EPSS, KEV)
│   │   ├── risk/             # Risk scoring calculations
│   │   ├── scanners/         # Docker-based scanner execution
│   │   ├── events/           # NATS JetStream event publishing/subscribing
│   │   ├── middleware/       # Auth, RBAC, tenant isolation middleware
│   │   ├── mapper/v1/        # DTO <-> model mapping (versioned)
│   │   ├── config/           # Environment-based configuration
│   │   ├── objectstore/      # MinIO/S3 client wrapper
│   │   ├── archive/          # Archive extraction utilities
│   │   ├── metrics/          # Prometheus metrics
│   │   ├── sla/              # SLA tracking
│   │   ├── sbomindex/        # SBOM component indexing
│   │   └── server/           # Fiber app setup and routing
│   └── migrations/           # SQL migration files (41 migrations, sequential numbering)
├── frontend/                 # React 19 + TypeScript + MUI 7
│   └── src/
│       ├── api/              # API client functions (12 modules)
│       ├── components/       # Reusable UI components (37+ files, filters/ subdir)
│       ├── pages/            # Route-level page components (22 pages)
│       ├── features/         # Feature-specific modules (analyze/, findings/, filters/)
│       ├── contexts/         # React context providers (Notification, Theme)
│       ├── hooks/            # Custom React hooks (17 hooks)
│       ├── types/            # TypeScript type definitions (8 modules)
│       ├── utils/            # Utility functions (12 files)
│       ├── design-system/    # Design system: tokens, theme, components, docs
│       ├── dashboard-v2/     # Dashboard v2: widgets, templates, layouts
│       └── test/             # Test setup (setup.ts)
├── python_api/               # FastAPI + Celery worker (Python 3.12+)
│   ├── app/                  # Application code (main, celery_app, tasks)
│   └── tests/                # pytest test suite
├── policies/rego/            # OPA Rego policy files
│   ├── auto_assign.rego      # Auto-assignment rules
│   ├── gate_fail.rego        # SDLC gate failure conditions
│   └── sla_breach.rego       # SLA breach detection
├── nginx/                    # NGINX reverse proxy with self-signed TLS
├── contracts/                # OpenAPI contract tests (Schemathesis + fixtures)
├── docs/                     # Architecture docs, guides, UX specs, scanner templates
├── scripts/                  # CI/CD and utility scripts
├── config/                   # Configuration files
├── shared/                   # Shared resources
├── Makefile                  # Docker orchestration targets
├── docker-compose.yml        # 12 services (app + infra)
└── .env.example              # Environment variable template
```

## Quick Start

```bash
cp .env.example .env
docker compose up --build
# UI: https://localhost:443 (NGINX gateway)
# Frontend dev: http://localhost:5173
# Backend API: http://localhost:8080
```

## Build & Run Commands

### Docker (primary workflow)

| Command | Description |
|---------|-------------|
| `make dev` | Start all services with hot-reload |
| `make prod` | Start in production mode |
| `make build` | Build development images |
| `make build-prod` | Build production images |
| `make down` | Stop containers |
| `make clean` | Remove containers, volumes, networks |
| `make prune` | Remove dangling images and build cache |
| `make prune-all` | Remove ALL unused images (caution!) |
| `make disk` | Show Docker disk usage |

### Backend (Go)

```bash
cd backend
go run ./cmd/server           # Start API server
go run ./cmd/migrate          # Run database migrations
go test ./...                 # Run all tests
go vet ./...                  # Static analysis
gofmt -l .                   # Check formatting (must produce no output)
```

### Frontend (TypeScript/React)

```bash
cd frontend
npm ci                        # Install dependencies (use ci, not install)
npm run dev                   # Vite dev server (port 5173)
npm run build                 # Production build (Vite)
npm run lint                  # ESLint
npm run test                  # Vitest unit tests
npm run preview               # Preview production build (port 4173)
npm run storybook             # Storybook dev server (port 6006)
npm run build-storybook       # Build Storybook static site
```

### Python API

```bash
cd python_api
pip install -r requirements.txt
pytest --cov=app --cov-report=term-missing   # Tests with coverage
ruff check .                  # Lint
ruff format --check .         # Format check
```

## CI Pipeline

CI runs on GitHub Actions (`.github/workflows/ci.yml`) with these jobs:

### Parallel test jobs
1. **backend** — Go 1.24: `gofmt -l .`, `go vet ./...`, migrations, `go test ./...` (PostgreSQL 16 service)
2. **frontend** — Node 20: `npm ci`, `npm run lint`, `npm run test`
3. **python** — Python 3.12: ruff lint + format check, `pytest` (Redis 7 service)

### Dependent jobs
4. **contracts** — (depends on backend) fixture validation, Schemathesis API testing, OpenAPI backward compatibility via oasdiff
5. **docker** — (depends on backend + frontend + python + contracts) builds all Docker images with cache
6. **security-fast** — (depends on backend + frontend + python) Gitleaks, Trivy (fs + config), gosec, bandit, TruffleHog3
7. **security-codeql** — (public repos only) CodeQL SAST for Go, Python, JavaScript/TypeScript
8. **dependency-review** — (public PRs only) dependency security audit
9. **summary** — CI summary table

**All four test jobs (backend, frontend, python, contracts) must pass before Docker build runs.**

### Running CI checks locally

```bash
# Backend
cd backend && gofmt -l . && go vet ./... && go test ./...

# Frontend
cd frontend && npm ci && npm run lint && npm run test

# Python
cd python_api && ruff check . && ruff format --check . && pytest --cov=app
```

## Architecture Notes

### Docker Compose Services (12 total)

| Service | Image / Build | Purpose |
|---------|---------------|---------|
| nginx | custom (nginx/) | Reverse proxy, self-signed TLS, ports 80/443 |
| db-migrate | backend (one-shot) | Database migrations + root user bootstrap |
| nats-init | natsio/nats-box (one-shot) | Creates ANALYSIS, INTEL, SBOM JetStream streams |
| backend | backend/Dockerfile:runtime | Main REST API server (port 8080) |
| analysis-worker | backend/Dockerfile:analysis-worker | Scanner execution via Docker-out-of-Docker |
| intel-worker | backend/Dockerfile:intel-worker | NVD/EPSS/KEV enrichment |
| python-api | python_api/ | FastAPI async service (port 8000) |
| celery-worker | python_api/ | Celery async task worker |
| postgres | postgres:16-alpine | Primary database |
| redis | redis:7-alpine | Celery broker / result backend |
| nats | nats:2.10-alpine | JetStream event streaming |
| minio | minio/minio:RELEASE.2025-09-07 | S3-compatible object storage |

### Service Communication
- **HTTP REST** — Fiber-based API for client-facing operations
- **NATS JetStream** — Event-driven messaging between workers (streams: ANALYSIS, INTEL, SBOM)
- **PostgreSQL 16** — Primary data store; migrations run via one-shot `db-migrate` service
- **Redis 7** — Celery broker/result backend for Python tasks
- **MinIO** — S3-compatible object storage for scan artifacts

### Startup Order
1. Infrastructure starts: postgres, redis, nats, minio (with health checks)
2. One-shot init: `db-migrate` runs migrations, `nats-init` creates JetStream streams
3. Application starts: backend, analysis-worker, intel-worker, python-api, celery-worker
4. Gateway starts: nginx (depends on backend + python-api healthy)

### Multi-Tenancy
- All queries are scoped by `tenant_id`
- Default tenant UUID: `00000000-0000-0000-0000-000000000000`
- Tenant isolation enforced in middleware

### Authentication & Authorization
- JWT-based authentication with configurable `JWT_SECRET`
- RBAC roles: admin, analyst, viewer, etc.
- Root user bootstrapped from `ROOT_EMAIL` / `ROOT_PASSWORD` env vars during migration

### Policy Engine
- OPA/Rego policies in `policies/rego/`
- Policy types: auto-assign, gate-fail, SLA breach
- Policies have Rego test files (`*_test.rego`) — run with `opa test`
- Example policies in `docs/policies/examples/`

## Code Conventions

### Go (backend)
- **Go version**: 1.24.6 (toolchain 1.24.12)
- **Module**: `red-lycoris/backend`
- **Formatting**: `gofmt` enforced — no exceptions
- **Error handling**: Explicit `if err != nil` returns; no panics in library code
- **Testing**: Table-driven tests using standard `testing` package
- **Naming**: Standard Go conventions — exported PascalCase, unexported camelCase
- **Constants**: String constants for statuses/severities (`StatusNew = "new"`)
- **SQL**: Raw SQL with `lib/pq` driver; migrations in `backend/migrations/`
- **DTO versioning**: DTOs live under `dto/v1/`, mappers under `mapper/v1/`

### TypeScript/React (frontend)
- **Node version**: 20
- **Key deps**: React 19, MUI 7, Vite 6, TypeScript 5.5, Vitest 4, Storybook 8
- **Strict mode**: `tsconfig.json` has `strict: true`
- **Components**: Functional components with hooks only
- **Styling**: MUI `sx` prop and Emotion — no CSS files
- **Type imports**: Use `import type { ... }` for type-only imports
- **Linting**: ESLint flat config (`eslint.config.js`) with `@typescript-eslint` and React plugins
- **Testing**: Vitest + @testing-library/react + jest-axe for accessibility
- **Design system**: Custom tokens (colors, typography, spacing) in `src/design-system/`

### Python (python_api)
- **Python version**: 3.12+ (Dockerfile uses 3.14-slim)
- **Key deps**: FastAPI 0.128, Celery 5.6, Gunicorn 24, httpx 0.28
- **Formatting/Linting**: Ruff for both (enforced in CI)
- **Type hints**: Required in function signatures
- **Naming**: snake_case everywhere
- **Security scanning**: bandit runs in CI

### Rego Policies
- Package hierarchy: `package lotus.policies.<type>`
- Each policy has a paired `*_test.rego` file
- Default decisions with conditional overrides

## Key Environment Variables

Defined in `.env.example` (ports, DB, Redis, Gunicorn) and `docker-compose.yml` YAML anchors (full config):

### Core (`.env.example`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` — PostgreSQL
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` — Redis / Celery
- `VITE_API_URL` — Frontend API endpoint
- `SSL_DOMAIN` — Self-signed certificate domain
- `GUNICORN_WORKERS`, `GUNICORN_WORKER_CLASS`, `GUNICORN_TIMEOUT` — Python API server

### Additional (docker-compose.yml defaults)
- `JWT_SECRET` — **Required** for authentication (no default)
- `ROOT_EMAIL`, `ROOT_PASSWORD` — Bootstrap admin credentials (defaults: root@localhost / root)
- `NATS_URL` — NATS server (default: nats://nats:4222)
- `OBJECT_STORE_ENDPOINT`, `OBJECT_STORE_ACCESS_KEY`, `OBJECT_STORE_SECRET_KEY`, `OBJECT_STORE_BUCKET` — MinIO config
- `NVD_API_KEY` — Optional, for NVD vulnerability enrichment
- `EPSS_ENABLED`, `KEV_URL` — Intelligence enrichment toggles
- `ANALYSIS_SEMGREP_IMAGE`, `ANALYSIS_TRIVY_IMAGE`, etc. — Scanner Docker image overrides

## Documentation

### Architecture & API
- `docs/ARCHITECTURE.md` — Domain boundaries and core design principles
- `docs/api_contracts_v1.md` — REST API contract specifications
- `docs/domain_entities.md` — Domain model documentation
- `docs/dev-rate-limit.md` — Rate limiting configuration
- `docs/index.md` — Documentation index

### Guides (`docs/guides/`)
- `adding-scanner.md` — How to add a new scanner integration
- `evolving-dto-v1.md` — DTO versioning and evolution patterns
- `intel.md` — Vulnerability intelligence enrichment
- `policies.md` — Policy system guide
- `policy-lifecycle.md` — Policy lifecycle management
- `report-versions.md` — Report version handling
- `risk-scoring.md` — Risk scoring methodology
- `sdlc-gates.md` — SDLC security gate configuration

### UX & Design (`docs/ux/`)
- `BRAND_TOKENS.md` — Brand identity tokens
- `COMPONENT_SPECIFICATIONS.md` — Component design specs
- `SMART_VIEWS_SPECIFICATION.md` — Smart views feature spec
- `TRIAGE_DASHBOARD_UX.md` — Triage dashboard UX design
- `logo/` — SVG logo assets

### Scanner Templates (`docs/template/`)
- 30+ example scanner report fixtures (JSON + SARIF) for all supported scanners
- Used for parser development and contract testing

### Policy Examples (`docs/policies/examples/`)
- `auto_triage_recommend.rego`, `break_build_critical_fix.rego`, `sla_critical_age.rego`

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/start.sh` | Service startup helper |
| `scripts/gate-check.sh` | SDLC gate validation |
| `scripts/analysis_snapshot_e2e.sh` | End-to-end analysis testing |
| `scripts/ci/github-actions-gate-check.yml` | GitHub Actions gate check template |
| `scripts/ci/gitlab-ci-gate-check.yml` | GitLab CI gate check template |
| `scripts/contracts/validate_fixtures.py` | Contract fixture validation |
| `scripts/contracts/run_schemathesis.sh` | Schemathesis API testing |
| `scripts/contracts/check_openapi_compat.sh` | OpenAPI backward compatibility check |

## Common Tasks for AI Assistants

### Adding a new API endpoint
1. Define the handler in `backend/internal/handlers/`
2. Add the route in `backend/internal/server/`
3. Create DTO types in `backend/internal/dto/v1/` if needed
4. Add storage methods in `backend/internal/storage/`
5. Add mapper functions in `backend/internal/mapper/v1/` if needed
6. Write tests in the handler file (`*_test.go`)

### Adding a new scanner parser
Follow `docs/guides/adding-scanner.md`:
1. Add parser in `backend/internal/parser/` (implement the parser interface)
2. Register in `backend/internal/parser/registry.go`
3. Add scanner Docker image env var in `docker-compose.yml` analysis env anchor
4. Add example report fixture in `docs/template/`

### Modifying the database schema
1. Create a new SQL file in `backend/migrations/` with the next sequential number (currently at 041)
2. Create both `NNN_description.up.sql` and `NNN_description.down.sql`
3. Migrations run automatically on startup via the `db-migrate` one-shot service

### Adding a frontend page
1. Create page component in `frontend/src/pages/`
2. Add route in the router configuration
3. Create API client functions in `frontend/src/api/`
4. Add TypeScript types in `frontend/src/types/`
5. Use design system tokens from `frontend/src/design-system/` for consistent styling

### Adding a Rego policy
1. Create policy file in `policies/rego/` following `package lotus.policies.<type>`
2. Create paired test file `*_test.rego`
3. Run with `opa test policies/rego/`
4. See examples in `docs/policies/examples/`
