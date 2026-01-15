# ASOC High-Load All-in-One Stack

## Control Plane vs Data Plane

**Control Plane**
- `api` — REST API для UI и интеграций.
- `ingest` — приём загрузок отчётов и маршрутизация в NATS JetStream.

**Data Plane**
- `normalize` — приведение данных к канонической модели.
- `dedup` — дедупликация и корреляция.
- `enrich` — enrichment (CVE/Intel/SBOM).
- `search_indexer` — индексация в OpenSearch.
- `analytics_exporter` — экспорт событий в ClickHouse.

## Event Subjects (JetStream)

| Subject | Producer | Consumer |
| --- | --- | --- |
| `scans.uploaded` | ingest | normalize |
| `findings.normalized` | normalize | dedup |
| `findings.deduped` | dedup | enrich |
| `findings.enriched` | enrich | search_indexer |
| `analytics.events` | api/dedup/enrich | analytics_exporter |

## Data Stores

- PostgreSQL 16+: OLTP, partitioned tables by time.
- OpenSearch: полнотекстовый поиск находок.
- ClickHouse: аналитика и дашборды.
- Redis: кэш/локи/Rate limiting.
- MinIO: S3-хранилище отчётов и артефактов.
- Qdrant (опционально): векторные индексы для ML.
