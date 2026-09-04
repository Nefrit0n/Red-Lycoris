# Администратор-Установка-Docker-Compose

Процедура предназначена для новой установки из исходного кода на [подготовленном узле](Администратор-Подготовка-инфраструктуры). Для существующей БД используйте процедуру [обновления](Администратор-Обновление): запуск backend автоматически изменяет схему.

Все команды выполняйте в Bash из корня репозитория. В примерах HTTP-проверок используются порты по умолчанию: API `8080`, frontend `3000`. Если измените порты, замените их и в проверках.

## Выбор режима

| Свойство | Базовый файл с `FRONTEND_TARGET=development` | Базовый файл + корневой production overlay |
| --- | --- | --- |
| Файлы | `docker-compose.yml` | `docker-compose.yml`, затем `docker-compose.prod.yml` |
| Frontend | Vite; исходники и `index.html` подключены для чтения | Собранные статические файлы и nginx; подключения исходников удалены |
| PostgreSQL и Redis | Порты опубликованы на узле | Публикация портов удалена через `!reset` |
| API и frontend | Порты опубликованы | Оба порта остаются опубликованными |
| Логи backend | `LOG_LEVEL` из `.env`, иначе `info` | Значение `warn` задано overlay |
| CORS | `http://localhost:<порт frontend>` и `http://localhost:5173` | Только `http://localhost:<порт frontend>` |
| Ресурсы | Базовые лимиты | Повышены отдельные лимиты и резервы; см. [требования](Администратор-Требования-к-инфраструктуре) |

Без `FRONTEND_TARGET` базовый файл выбирает `production`, а `env.example` задаёт `development`. Название цели `make dev` само по себе не переключает цель сборки frontend.

### Ограничения перед вводом в эксплуатацию

Не публикуйте базовую конфигурацию в недоверенной сети: она открывает PostgreSQL и Redis, причём пароль Redis в ней не задан. Production overlay закрывает эти порты, но не настраивает HTTPS и не ограничивает публикацию API и frontend адресом loopback.

Переменные `.env` используются для подстановок Compose, а не автоматически передаются приложению. В текущих файлах для backend не передаются `ENV`, `COOKIE_SECURE`, `TRUST_PROXY` и `SESSION_DURATION`; простого изменения этих строк в `.env` недостаточно. Для них остаются значения по умолчанию `config.go`, в частности `ENV=dev` и `COOKIE_SECURE=false`. Подстановка `CORS_ORIGINS` из `.env` также не предусмотрена.

Перед эксплуатацией с реальными данными подготовьте конфигурацию своего контура: HTTPS, ограничения сетевого доступа и явную передачу нужных параметров через `services.backend.environment`. При HTTPS задайте `COOKIE_SECURE=true`; включайте `TRUST_PROXY` только при контролируемом доступе через доверенный прокси. Поставляемые файлы сами по себе эту подготовку не выполняют. Описанная ниже проверка запуска не является проверкой защищённости контура.

## 1. Подготовка параметров

1. Проверьте наличие `.env`, созданного на этапе подготовки. Откройте его в редакторе и замените значения примера:

   | Переменная | Действие |
   | --- | --- |
   | `POSTGRES_DB`, `POSTGRES_USER` | Задайте до инициализации нового тома или оставьте `redlycoris` |
   | `POSTGRES_PASSWORD` | Задайте уникальный секрет; не оставляйте значение примера |
   | `BOOTSTRAP_ADMIN_EMAIL` | Задайте адрес первоначального администратора |
   | `BOOTSTRAP_ADMIN_PASSWORD` | Задайте уникальный первоначальный пароль; не используйте `admin` |
   | `BOOTSTRAP_ADMIN_FULL_NAME` | Задайте отображаемое имя |
   | `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE` | Оставьте `true`, но учтите ограничение в [первичной настройке](Администратор-Первичная-настройка) |
   | `FRONTEND_TARGET` | Для разработки задайте `development`; production overlay явно выбирает `production` |
   | `ENRICHMENT_ENABLED` | Для изолированного первого запуска задайте `false`; включение обогащения выполняйте отдельно |
   | `NVD_API_KEY` | Необязательный ключ для последующей синхронизации NVD |
   | `FRONTEND_PORT` | При необходимости измените опубликованный порт frontend |

   Опубликованный порт backend задаётся подстановкой `API_PORT` в Compose; готовой строки для него в `env.example` нет. Значение `SERVER_PORT` из `.env` не изменяет порт контейнера: в Compose задано `8080`.

   Compose собирает `DATABASE_URL` из `POSTGRES_USER`, `POSTGRES_PASSWORD` и `POSTGRES_DB` без URL-кодирования. Для этой процедуры используйте пароль БД без символов, меняющих структуру URI, например сгенерированный длинный буквенно-цифровой секрет. Не подставляйте пароль в командную строку. Строки `DATABASE_URL` и `REDIS_URL` из `.env` в данном способе запуска не заменяют адреса, заданные Compose.

