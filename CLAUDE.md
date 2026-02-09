# CLAUDE.md — Red Lycoris

## Project Overview

Red Lycoris is an **Application Security Orchestration and Correlation (ASOC) platform**. It aggregates vulnerability findings from multiple security scanners (Semgrep, Trivy, Gitleaks, Grype, Checkov, KICS), deduplicates and normalizes them, and provides triage, enrichment, policy automation, and risk scoring through a web UI.

## Repository Structure

```
Red-Lycoris/
├── backend/              # Go 1.24 — Fiber REST API + workers
│   ├── cmd/
│   │   ├── server/       # Main API server (port 8080)
│   │   ├── migrate/      # Database migration runner
│   │   ├── analysis_worker/  # Processes scan reports, runs scanners via Docker
│   │   ├── intel_worker/     # Enriches findings with NVD/EPSS/KEV data
│   │   ├── sbom_worker/      # SBOM indexing
│   │   └── scancli/          # CLI tool for scanning
│   ├── internal/
│   │   ├── handlers/     # HTTP route handlers (findings, auth, products, policies, etc.)
│   │   ├── models/       # Domain models and database types
│   │   ├── storage/      # PostgreSQL data access layer
│   │   ├── dto/          # Data transfer objects (API request/response shapes)
│   │   ├── parser/       # Scanner report parsers (Semgrep, Trivy, SARIF, etc.)
│   │   ├── importing/    # Report import orchestration
│   │   ├── dedup/        # Finding deduplication via fingerprinting
│   │   ├── policies/     # OPA/Rego policy evaluation engine
│   │   ├── intel/        # Vulnerability intelligence (NVD, EPSS, KEV)
│   │   ├── risk/         # Risk scoring calculations
│   │   ├── scanners/     # Docker-based scanner execution
│   │   ├── events/       # NATS JetStream event publishing/subscribing
│   │   ├── middleware/   # Auth, RBAC, tenant isolation middleware
│   │   ├── mapper/       # DTO <-> model mapping
│   │   ├── config/       # Environment-based configuration
│   │   ├── objectstore/  # MinIO/S3 client wrapper
│   │   ├── archive/      # Archive extraction utilities
│   │   ├── metrics/      # Prometheus metrics
│   │   ├── sla/          # SLA tracking
│   │   ├── sbomindex/    # SBOM component indexing
│   │   └── server/       # Fiber app setup and routing
│   └── migrations/       # SQL migration files (sequential numbering)
├── frontend/             # React 19 + TypeScript + MUI 7
│   └── src/
│       ├── api/          # API client functions
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-level page components
│       ├── features/     # Feature-specific modules
│       ├── contexts/     # React context providers
│       ├── hooks/        # Custom React hooks
│       ├── types/        # TypeScript type definitions
│       ├── utils/        # Utility functions
│       ├── design-system/ # Design system components and tokens
│       └── dashboard-v2/ # Dashboard v2 implementation
├── python_api/           # FastAPI + Celery worker (Python 3.12+)
│   ├── app/              # Application code
│   └── tests/            # pytest test suite
├── policies/rego/        # OPA Rego policy files
│   ├── auto_assign.rego  # Auto-assignment rules
│   ├── gate_fail.rego    # SDLC gate failure conditions
│   └── sla_breach.rego   # SLA breach detection
├── nginx/                # NGINX reverse proxy with auto-TLS
├── contracts/            # OpenAPI contract tests (Schemathesis)
├── docs/                 # Architecture docs and guides
├── scripts/              # CI/CD and utility scripts
├── config/               # Configuration files
└── migrations/           # Database migration artifacts
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
| `make build` | Build Docker images without starting |
| `make down` | Stop containers |
| `make clean` | Remove containers, volumes, networks |
| `make prune` | Remove dangling images |

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
npm run build                 # Production build
npm run lint                  # ESLint
npm run test                  # Vitest unit tests
npm run storybook             # Storybook dev server (port 6006)
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

CI runs on GitHub Actions (`.github/workflows/ci.yml`) with these parallel jobs:

1. **Backend** — `gofmt -l .`, `go vet ./...`, migrations, `go test ./...` (requires PostgreSQL)
2. **Frontend** — `npm ci`, `npm run lint`, `npm run test`
3. **Python** — ruff lint + format check, `pytest` (requires Redis)
4. **Contracts** — fixture validation, Schemathesis, OpenAPI backward compatibility (depends on backend)
5. **Docker build** — builds all images (depends on all test jobs)
6. **Security** — Gitleaks, TruffleHog3, Trivy, gosec, bandit, CodeQL

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

### Service Communication
- **HTTP REST** — Fiber-based API for client-facing operations
- **NATS JetStream** — Event-driven messaging between workers (streams: ANALYSIS, INTEL, SBOM)
- **PostgreSQL 16** — Primary data store with migration-on-startup
- **Redis 7** — Celery broker/result backend for Python tasks
- **MinIO** — S3-compatible object storage for scan artifacts

### Multi-Tenancy
- All queries are scoped by `tenant_id`
- Default tenant UUID: `00000000-0000-0000-0000-000000000000`
- Tenant isolation enforced in middleware

### Authentication & Authorization
- JWT-based authentication with configurable secret
- RBAC roles: admin, analyst, viewer, etc.
- Root user bootstrapped from `ROOT_EMAIL` / `ROOT_PASSWORD` env vars

### Policy Engine
- OPA/Rego policies in `policies/rego/`
- Policy types: auto-assign, gate-fail, SLA breach
- Policies have Rego test files (`*_test.rego`) — run with `opa test`

## Code Conventions

### Go (backend)
- **Formatting**: `gofmt` enforced — no exceptions
- **Error handling**: Explicit `if err != nil` returns; no panics in library code
- **Testing**: Table-driven tests using standard `testing` package
- **Naming**: Standard Go conventions — exported PascalCase, unexported camelCase
- **Constants**: String constants for statuses/severities (`StatusNew = "new"`)
- **SQL**: Raw SQL with `lib/pq` driver; migrations in `backend/migrations/`

### TypeScript/React (frontend)
- **Strict mode**: `tsconfig.json` has `strict: true`
- **Components**: Functional components with hooks only
- **Styling**: MUI `sx` prop and Emotion — no CSS files
- **Type imports**: Use `import type { ... }` for type-only imports
- **Linting**: ESLint flat config (`eslint.config.js`) with `@typescript-eslint` and React plugins
- **Testing**: Vitest + @testing-library/react + jest-axe for accessibility

### Python (python_api)
- **Formatting/Linting**: Ruff for both (enforced in CI)
- **Type hints**: Required in function signatures
- **Naming**: snake_case everywhere
- **Security scanning**: bandit runs in CI

### Rego Policies
- Package hierarchy: `package lotus.policies.<type>`
- Each policy has a paired `*_test.rego` file
- Default decisions with conditional overrides

## Infrastructure Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Primary database |
| redis | redis:7-alpine | 6379 | Celery broker |
| nats | nats:2.10-alpine | 4222 | Event streaming |
| minio | minio/minio | 9000 | Object storage |
| nginx | custom build | 80/443 | Reverse proxy + TLS |

## Key Environment Variables

See `.env.example` for the complete list. Critical ones:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL connection
- `JWT_SECRET` — Required for authentication
- `ROOT_EMAIL`, `ROOT_PASSWORD` — Bootstrap admin credentials
- `NATS_URL` — NATS server connection string
- `OBJECT_STORE_ENDPOINT`, `OBJECT_STORE_ACCESS_KEY`, `OBJECT_STORE_SECRET_KEY` — MinIO config
- `CELERY_BROKER_URL` — Redis URL for Python Celery tasks
- `NVD_API_KEY` — Optional, for NVD vulnerability enrichment

## Documentation

- `docs/ARCHITECTURE.md` — Domain boundaries and core design principles
- `docs/api_contracts_v1.md` — REST API contract specifications
- `docs/domain_entities.md` — Domain model documentation
- `docs/guides/adding-scanner.md` — How to add a new scanner integration
- `docs/guides/evolving-dto-v1.md` — DTO versioning and evolution patterns
- `docs/guides/policies.md` — Policy system guide
- `docs/guides/risk-scoring.md` — Risk scoring methodology
- `docs/guides/sdlc-gates.md` — SDLC security gate configuration

## Common Tasks for AI Assistants

### Adding a new API endpoint
1. Define the handler in `backend/internal/handlers/`
2. Add the route in `backend/internal/server/`
3. Create DTO types in `backend/internal/dto/` if needed
4. Add storage methods in `backend/internal/storage/`
5. Write tests in the handler file (`*_test.go`)

### Adding a new scanner
Follow `docs/guides/adding-scanner.md`:
1. Add parser in `backend/internal/parser/`
2. Register scanner in `backend/internal/scanners/`
3. Add Docker image env var in `docker-compose.yml`

### Modifying the database schema
1. Create a new SQL file in `backend/migrations/` with the next sequential number
2. Migrations run automatically on startup via `cmd/migrate`

### Adding a frontend page
1. Create page component in `frontend/src/pages/`
2. Add route in the router configuration
3. Create API client functions in `frontend/src/api/`
4. Add TypeScript types in `frontend/src/types/`
