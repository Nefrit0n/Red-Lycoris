# Lotus Warden

Каркас проекта с React + TypeScript (MUI), Go Fiber API, Python + Celery для фоновых задач, PostgreSQL и Redis.

## Быстрый старт

1. Скопируйте переменные окружения:

```bash
cp .env.example .env
```

2. Поднимите все сервисы:

```bash
docker compose up --build
```

Доступные сервисы:

- Frontend (Vite dev): `http://localhost:5173`
- NGINX (статический фронтенд + прокси API): `http://localhost:8081`
- Go API: `http://localhost:8080`
- Python API (через NGINX): `http://localhost:8081/api/health`

## Фоновые задачи Celery

Отправка задачи через API (NGINX проксирует в Gunicorn):

```bash
curl -X POST http://localhost:8081/api/tasks/scan \
  -H 'Content-Type: application/json' \
  -d '{"scan_id":"demo-scan","source":"curl"}'
```

Проверка статуса задачи:

```bash
curl http://localhost:8081/api/tasks/<task_id>
```

Пример запуска задачи напрямую из контейнера:

```bash
docker compose exec python-api python trigger_task.py
```

Логи выполнения задач доступны в контейнере `celery-worker`.

## Миграции PostgreSQL

Миграции лежат в `backend/migrations` и применяются автоматически при старте Go API.

Для ручного прогона миграций:

```bash
cd backend
go run ./cmd/migrate
```

## API

Go API:

- `GET /health` — проверка здоровья.
- `GET /api/ping` — ответ `Hello World`.
- `POST /api/v1/auth/login` — логин.
- `POST /api/v1/auth/change-password` — смена пароля.
- `POST /api/v1/scans/upload` — загрузка отчёта сканера.
- `GET /api/v1/findings` — список findings с фильтрами/поиском.
- `GET /api/v1/findings/{id}` — детали finding с комментариями/историей.
- `POST /api/v1/findings/{id}/comments` — добавить комментарий.
- `POST /api/v1/findings/bulk` — массовые действия.
- `GET /api/v1/import-jobs` — список импортов.
- `GET /api/v1/import-jobs/{id}` — детали импорта.
- `GET /api/v1/products` — список продуктов.

Python API (Gunicorn + FastAPI):

- `GET /api/health` — проверка здоровья.
- `POST /api/tasks/scan` — постановка задачи в очередь.
- `GET /api/tasks/{task_id}` — статус выполнения задачи.

## Тестирование

Backend:

```bash
cd backend
go test ./...
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run test
```

## Локальная разработка Frontend

```bash
cd frontend
npm install
npm run dev
```

## Быстрый флоу root → смена пароля → импорт → триаж

1. Поднимите сервисы и зайдите в UI: `http://localhost:5173` (dev) или `http://localhost:8081` (NGINX).
2. Выполните вход пользователем `root` с паролем `root`.
3. Система потребует смену пароля — задайте новый и повторите вход.
4. Перейдите в **Upload Scan** и загрузите отчёт сканера.
5. Откройте **Imports** → выберите job → перейдите к findings импорта.
6. В списке findings отметьте записи и используйте bulk-действия (смена статуса/назначение).
7. В карточке finding добавьте комментарий, проверьте историю изменений и дубликаты.

## CI/CD

GitHub Actions выполняет:

- linting для Go и TypeScript,
- unit-тесты для frontend и backend,
- прогон миграций отдельным этапом,
- сборку Docker-образов,
- шаг деплоя в тестовое окружение (заглушка).
