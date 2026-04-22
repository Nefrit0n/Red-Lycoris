# Observability

В Red Lycoris доступны три базовых endpoint'а для эксплуатации:

- `GET /healthz` — liveness probe, всегда `200 OK` и `ok`.
- `GET /readyz` — readiness probe, проверяет PostgreSQL и Redis (таймаут 2s на каждую проверку).
- `GET /metrics` — метрики в Prometheus text format (`text/plain; version=0.0.4`).

## Prometheus scrape_config

```yaml
scrape_configs:
  - job_name: redlycoris
    metrics_path: /metrics
    scheme: http
    static_configs:
      - targets:
          - redlycoris:8080
```

## Экспортируемые метрики

- `redlycoris_http_requests_total{route,method,status}`
  - Общее число HTTP-запросов по route pattern (`chi`), методу и коду ответа.

- `redlycoris_http_request_duration_seconds{route,method}` (histogram)
  - Длительность HTTP-запросов.
  - Buckets: `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10`.

- `redlycoris_enrichment_stream_lag{source}`
  - Текущее отставание enrichment stream (через `XINFO GROUPS` lag, источник `source="nvd"`).

- `redlycoris_enrichment_last_sync_age_seconds{source}`
  - Возраст последней успешной синхронизации (`now - last_sync_at`) для источника.

- `redlycoris_import_findings_total{format,outcome}`
  - Счётчик обработки findings при импорте.
  - `outcome`: `inserted | updated | rejected`.

- `redlycoris_db_pool_connections{state}`
  - Состояние pgxpool: `acquired | idle | total`.

- `redlycoris_build_info{version,commit,date} = 1`
  - Информация о сборке сервиса.

## Примеры PromQL-алертов

- **Enrichment stale**

```promql
redlycoris_enrichment_last_sync_age_seconds{source="nvd"} > 86400
```

- **High error rate**

```promql
rate(redlycoris_http_requests_total{status=~"5.."}[5m]) > 0.05
```

- **DB pool saturation**

```promql
redlycoris_db_pool_connections{state="acquired"}
/
redlycoris_db_pool_connections{state="total"} > 0.8
```
