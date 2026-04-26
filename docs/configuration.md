# Конфигурация RedLycoris

Ниже перечислены все переменные окружения из `env.example`.

| Переменная | Дефолт | Обязательна | Описание |
|---|---|---|---|
| `POSTGRES_DB` | `redlycoris` | Да | Имя базы данных PostgreSQL. |
| `POSTGRES_USER` | `redlycoris` | Да | Пользователь PostgreSQL. |
| `POSTGRES_PASSWORD` | `change_me_in_production` | Да | Пароль PostgreSQL (заменить в production). |
| `POSTGRES_PORT` | `5432` | Да | Порт PostgreSQL на хосте. |
| `REDIS_PORT` | `6379` | Да | Порт Redis на хосте. |
| `ENV` | `dev` | Да | Окружение приложения (`dev` включает API-доки). |
| `API_PORT` | `8080` | Да | Порт backend API на хосте. |
| `LOG_LEVEL` | `info` | Да | Уровень логирования (`debug`, `info`, `warn`, `error`). |
| `FRONTEND_PORT` | `3000` | Да | Порт frontend на хосте. |
| `FRONTEND_TARGET` | `production` | Да | Docker target frontend (`development`/`production`). |
| `FRONTEND_INTERNAL_PORT` | `8080` | Да | Порт frontend внутри контейнера (`8080` для production/nginx, `3000` для development/Vite). |
| `ENRICHMENT_ENABLED` | `true` | Да | Включить фоновые sync/enrichment процессы. |
| `NVD_API_KEY` | `` (пусто) | Нет | API-ключ NVD для увеличенного rate limit. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Нет | Разрешённые CORS origins для backend. |

## Экспорт отчётов об уязвимостях

Для выгрузки находок доступны endpoints:

- `GET /api/v1/findings/export.csv`
- `GET /api/v1/findings/export.json` (NDJSON)
- `GET /api/v1/findings/export.xlsx`

Экспорт использует те же query-параметры фильтрации, что и `/api/v1/findings`.
Ограничения: максимум 100000 записей на одну выгрузку; rate limit — до 3 одновременных экспортов и до 10 запросов за 5 минут на пользователя.

Для автоматизации через PAT используйте токен со scope `findings:read`.
