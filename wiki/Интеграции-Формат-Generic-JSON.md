# Интеграции-Формат-Generic-JSON

Generic предназначен для собственного сканера или преобразования неподдерживаемого отчёта. Сведения из прежнего справочника форматов перенесены сюда с проверкой по `generic.go`, детектору, модели находки и OpenAPI.

## Конверт и выбор проекта

~~~json
{
  "source_type": "internal-audit",
  "findings": [
    {
      "title": "SQL-инъекция",
      "severity": "high",
      "file_path": "src/auth.go",
      "line_start": 57,
      "rule_id": "sql-injection"
    }
  ]
}
~~~

| Поле | Тип | Обязательность | Назначение |
|---|---|---|---|
| `source_type` | string | Да, непустая | Имя источника; нужно и при наличии override в каждой находке |
| `findings` | array объектов | Да, не null | Находки; пустой массив распознаётся, но ручной импорт его отклоняет |
| `project_id` | UUID string | Условно | Проект для ручного импорта без query, доступного глобальному администратору |

В ручном импорте `POST /api/v1/import?project_id=<UUID>` query переопределяет проект конверта. Для пользователя с проектной ролью минимум `triager` query обязателен. Для CI передавайте этот JSON как multipart-файл `report` в `POST /api/v1/scans`; проект определяется PAT, а `commit_sha` и `branch` передаются отдельными полями формы.

## Поля находки

| Поле | Тип | Обязательность и значение при отсутствии |
|---|---|---|
| `title` | string | Обязательно по контракту; ручной импорт отклоняет пустой заголовок |
| `severity` | int/string | Обязательно по OpenAPI; реализация при отсутствии получает 0 |
| `kind` | string | Необязательно, определяется по содержимому |
| `description` | string | Необязательно, пустая строка |
| `confidence` | int/string | Необязательно, 0 |
| `status` | int/string | Необязательно, 0 |
| `file_path` | string | Путь, по умолчанию пустой |
| `line_start`, `line_end` | int | Строки, по умолчанию 0 |
| `component`, `component_version` | string | Пакет и установленная версия, по умолчанию пустые |
| `cve_ids` | array строк | По умолчанию пустой массив |
| `cwe_ids` | array чисел/строк | По умолчанию пустой массив; допускается смесь `79`, `"79"`, `"CWE-79"` |
| `cpe_uri` | string | CPE, по умолчанию пустая строка |
| `fixed_version` | string/null | Исправленная версия |
| `package_ecosystem` | string/null | Экосистема пакета |
| `purl` | string/null | Package URL |
| `code_snippet` | string/null | Фрагмент кода |
| `code_flow` | произвольный JSON | Трассировка; не ограничен объектом или массивом |
| `url`, `http_method`, `http_param` | string/null | URL, метод и параметр DAST |
| `http_evidence` | произвольный JSON | HTTP-доказательство |
| `iac_resource`, `iac_provider` | string/null | Ресурс и провайдер IaC |
| `secret_kind` | string/null | Тип секрета |
| `commit_sha` | string/null | Коммит находки; служит сигналом secrets |
| `rule_id`, `rule_name` | string/null | Идентификатор и название правила |
| `source_type` | string/null | Непустое значение переопределяет имя источника из конверта |

Generic не принимает отдельные поля `secret_fingerprint`, `fingerprint`, `project_id` внутри находки. Неизвестные поля стандартный JSON-декодер игнорирует; это не подтверждает их сохранение. Fingerprint рассчитывает сервер. В отличие от SARIF, Generic не разбирает PURL для автоматического заполнения имени и версии компонента: передавайте эти поля явно.

Не включайте реальные секреты в title, description, snippet или произвольный JSON: Generic не применяет к ним маскирование Gitleaks/TruffleHog.

## Значения и нормализация

| Поле | Числа | Строковые соответствия |
|---|---|---|
| severity | 0–4 | `info/informational/none` → 0; `low` → 1; `medium/moderate` → 2; `high` → 3; `critical/crit` → 4 |
| confidence | 0–3 | `low` → 0; `medium` → 1; `high` → 2; `confirmed` → 3 |
| status | 0–4 | `open` → 0; `confirmed` → 1; `false_positive/fp` → 2; `resolved/fixed` → 3; `risk_accepted/accepted` → 4 |
| kind | Число не принимается | `sca`, `sast`, `dast`, `iac`, `secrets`, `other` |

