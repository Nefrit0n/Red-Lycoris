# Risk Scoring: Asset Context (MVP)

Этот гайд описывает минимальные сигналы контекста актива, которые используются при будущей оценке риска (вместе с EPSS/KEV/CVSS).

## Asset Context

Сущность **Asset Context** хранится отдельно от продукта и привязана к `products` (1:1 в текущей версии). Она задаёт базовые бизнес‑сигналы о продукте.

### Поля

- `environment`: `prod` | `staging` | `dev` | `unknown`
- `internet_exposed`: `bool`
- `data_classification`: `public` | `internal` | `confidential` | `restricted` | `unknown`
- `business_impact`: `low` | `medium` | `high` | `critical`
- `tags`: массив тегов (TEXT[])
- `metadata`: произвольный JSONB для будущих расширений

### Рекомендации по заполнению

- **environment**: используйте `prod` для систем, влияющих на SLA/клиентов.
- **internet_exposed**: ставьте `true`, если продукт доступен с публичного интернета (внешние API, публичные панели).
- **data_classification**: отражает наиболее чувствительные данные, которые обрабатывает продукт.
- **business_impact**: оценка влияния на бизнес при компрометации.
- **tags**: короткие фильтруемые метки (например, `pci`, `customer-facing`, `payments`).
- **metadata**: свободная структура, например:

```json
{
  "owner": "secops",
  "segment": "payments",
  "regulated": true
}
```

## Использование в risk-score

В будущей формуле risk-score Asset Context будет использоваться как модификатор к базовой уязвимости:

- `environment` и `business_impact` усиливают/ослабляют итоговый риск.
- `internet_exposed` повышает вес удалённой атаки.
- `data_classification` влияет на приоритет remediation.
- `tags` и `metadata` дают возможность гибко настраивать правила без миграций.
