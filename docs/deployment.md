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