Для severity/confidence/status регистр строк и крайние пробелы игнорируются; неизвестная строка даёт 0, целое за диапазоном ограничивается ближайшей границей. Строка `"3"` не эквивалентна числу `3` и даёт 0. Дробное число вызывает ошибку декодирования. OpenAPI описывает допустимые значения строже, чем фактический парсер; формируйте отчёт по контракту, не полагайтесь на исправление ошибочных значений.

CWE-строки нормализуются по регистру и префиксу; неразбираемые элементы пропускаются. Числовые элементы не фильтруются на положительность. Передавайте валидные положительные идентификаторы.

## Вывод kind

Категория определяется отдельно для каждой находки. Явные `sca/sast/dast/iac/secrets` сохраняются. Отсутствующее, неизвестное значение и даже явное `other` запускают определение по содержимому. Это отличается от общего обещания OpenAPI сохранять любой валидный kind.

| Приоритет | Непустые признаки | Результат |
|---|---|---|
| 1 | `secret_kind` либо `commit_sha` | secrets |
| 2 | `iac_resource` либо `iac_provider` | iac |
| 3 | `url`, `http_method`, `http_param` либо ненулевой JSON `http_evidence` | dast |
| 4 | `purl`, `package_ecosystem`, `fixed_version`; либо component + component_version; либо cve_ids + component | sca |
| 5 | `file_path` и (`line_start > 0` либо непустой `rule_id`) | sast |
| 6 | Подсказка по `source_type` | Категория подсказки |
| 7 | Признаков нет | other |

Для `http_evidence` даже `{}`, `[]` и `false` считаются присутствующим JSON; `null` не считается. Не добавляйте `commit_sha` в каждую Generic-находку для описания CI: без явного kind он классифицирует её как secrets. Используйте поле multipart скана.

### Подсказки имени сканера

Администратор может задать `RL_SCANNER_KIND_OVERRIDES` в окружении backend:

~~~dotenv
RL_SCANNER_KIND_OVERRIDES=legacy-sca=sca,internal-zap=dast
~~~

Альтернативный формат:

~~~dotenv
RL_SCANNER_KIND_OVERRIDES={"legacy-sca":"sca","internal-zap":"dast"}
~~~

Ключи нормализуются: нижний регистр, замена `_` на `-`, сжатие пробелов. Сначала проверяется точное совпадение, затем подстрока, причём более длинная имеет приоритет. Override проверяется до встроенных подсказок, но после признаков содержимого. Для многокатегорийных инструментов встроенная подстрочная подсказка ограничена; явный override может классифицировать бедный данными отчёт такого инструмента.

Проверка настройки: перезапустите backend с новым окружением и импортируйте тестовую находку с указанным source_type без содержательных признаков категории. Её kind должен соответствовать override; после добавления более сильного признака категория должна определяться по содержимому.

## Полный пример SCA

Это пример структуры отчёта, а не рекомендация по выбору версии зависимости.

~~~json
{
  "source_type": "internal-dependency-audit",
  "findings": [{
    "kind": "sca",
    "title": "Уязвимость в компоненте",
    "description": "Результат проверки зависимости",
    "severity": "critical",
    "confidence": "confirmed",
    "status": "open",
    "file_path": "pom.xml",
    "line_start": 42,
    "line_end": 44,
    "component": "log4j-core",
    "component_version": "2.14.1",
    "cve_ids": ["CVE-2021-44228"],
    "cwe_ids": ["CWE-917", 400],
    "cpe_uri": "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*",
    "fixed_version": "2.17.1",
    "package_ecosystem": "maven",
    "purl": "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
    "code_snippet": "<version>2.14.1</version>",
    "code_flow": null,
    "rule_id": "dependency-version",
    "rule_name": "Уязвимая версия зависимости",
    "source_type": "dependency-audit"
  }]
}
~~~

## Примеры вывода категорий

В этом отчёте kind намеренно отсутствует. Категории по порядку: SCA, SAST, DAST, IaC, secrets.

