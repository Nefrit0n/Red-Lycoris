# Backup / Restore Playbook (on-prem)

## Что включено в backup

- PostgreSQL dump в custom формате (`pg_dump --format=custom --compress=9`) как `pgdump.bin`.
- Redis snapshot (`BGSAVE` + копия `dump.rdb`) как `redis.rdb`.
- `manifest.json` с метаданными:
  - версия приложения,
  - timestamp создания архива,
  - размеры и `sha256` для каждого артефакта.

## Что НЕ включено

- `.env`/секреты (ops/secret-management слой).
- Docker images (registry слой).

## Рекомендуемая retention policy (7/4/4)

- Daily (7): `redlycoris-daily-YYYY-MM-DD.tar.gz`
- Weekly (4): `redlycoris-weekly-YYYY-WW.tar.gz`
- Monthly (4): `redlycoris-monthly-YYYY-MM.tar.gz`

Базовый скрипт `backup.sh` также создает timestamp-архив формата:
`redlycoris-YYYY-MM-DD-HHMMSS.tar.gz`.

## Команды

### Создать backup

```bash
./ops/backup/backup.sh --destination=./bk --retention-days=7
```

### Restore из архива

```bash
./ops/backup/restore.sh ./bk/redlycoris-2026-04-22-030000.tar.gz
```

Скрипт требует явного подтверждения (`restore`) и делает проверку `manifest.json` + `sha256`.

### Verify backup

```bash
./ops/backup/verify.sh ./bk/redlycoris-2026-04-22-030000.tar.gz
```

Скрипт поднимает временный `docker compose` проект в отдельной сети, выполняет восстановление и запускает smoke SQL-проверки:

- `SELECT count(*) FROM findings;`
- `SELECT count(*) FROM projects;`
- `SELECT count(*) FROM users;`

Если в `manifest.json` присутствует `expected_counts`, выполняется строгая сверка.

## Cron (ежедневно в 03:00)

```cron
0 3 * * * cd /opt/redlycoris && ./ops/backup/backup.sh --destination=/var/backups/redlycoris --retention-days=7 >> /var/log/redlycoris-backup.log 2>&1
```

## Хранение вне площадки

Рекомендуется копировать архивы во внешнее зашифрованное хранилище:

- `rsync` (по SSH, с шифрованием канала),
- `rclone` (S3/Blob/Object storage + серверное/клиентское шифрование).

## RTO / RPO ориентиры

- **RTO**: типично `< 10 минут` для дампа до `10 GB` (зависит от I/O и CPU).
- **RPO**: при ежедневном backup `RPO = 24h`.

## Disaster Recovery (high-level)

1. Полный reinstall инфраструктуры/хоста и Docker runtime.
2. Развертывание Red Lycoris (compose, .env, networking).
3. Восстановление через `restore.sh` из последнего валидного архива.
4. Повторная проверка через `verify.sh` и health/readiness smoke.
