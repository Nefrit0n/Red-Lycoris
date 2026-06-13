# Развёртывание RedLycoris

## Требования к серверу

Минимальные рекомендуемые требования:

- Ubuntu 22.04+
- 4 vCPU
- 8 GB RAM
- 50 GB SSD/NVMe
- Docker Engine + Docker Compose plugin

## Быстрый старт

Обычный compose-файл предназначен для разработки и работает по HTTP без
сертификатов:

```bash
git clone https://github.com/Nefrit0n/Red-Lycoris.git
cd Red-Lycoris
cp env.example .env
docker compose up -d
```

Проверка состояния:

```bash
docker compose ps
curl -s http://localhost:8080/health
```

При первом запуске backend автоматически создаёт bootstrap-администратора, если таблица `users` пуста.
Этот процесс не использует `seed` и не зависит от него.
Параметры bootstrap-админа задаются через `.env`:

- `BOOTSTRAP_ADMIN_EMAIL` (по умолчанию `admin@localhost`)
- `BOOTSTRAP_ADMIN_PASSWORD` (по умолчанию `admin`)
- `BOOTSTRAP_ADMIN_FULL_NAME` (по умолчанию `Administrator`)
- `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE` (по умолчанию `true`)

Рекомендуется изменить email/password перед запуском в production.

## Production с HTTPS

TLS включается только production-overlay:

```bash
mkdir -p tls-custom
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

Frontend доступен по `https://localhost` (порт задаётся через `HTTPS_PORT`).
HTTP-порт `80` используется только для перенаправления на HTTPS. One-shot
контейнер `certinit` завершается до запуска frontend.

Если каталог `tls-custom` пуст, `certinit` автоматически создаёт
самоподписанный ECDSA P-256 сертификат для `localhost`, `127.0.0.1`, `::1` и
значений из `RL_HOSTNAME`/`RL_TLS_SANS`. Сертификат хранится в named volume и
при следующих запусках переиспользуется до истечения срока действия. Для
самоподписанного сертификата HSTS не включается.

Проверка:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  ps
curl -k https://localhost/
curl -k https://localhost/api/v1/version
curl -I http://localhost/
```

### Собственный сертификат

Положите в каталог, указанный через `RL_TLS_CUSTOM_PATH` (по умолчанию
`./tls-custom`):

- `tls.key` — незашифрованный закрытый ключ PKCS#8, EC или PKCS#1;
- `tls.crt` — сертификат сервера; файл может уже содержать цепочку;
- `ca.crt` — опциональная цепочка CA, если она отсутствует в `tls.crt`.

После этого повторно запустите production compose. `certinit` проверит PEM,
срок действия и соответствие ключа сертификату, соберёт `fullchain.crt` в
runtime volume и включит HSTS.

Если присутствует только один из обязательных файлов, сертификат повреждён,
просрочен или ключ не соответствует сертификату, `certinit` завершится с
ошибкой, а frontend не запустится. Автоматического отката на самоподписанный
сертификат в этом случае нет.

Для замены сертификата обновите файлы в custom-каталоге и снова выполните:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

## Резервное копирование (PostgreSQL)

Пример ежедневного бэкапа:

```bash
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > backup_$(date +%F).sql
```

Рекомендуется хранить бэкапы на отдельном хранилище и регулярно проверять восстановление.

## Обновление

Для development:

```bash
git pull
docker compose pull
docker compose up -d --build
```

Для production используйте оба compose-файла:

```bash
git pull
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

После обновления проверьте:

- `docker compose ps`
- `docker compose logs backend --tail=200`
- `GET /health`