~~~json
{
  "source_type": "internal-audit",
  "findings": [
    {
      "title": "Уязвимая зависимость",
      "severity": "high",
      "component": "lodash",
      "component_version": "4.17.4",
      "cve_ids": ["CVE-2019-10744"],
      "fixed_version": "4.17.21",
      "package_ecosystem": "npm",
      "purl": "pkg:npm/lodash@4.17.4"
    },
    {
      "title": "Небезопасное формирование SQL",
      "severity": "high",
      "file_path": "src/auth.go",
      "line_start": 57,
      "rule_id": "sql-injection",
      "cwe_ids": ["CWE-89"]
    },
    {
      "title": "Отражённый XSS",
      "severity": "high",
      "url": "https://app.example.org/search",
      "http_method": "GET",
      "http_param": "q",
      "http_evidence": {"marker": "тестовый маркер"},
      "cwe_ids": [79]
    },
    {
      "title": "Публичный S3-бакет",
      "severity": "high",
      "file_path": "terraform/s3.tf",
      "line_start": 12,
      "iac_resource": "aws_s3_bucket.public_assets",
      "iac_provider": "terraform",
      "rule_id": "CKV_AWS_20"
    },
    {
      "title": "Обнаружен токен",
      "severity": "critical",
      "secret_kind": "github-pat",
      "commit_sha": "a3f8c21d09e1b4c7d2e5f6a0b1c3d4e5f6a7b8c9",
      "file_path": ".env.backup"
    }
  ]
}
~~~

## Загрузка и проверка

1. Сохраните один из отчётов в `report.json`. Задайте `RL_URL` как адрес сервера без `/api/v1`, `RL_PROJECT_ID` как UUID тестового проекта. В `RL_SESSION` передайте действующий сессионный токен пользователя с ролью `triager` или выше.
2. Выполните запрос из shell с curl и jq:

~~~bash
curl --silent --show-error --fail-with-body \
  -H "Authorization: Bearer $RL_SESSION" \
  -H "Content-Type: application/json" \
  --data-binary @report.json \
  "${RL_URL%/}/api/v1/import?project_id=$RL_PROJECT_ID" \
  --output import-response.json
jq -e '(.errors // [] | length) == 0 and (.imported + .updated > 0)' import-response.json
~~~

Проверка: curl и jq завершаются с кодом 0, `format` равен `generic`, счётчики соответствуют отчёту; категории и поля видны в интерфейсе. Успех ручного импорта возвращается без оболочки `data`, а `errors` при отсутствии ошибок может быть `null`.

## Повторный импорт и диагностика

Generic вычисляет SHA-256 от конкатенации без разделителей:

~~~text
числовой kind + lower(rule_id) + lower(первый CVE или "") +
lower(file_path) + line_start + line_end + первый CWE (или 0) +
lower(component) + lower(component_version)
~~~

Числовые категории: sca=0, sast=1, dast=2, iac=3, secrets=4, other=5. Порядок CVE/CWE влияет на отпечаток. URL, HTTP-параметр, title, source_type и ID проекта в эту формулу не входят. Разные DAST URL с остальными одинаковыми полями могут объединиться.

Конфликт fingerprint обновляет last_seen, times_seen и предусмотренное поле secret_fingerprint, но не заменяет описание, severity или status данными нового отчёта. Уникальность глобальная, поэтому утверждение старого справочника «только в проекте» неверно. См. [дедупликацию](Система-Дедупликация).

| Симптом | Причина | Действие и проверка |
|---|---|---|
| `unsupported format` | Нет распознаваемого конверта | Проверьте непустой source_type и массив findings; повторный запрос должен вернуть format generic |
| `PARSE_ERROR` при kind | Передано число или другой несовместимый тип | Передайте строку; проверьте успешный разбор |
| Находка стала other | Нет содержательных признаков и подсказки | Добавьте явный kind или соответствующие поля; проверьте категорию |
| Находка стала secrets неожиданно | В finding передан commit_sha | Передайте CI-коммит в форме скана либо задайте нужный kind; проверьте категорию |
| HTTP 200, но часть записей отсутствует | Ручной импорт вернул ошибки по индексам | Проверьте корневой errors, исправьте записи и сравните счётчики |
| Нет новых находок при повторе | Совпадение глобального fingerprint | Проверьте updated и исходную находку, не меняйте поля случайным образом ради обхода дедупликации |

## Источники

[Generic](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/parser/generic.go), [OpenAPI](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/api/openapi.yaml), [определение категории](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/domain/kind_resolver.go), [детектор](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/parser/detect.go), [fingerprint](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/domain/dedup.go), [ручной импорт](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/import.go), [сохранение](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/storage/findings_repo.go).
