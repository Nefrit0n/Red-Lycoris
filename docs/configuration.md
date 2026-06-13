# Конфигурация RedLycoris

Ниже перечислены переменные окружения приложения, Compose и `certinit`.

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
| `HTTP_PORT` | `80` | Нет | Production HTTP-порт; перенаправляет запросы на HTTPS. |
| `HTTPS_PORT` | `443` | Нет | Production HTTPS-порт frontend. |
| `ENRICHMENT_ENABLED` | `true` | Да | Включить фоновые sync/enrichment процессы. |
| `NVD_API_KEY` | `` (пусто) | Нет | API-ключ NVD для увеличенного rate limit. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Нет | Разрешённые CORS origins для backend. |
| `RL_TLS_CUSTOM_PATH` | `./tls-custom` | Нет | Каталог на хосте с пользовательскими `tls.key`, `tls.crt` и опциональным `ca.crt`. Используется только production compose. |
| `RL_TLS_CUSTOM_DIR` | `/etc/redlycoris/tls-custom` | Нет | Custom-каталог внутри контейнера `certinit`. Production compose задаёт это значение явно. |
| `RL_TLS_DIR` | `/etc/redlycoris/tls` | Нет | Runtime-каталог для `fullchain.crt`, `tls.key` и `tls-mode.conf`. Production compose использует named volume. |
| `RL_TLS_SANS` | `` (пусто) | Нет | Дополнительные DNS-имена и IP-адреса самоподписанного сертификата, разделённые запятыми, точками с запятой или пробелами. |
| `RL_HOSTNAME` | `` (пусто) | Нет | Основное DNS-имя deployment; добавляется в SAN и используется production compose для CORS origin. |

## TLS

Обычный `docker compose up` работает по HTTP и не запускает `certinit`.
Production TLS включается только при подключении `docker-compose.prod.yml`.

Режим не задаётся отдельной переменной:

- если custom-каталог пуст, используется автоматически созданный
  самоподписанный сертификат, HSTS выключен;
- если присутствуют валидные `tls.key` и `tls.crt`, используется
  пользовательский сертификат, HSTS включён;
- если custom-комплект неполный или невалидный, запуск намеренно завершается
  ошибкой.

В runtime volume создаются только следующие файлы:

- `fullchain.crt`;
- `tls.key`;
- `tls-mode.conf`.

Frontend монтирует runtime volume только для чтения. `certinit` запускается
один раз при старте compose и не выполняет фоновую ротацию.

## Экспорт отчётов об уязвимостях

Для выгрузки находок доступны endpoints:

- `GET /api/v1/findings/export.csv`
- `GET /api/v1/findings/export.json` (NDJSON)
- `GET /api/v1/findings/export.xlsx`

Экспорт использует те же query-параметры фильтрации, что и `/api/v1/findings`.
Ограничения: максимум 100000 записей на одну выгрузку; rate limit — до 3 одновременных экспортов и до 10 запросов за 5 минут на пользователя.

Для автоматизации через PAT используйте токен со scope `findings:read`.
