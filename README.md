# Lotus Warden

Каркас проекта с React + TypeScript (MUI), Go Fiber API, PostgreSQL и Redis.

## Быстрый старт

```bash
make dev
```

Либо напрямую:

```bash
docker compose up --build
```

Frontend будет доступен на `http://localhost:5173`, backend на `http://localhost:8080`.

## Конфигурация

Переменные окружения находятся в `.env` и `config/.env`. Для локальной разработки значения по умолчанию уже заданы.

Основные переменные:

- `APP_PORT` — порт backend.
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` — параметры PostgreSQL.
- `REDIS_URL` — адрес Redis.
- `VITE_API_URL` — URL backend для фронтенда.

## API

- `GET /health` — проверка здоровья.
- `GET /api/ping` — ответ `Hello World`.

## Миграции

Миграции лежат в `backend/migrations` и применяются при старте backend.

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

## CI/CD

GitHub Actions выполняет:

- linting для Go и TypeScript,
- unit-тесты для frontend и backend,
- сборку Docker-образов,
- шаг деплоя в тестовое окружение (заглушка).
