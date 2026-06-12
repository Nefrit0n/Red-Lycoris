# Развёртывание RedLycoris

## Требования к серверу

Минимальные рекомендуемые требования:

- Ubuntu 22.04+
- 4 vCPU
- 8 GB RAM
- 50 GB SSD/NVMe
- Docker Engine + Docker Compose plugin

## Быстрый старт

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

## HTTPS (TLS)

### Автоматический самоподписанный сертификат

При запуске через prod-overlay сервис `certinit` стартует раньше nginx и автоматически генерирует самоподписанный сертификат ECDSA P-256 (825 дней), если в каталоге пользовательских сертификатов нет файлов:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

После старта:

- `http://localhost` → автоматический редирект на `https://localhost`
- `https://localhost` → SPA (самоподписанный сертификат; браузер покажет предупреждение)

Чтобы добавить имя хоста или IP в Subject Alternative Name сертификата, задайте в `.env`:

```dotenv
RL_HOSTNAME=your-server.example.com
# Несколько дополнительных SAN через запятую:
RL_TLS_SANS=10.0.0.5,internal.example.com
```

Самоподписанный сертификат **не регенерируется** при каждом перезапуске — только если файл отсутствует, истёк срок действия или изменился набор SAN (`RL_HOSTNAME`/`RL_TLS_SANS`).

### Свой сертификат (корпоративный CA или публичный)

Положите файлы в каталог `./tls-custom/` (или в путь, указанный в `RL_TLS_CUSTOM_DIR`):

| Файл | Обязателен | Содержимое |
|---|---|---|
| `tls.key` | Да | Закрытый ключ (ECDSA или RSA, PEM) |
| `tls.crt` | Да | Сертификат сервера (leaf), PEM |
| `ca.crt` | Нет | CA-цепочка (intermediate + root); если задан, склеивается с `tls.crt` в fullchain |

Пример:

```bash
mkdir -p ./tls-custom
cp /path/to/server.key ./tls-custom/tls.key
cp /path/to/server.crt ./tls-custom/tls.crt
cp /path/to/ca-bundle.crt ./tls-custom/ca.crt   # опционально
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

`certinit` проверяет:
- ключ соответствует сертификату (сравнение публичных ключей);
- сертификат не просрочен и ещё не начал действовать.

Если проверка не пройдена — **старт падает с ненулевым кодом и явным сообщением**; откат на самоподписанный не происходит. Проверьте логи:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend
```

### HSTS

Заголовок `Strict-Transport-Security` (`max-age=31536000; includeSubDomains`) включается **только в режиме пользовательского сертификата**. Для самоподписанного он отключён — иначе браузер заблокирует доступ к сайту после первого посещения.

### Что происходит при перезапуске

- **Самоподписанный режим:** файл сертификата уже есть в named volume → `certinit` пропускает генерацию, nginx стартует с тем же сертификатом.
- **Режим пользовательского сертификата:** `certinit` каждый раз читает файлы из `tls-custom/` и перезаписывает runtime volume. Достаточно обновить файлы в `tls-custom/` и перезапустить стек.

### Обновление пользовательского сертификата

```bash
# Замените файлы в tls-custom/
cp /new/server.key ./tls-custom/tls.key
cp /new/server.crt ./tls-custom/tls.crt
# Перезапустите frontend — certinit запустится автоматически как часть entrypoint
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps frontend
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

```bash
git pull
docker compose pull
docker compose up -d --build
```

После обновления проверьте:

- `docker compose ps`
- `docker compose logs backend --tail=200`
- `GET /health`
