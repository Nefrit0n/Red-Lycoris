# Нагрузочное тестирование для релиза 0.1.0b

## Предварительные требования

- Хост как минимум с 4 vCPU, 8 ГБ RAM и SSD-диском (рекомендуется для стабильной задержки).
- Docker Engine + плагин Docker Compose.
- Собранные образы backend/frontend (например, `redlycoris/backend:0.1.0b` и `redlycoris/frontend:0.1.0b`).
- PAT-токен со scope-правами:
  - `findings:read`
  - `findings:write`
- Существующий UUID проекта (создаётся через UI после запуска стека).

> Для `loadtest` обязательно требуется явный параметр `--url`, чтобы избежать случайного запуска против локального dev-инстанса.

## Воспроизводимая последовательность

1. Запустите изолированный loadtest-стек:

   ```bash
   docker compose -f deployments/docker-compose.loadtest.yml up -d
   ```

2. Создайте проект в UI и сохраните UUID проекта.
3. Создайте PAT-токен с `findings:read` + `findings:write`.
4. Сгенерируйте фикстуру:

   ```bash
   cd backend
   go run ./cmd/loadtest generate --output=../testdata/fixtures --size=100000
   ```

5. Загрузите findings:

   ```bash
   go run ./cmd/loadtest seed \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --project=<project_uuid> \
     --file=../testdata/fixtures/sarif_100000.json
   ```

6. Запустите сценарий browse:

   ```bash
   go run ./cmd/loadtest browse \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --project=<project_uuid> \
     --duration=5m \
     --concurrency=10 \
     --report=report_browse.json
   ```

7. Запустите сценарий dashboard:

   ```bash
   go run ./cmd/loadtest dashboard \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --duration=2m \
     --concurrency=5 \
     --report=report_dashboard.json
   ```

8. Необязательный сценарий export:

   ```bash
   go run ./cmd/loadtest export \
     --url=http://localhost:8080 \
     --token=<PAT> \
     --format=csv \
     --report=report_export.json
   ```

## Краткое описание сценариев

- `generate`: создаёт SARIF с N findings, используя подобранные реальные CVE.
- `seed`: загружает SARIF через `/api/v1/import?project_id=<uuid>`.
- `browse`: случайные фильтры + пагинация по курсору + запрос деталей finding.
- `dashboard`: циклические запросы к `/api/v1/dashboard/stats`.
- `export`: тест endpoint-а экспорта с TTFB + общей длительностью.

## Формат JSON-отчёта

Каждый сценарий пишет отчёт вида:

```json
{
  "scenario": "browse",
  "started_at": "2026-04-22T12:00:00Z",
  "finished_at": "2026-04-22T12:05:00Z",
  "duration_seconds": 300,
  "concurrency": 10,
  "endpoints": [
    {
      "name": "GET /api/v1/findings",
      "count": 12345,
      "success_count": 12340,
      "error_count": 5,
      "p50_ms": 42,
      "p90_ms": 120,
      "p95_ms": 180,
      "p99_ms": 450,
      "rps": 41.15
    }
  ],
  "target_version": "0.1.0b",
  "target_commit": "abc1234"
}
```

## Интерпретация метрик

- `count`: общее число вызовов endpoint-а.
- `success_count`: HTTP-ответы 2xx.
- `error_count`: не-2xx + транспортные/сетевые ошибки.
- `p50/p90/p95/p99`: перцентили сквозной задержки в миллисекундах.
- `rps`: пропускная способность endpoint-а (`count / scenario_duration_seconds`).
- `ttfb_*` (export): задержка до первого байта.

Проверьте структуру отчёта через `jq`:

```bash
jq . report_browse.json
```

## Шаблон таблицы для release notes

| Build | Commit | Scenario | Concurrency | Duration | Findings volume | p50 | p95 | p99 | RPS | Error rate |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.1.0b | `<sha>` | browse | 10 | 5m | 100k |  |  |  |  |  |
| 0.1.0b | `<sha>` | dashboard | 5 | 2m | 100k |  |  |  |  |  |
| 0.1.0b | `<sha>` | export(csv) | 1 | single run | 100k |  |  |  |  |  |