2. Выберите ровно один вариант команды в текущей оболочке:

   Для разработки:

   ```bash
   dc() { docker compose -f docker-compose.yml "$@"; }
   ```

   Для production overlay:

   ```bash
   dc() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }
   ```

3. Проверьте параметры без вывода секретов:

   ```bash
   dc config --quiet
   dc config --services
   ```

Проверка результата: первая команда завершается с кодом `0`, вторая перечисляет `postgres`, `redis`, `backend`, `frontend`. Ошибка обязательного `BOOTSTRAP_ADMIN_PASSWORD` означает, что файл или значение не прочитаны. Не публикуйте полный вывод `dc config`: он содержит раскрытые секреты.

## 2. Сборка

Backend и frontend собираются локально из Dockerfile. При сборке используются базовые образы Go, Node.js, distroless и nginx; PostgreSQL и Redis загружаются как готовые образы. Зависимости Go и npm загружаются в стадиях сборки. Для изолированного контура заранее подготовьте образы, зависимости и доступные реестры; выключение обогащения не делает сборку автономной.

1. Для базового файла выполните:

   ```bash
   bash scripts/build.sh --print-metadata
   bash scripts/build.sh backend frontend
   ```

   Для production overlay вместо этих команд задайте метаданные и соберите с двумя файлами:

   ```bash
   export VERSION="$(tr -d '[:space:]' < VERSION)"
   export COMMIT="$(git rev-parse --short HEAD)"
   export BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
   dc build backend frontend
   ```

   Скрипт `scripts/build.sh` принимает один Compose-файл; повторение `-f` в его аргументах не формирует набор overlay. Поэтому production-сборка выше вызывает Compose непосредственно.

2. Загрузите образы зависимостей:

   ```bash
   dc pull postgres redis
   ```

Проверка результата: сборка и загрузка завершаются с кодом `0`; в выводе сборки нет ошибок `go build` или `npm ci`. Версия берётся из `VERSION`, ревизия — из текущей рабочей копии. Фактические метаданные запущенного API проверьте на заключительном этапе.

## 3. Первый запуск и миграции

Предупреждение: если том PostgreSQL уже содержит данные, старт backend применит к ним миграции. Сначала сделайте и проверьте резервную копию. Не удаляйте том для устранения ошибки миграции.

1. Запустите хранилища:

   ```bash
   dc up -d postgres redis
   dc exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   dc exec -T redis redis-cli ping
   ```

   Дождитесь `accepting connections` и `PONG`. Если контейнер ещё запускается, повторите проверку; при ошибке изучите `dc logs postgres redis`.

2. Запустите backend, затем frontend:

   ```bash
   dc up -d backend
   dc logs --tail=100 backend
   dc up -d frontend
   ```

   Backend вызывает `golang-migrate` с `Up()` до запуска HTTP-сервера. SQL загружается из каталога миграций, включённого в образ. Подключение каталога к подкаталогу `/docker-entrypoint-initdb.d/migrations` не заменяет этот механизм.

   Не выполняйте `make migrate` для штатного первого запуска: эта цель вызывает `./redlycoris` внутри уже работающего контейнера, то есть запускает ещё один серверный процесс, а не отдельную команду миграции.

3. Проверьте схему:

   ```bash
   dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version, dirty FROM schema_migrations;"'
   printf '%s\n' backend/migrations/*.up.sql | sort
   ```

Проверка результата: SQL возвращает версию схемы и `dirty = f`; версия соответствует последней применимой миграции из собранной ревизии. Отсутствие таблицы, `dirty = t`, ошибка миграции или несовпадение ревизий требуют остановки процедуры и диагностики. Не применяйте `force` и не редактируйте `schema_migrations` вручную в рамках установки.

## 4. Проверка установки

