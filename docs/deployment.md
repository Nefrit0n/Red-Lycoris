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

После запуска создайте первого администратора (будет добавлено на этапе 3).

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
