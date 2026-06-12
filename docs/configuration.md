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
| `FRONTEND_TARGET` | `development` | Да | Docker target frontend (`development`/`production`). |
| `ENRICHMENT_ENABLED` | `true` | Да | Включить фоновые sync/enrichment процессы. |
| `NVD_API_KEY` | `` (пусто) | Нет | API-ключ NVD для увеличенного rate limit. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Нет | Разрешённые CORS origins для backend. |

## TLS (certinit)

Переменные ниже читаются сервисом `certinit` при запуске через prod-overlay (`docker-compose.prod.yml`).
В dev-режиме (`docker-compose.yml` без overlay) они не используются.

| Переменная | Дефолт | Описание |
|---|---|---|
| `RL_TLS_DIR` | `/etc/redlycoris/tls` | Runtime-каталог (named volume). Сюда certinit пишет `fullchain.crt`, `tls.key`, `nginx-tls-snippet.conf`, `conf.d/tls-server.conf`. |
| `RL_TLS_CUSTOM_DIR` | `/etc/redlycoris/tls-custom` | Каталог с пользовательскими сертификатами (bind-mount read-only). Если пуст — используется self-signed режим. |
| `RL_HOSTNAME` | `""` | Дополнительное DNS-имя в SAN самоподписанного сертификата (например, `myserver.example.com`). |
| `RL_TLS_SANS` | `""` | Дополнительные SAN через запятую (DNS-имена и/или IP). Применяются только в self-signed режиме. |

В самоподписанный сертификат всегда включаются `localhost`, `127.0.0.1`, `::1`.

`CORS_ORIGINS` в prod-overlay по умолчанию выставляется в `https://localhost`. При использовании реального домена задайте явно:

```dotenv
CORS_ORIGINS=https://your-domain.example.com
```

## Экспорт отчётов об уязвимостях

Для выгрузки находок доступны endpoints:

- `GET /api/v1/findings/export.csv`
- `GET /api/v1/findings/export.json` (NDJSON)
- `GET /api/v1/findings/export.xlsx`

Экспорт использует те же query-параметры фильтрации, что и `/api/v1/findings`.
Ограничения: максимум 100000 записей на одну выгрузку; rate limit — до 3 одновременных экспортов и до 10 запросов за 5 минут на пользователя.

Для автоматизации через PAT используйте токен со scope `findings:read`.
