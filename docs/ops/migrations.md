# Migrations

## Migration rollback

- Для каждой `up.sql` миграции должна существовать парная `down.sql`.
- Откат одной миграции выполняйте через существующий migrate-tool проекта (один шаг назад), например:

```bash
docker compose exec backend migrate -path /app/migrations -database "$DATABASE_URL" down 1
```

> Примечание: точный бинарь/entrypoint migrate-tool зависит от вашего runtime-образа backend.

- В production **не выполняйте rollback через `down.sql` без предварительного свежего backup**.
  Рекомендуемый порядок: сначала backup, затем rollback, затем smoke-проверка.