В текущей поставке есть расхождения в проверках состояния контейнеров. Compose проверяет backend командой `/app/admin --help`, которую CLI не поддерживает и завершает с ошибкой. В production-образе frontend проверка обращается к порту `8080`, хотя nginx слушает `3000`. Поэтому метка `unhealthy` этих контейнеров не позволяет сама по себе определить доступность приложения. Проверьте сервисы непосредственно; исправление конфигурации проверок перед автоматизированной эксплуатацией требуется отдельно.

1. Проверьте состояние и опубликованные порты:

   ```bash
   dc ps
   docker inspect redlycoris-postgres --format '{{json .NetworkSettings.Ports}}'
   docker inspect redlycoris-redis --format '{{json .NetworkSettings.Ports}}'
   ```

2. Проверьте backend с узла установки:

   ```bash
   curl --fail --silent --show-error http://localhost:8080/healthz
   curl --fail --silent --show-error http://localhost:8080/readyz
   curl --fail --silent --show-error http://localhost:8080/health
   curl --fail --silent --show-error http://localhost:8080/api/v1/version
   ```

3. Проверьте frontend и проксирование API:

   ```bash
   curl --fail --silent --show-error -o /dev/null -w '%{http_code}\n' http://localhost:3000/
   curl --fail --silent --show-error http://localhost:3000/api/v1/version
   ```

Проверка результата:

| Проверка | Ожидаемый результат |
| --- | --- |
| `dc ps` | Контейнеры запущены; PostgreSQL и Redis проходят свои проверки |
| Порты PostgreSQL и Redis с production overlay | Нет привязок портов к узлу; внутренние порты могут отображаться со значением `null` |
| `/healthz` | HTTP `200`, тело `ok` |
| `/readyz` | HTTP `200`, `status: ready`; при недоступности БД или Redis — HTTP `503` |
| `/health` | HTTP `200`, `status: ok`, у `components.database` и `components.redis` значение `status: ok` |
| `/api/v1/version` | JSON с полями `version`, `commit`, `build_date`, `go_version`; метаданные соответствуют сборке |
| Корень frontend | HTTP `200`; в браузере доступна страница входа |
| Версия через frontend | JSON API с теми же метаданными, а не HTML страницы |

Путь `/readyz` проверяйте через порт backend: nginx поставки проксирует `/api/`, а запрос к `/readyz` через frontend может вернуть страницу приложения. Успешный `/healthz` не проверяет хранилища; используйте `/readyz` и `/health` вместе с ним.

После успешных проверок выполните [первичную настройку](Администратор-Первичная-настройка). При использовании собственного HTTPS-контура дополнительно проверьте вход по его адресу и наличие флага `Secure` у cookie `rl_session` в инструментах браузера, не раскрывая значение cookie.

## Остановка без удаления данных

Предупреждение: `make clean` выполняет `docker compose down -v` и удаляет тома с данными. Не используйте эту цель для обычной остановки, повторной сборки или диагностики. Без резервной копии удалённые данные нельзя восстановить штатной процедурой приложения.

1. В оболочке с выбранной выше функцией `dc` остановите установку:

   ```bash
   dc down
   ```

2. Проверьте результат:

   ```bash
   dc ps -a
   docker volume ls
   ```

Проверка результата: контейнеры установки удалены, но ранее созданные тома PostgreSQL и Redis остаются в списке. Их фактические имена могут содержать префикс проекта Compose. При следующем `dc up -d` используйте тот же каталог и набор файлов, чтобы подключить те же данные.

## Источники реализации

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/docker-compose.yml](https://github.com/Nefrit0n/Red-Lycoris/blob/main/docker-compose.yml)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/docker-compose.prod.yml](https://github.com/Nefrit0n/Red-Lycoris/blob/main/docker-compose.prod.yml)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/env.example](https://github.com/Nefrit0n/Red-Lycoris/blob/main/env.example)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/scripts/build.sh](https://github.com/Nefrit0n/Red-Lycoris/blob/main/scripts/build.sh)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/Makefile](https://github.com/Nefrit0n/Red-Lycoris/blob/main/Makefile)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/config/config.go](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/config/config.go)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/cmd/server/main.go](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/cmd/server/main.go)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/observability/health.go](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/observability/health.go)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/health.go](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/health.go)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/cmd/admin/main.go](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/cmd/admin/main.go)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/frontend/Dockerfile](https://github.com/Nefrit0n/Red-Lycoris/blob/main/frontend/Dockerfile)

[https://github.com/Nefrit0n/Red-Lycoris/blob/main/frontend/nginx/default.conf](https://github.com/Nefrit0n/Red-Lycoris/blob/main/frontend/nginx/default.conf)
