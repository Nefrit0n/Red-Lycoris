# Форматы импорта findings

## Обзор

Red Lycoris принимает результаты сканирования через `POST /api/v1/import`.
Формат входного JSON определяется автоматически по структуре файла.

### Нативные форматы

| Формат | Парсер | Характерный признак |
|--------|--------|---------------------|
| SARIF 2.1.0 | `sarif` | `version` + `runs[]` |
| Trivy JSON | `trivy` | `SchemaVersion` + `Results[]` |
| Semgrep JSON | `semgrep` | `results[]` + `version` |
| gosec JSON | `gosec` | `Issues[]` + `GosecVersion` |
| TruffleHog v3 | `trufflehog` | NDJSON или массив с `SourceMetadata` |
| Gitleaks JSON | `gitleaks` | Массив с `RuleID` и `Commit` |
| Checkov JSON | `checkov` | `results.passed_checks` / `results.failed_checks` |
| OWASP ZAP JSON | `zap` | `site[]` |
| Grype JSON | `grype` | `matches[]` + `descriptor.name` |
| Generic Universal | `generic` | `source_type` + `findings[]` |

Generic Universal используется как fallback для собственных сканеров и форматов, которых нет в списке выше. Он срабатывает последним, поэтому не перехватывает SARIF, Trivy, Grype и другие нативные отчёты.

Для Grype, Trivy и других SCA-инструментов предпочтителен нативный JSON (`grype -o json`, `trivy -f json`). SARIF лучше использовать для SAST/DAST: он часто теряет часть package metadata, нужной для SCA.

## Endpoint

```http
POST /api/v1/import?project_id=<uuid>
```

| Параметр | Значение |
|----------|----------|
| Авторизация | Session cookie `rl_session` или поддержанный токен доступа |
| Минимальная роль | `triager` в проекте или выше |
| Лимит тела | 50 МБ |
| Content-Type | `application/json` |

`project_id` можно передать в query-параметре или в Generic-конверте. Query-параметр имеет приоритет и переопределяет `project_id` для всех findings. Для пользователей без глобальной роли администратора query-параметр обязателен, потому что проверка роли выполняется до разбора тела.

## Конверт Generic

```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_type": "my-custom-scanner",
  "findings": []
}
```

| Поле | Тип | Обязательность | Описание |
|------|-----|----------------|----------|
| `project_id` | UUID string | Опционально | UUID проекта. Не нужен, если `project_id` передан в query. |
| `source_type` | string | Обязательно | Имя сканера, CI job или другого источника. |
| `findings` | array | Обязательно | Массив findings. |

## Поля finding

### Обязательные

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Краткое название finding. |
| `severity` | int или string | Критичность finding. |

### Рекомендуемые

| Поле | Тип | Описание |
|------|-----|----------|
| `kind` | string или int | Категория finding. Если поле отсутствует или содержит неизвестное значение, тип будет определён автоматически. |
| `description` | string | Развёрнутое описание. |
| `confidence` | int или string | Уверенность в finding. По умолчанию `0`. |

### Опциональные

| Поле | Тип | Описание |
|------|-----|----------|
| `status` | int или string | Статус. По умолчанию `0` (`open`). |
| `file_path` | string | Путь к файлу. |
| `line_start` | int | Начальная строка. |
| `line_end` | int | Конечная строка. |
| `component` | string | Имя компонента или пакета. |
| `component_version` | string | Установленная версия компонента. |
| `cve_ids` | `[]string` | CVE-идентификаторы. |
| `cwe_ids` | `[]int` или `[]string` | CWE-идентификаторы. Можно смешивать `79`, `"CWE-79"` и `"79"`. |
| `cpe_uri` | string | CPE URI компонента. |
| `fixed_version` | string | Исправленная версия. |
| `package_ecosystem` | string | Экосистема пакета: `npm`, `pypi`, `maven`, `go`, `cargo` и т.п. |
| `purl` | string | Package URL, например `pkg:npm/lodash@4.17.4`. |
| `code_snippet` | string | Фрагмент кода. |
| `code_flow` | object/array | Произвольный JSON с трассировкой потока данных. |
| `url` | string | URL для DAST finding. |
| `http_method` | string | HTTP-метод. |
| `http_param` | string | Уязвимый HTTP-параметр. |
| `http_evidence` | object/array | Доказательство DAST finding. |
| `iac_resource` | string | IaC-ресурс, например `aws_s3_bucket.public`. |
| `iac_provider` | string | IaC-провайдер: `terraform`, `cloudformation`, `kubernetes`. |
| `secret_kind` | string | Тип секрета: `github-pat`, `aws-access-key-id` и т.п. |
| `commit_sha` | string | SHA коммита, где найден секрет. |
| `rule_id` | string | Идентификатор правила сканера. |
| `rule_name` | string | Читаемое имя правила. |
| `source_type` | string | Per-finding override для `source_type` из конверта. |

## Допустимые значения

### severity

| Число | Строки |
|-------|--------|
| `0` | `info`, `informational`, `none`, неизвестная строка |
| `1` | `low` |
| `2` | `medium`, `moderate` |
| `3` | `high` |
| `4` | `critical`, `crit` |

Числа вне диапазона `0..4` клампятся к ближайшей границе.

### confidence

| Число | Строки |
|-------|--------|
| `0` | `low`, неизвестная строка |
| `1` | `medium` |
| `2` | `high` |
| `3` | `confirmed` |

Числа вне диапазона `0..3` клампятся.

### status

| Число | Строки |
|-------|--------|
| `0` | `open` |
| `1` | `confirmed` |
| `2` | `false_positive`, `fp` |
| `3` | `resolved`, `fixed` |
| `4` | `risk_accepted`, `accepted` |

### kind

| Значение | Описание |
|----------|----------|
| `sca` | Уязвимость в зависимости, пакете или компоненте. |
| `sast` | Статический анализ исходного кода. |
| `dast` | Динамическое тестирование веб-приложения/API. |
| `iac` | Infrastructure as Code или конфигурационная ошибка. |
| `secrets` | Утечка секрета. |
| `other` | Не классифицировано. |

## Как определяется kind

`kind` является свойством конкретного finding, а не всего инструмента. Один файл от Trivy, Snyk, Semgrep, GitHub Advanced Security или другого "комбайна" может содержать findings разных типов. Red Lycoris считает тип per-finding.

Приоритет:

1. Валидный явный `kind` из отчёта или нативного парсера.
2. Content-сигналы в самом finding.
3. Слабая подсказка по `source_type`: встроенный справочник моно-категорийных сканеров и `RL_SCANNER_KIND_OVERRIDES`.
4. `other`.

Content-сигналы всегда сильнее имени инструмента и env override.

| Признак | Тип |
|---------|-----|
| `secret_kind`, `secret_fingerprint`, `commit_sha` | `secrets` |
| `iac_resource`, `iac_provider` | `iac` |
| `url`, `http_method`, `http_param`, непустой `http_evidence` | `dast` |
| `purl`, `package_ecosystem`, `fixed_version` | `sca` |
| `component` + `component_version` | `sca` |
| `cve_ids` + `component` | `sca` |
| `file_path` + (`line_start > 0` или `rule_id`) | `sast` |

Для комбайнов (`trivy`, `snyk`, `semgrep`, `checkmarx`, `veracode`, `fortify`, GitHub Advanced Security, GitLab Secure, SonarQube, Aqua, Synopsys) single-kind mapping по имени не применяется. Если такие findings массово попадают в `other`, отчёт обеднён: добавьте поля вроде `purl`, `url`, `iac_resource`, `secret_kind` или используйте нативный JSON инструмента.

## Env override

`RL_SCANNER_KIND_OVERRIDES` добавляет или переопределяет слабую подсказку по имени сканера без пересборки приложения.

Поддерживаются два формата:

```bash
RL_SCANNER_KIND_OVERRIDES="legacy-sca=sca,internal-zap=dast"
```

```bash
RL_SCANNER_KIND_OVERRIDES='{"legacy-sca":"sca","internal-zap":"dast"}'
```

Ключ нормализуется: регистр игнорируется, `_` заменяется на `-`, лишние пробелы сжимаются. Override срабатывает по точному совпадению или как подстрока `source_type`.

Используйте override только для моно-категорийных инструментов. Для комбайнов override может классифицировать content-poor findings, но не должен заменять нормальные per-finding поля.

## Эталонный JSON

```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_type": "my-custom-scanner",
  "findings": [
    {
      "kind": "sca",
      "title": "Удалённое выполнение кода в log4j",
      "description": "Log4Shell (CVE-2021-44228): JNDI lookup позволяет выполнить произвольный код.",
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
      "url": null,
      "http_method": null,
      "http_param": null,
      "http_evidence": null,
      "iac_resource": null,
      "iac_provider": null,
      "secret_kind": null,
      "commit_sha": null,
      "rule_id": "log4j-vulnerable-version",
      "rule_name": "Уязвимая версия Log4j",
      "source_type": "dependency-audit"
    }
  ]
}
```

### Минимальный пример

```json
{
  "source_type": "my-scanner",
  "findings": [
    {
      "title": "SQL Injection в форме авторизации",
      "severity": "high",
      "file_path": "src/auth.go",
      "line_start": 57,
      "rule_id": "sql-injection"
    }
  ]
}
```

При запросе используйте `POST /api/v1/import?project_id=<uuid>`.

## Примеры по типам

### SCA

```json
{
  "source_type": "dep-audit",
  "findings": [{
    "title": "Prototype Pollution в lodash",
    "severity": "high",
    "cve_ids": ["CVE-2019-10744"],
    "component": "lodash",
    "component_version": "4.17.4",
    "fixed_version": "4.17.21",
    "package_ecosystem": "npm",
    "purl": "pkg:npm/lodash@4.17.4"
  }]
}
```

### SAST

```json
{
  "source_type": "semgrep-custom",
  "findings": [{
    "title": "Hardcoded AWS secret key",
    "severity": "critical",
    "file_path": "src/config/aws.go",
    "line_start": 17,
    "rule_id": "hardcoded-credentials",
    "cwe_ids": ["CWE-798"]
  }]
}
```

### DAST

```json
{
  "source_type": "zap-custom",
  "findings": [{
    "title": "Reflected XSS в параметре q",
    "severity": "high",
    "url": "https://app.example.com/search?q=<script>alert(1)</script>",
    "http_method": "GET",
    "http_param": "q",
    "cwe_ids": ["CWE-79"]
  }]
}
```

### IaC

```json
{
  "source_type": "checkov-custom",
  "findings": [{
    "title": "S3-бакет публично доступен",
    "severity": "critical",
    "file_path": "terraform/s3.tf",
    "line_start": 12,
    "iac_resource": "aws_s3_bucket.public_assets",
    "iac_provider": "terraform",
    "rule_id": "CKV_AWS_20"
  }]
}
```

### Secrets

```json
{
  "source_type": "trufflehog-custom",
  "findings": [{
    "title": "GitHub Personal Access Token в истории git",
    "severity": "critical",
    "secret_kind": "github-pat",
    "commit_sha": "a3f8c21d09e1b4c7d2e5f6a0b1c3d4e5f6a7b8c9",
    "file_path": ".env.backup"
  }]
}
```

## Дедупликация

После парсинга вычисляется fingerprint:

```text
SHA256(
  kind +
  lower(rule_id) +
  lower(cve_ids[0]) +
  lower(file_path) +
  line_start +
  line_end +
  cwe_ids[0] +
  lower(component) +
  lower(component_version)
)
```

Если finding с таким fingerprint уже есть в проекте, новая запись не создаётся: обновляется `last_seen`, инкрементируется `times_seen`, а импорт считается `updated`.

## Частые проблемы

### Finding попадает в `other`

Причина: нет валидного `kind`, нет content-сигналов и `source_type` не совпал со слабой подсказкой.

Решение: добавьте поля по типу finding (`purl`, `url`, `iac_resource`, `secret_kind`, `file_path` + `rule_id`) или задайте валидный `kind`.

### `unsupported format: no parser matched the input`

Причина: JSON не похож ни на один нативный формат и не содержит Generic-конверт `source_type` + `findings[]`.

Минимальная форма:

```json
{"source_type": "my-tool", "findings": []}
```

### `VALIDATION_ERROR`

Частые причины:

- отсутствует `project_id`;
- пустой `title`;
- `severity`, `confidence` или `status` вне допустимого диапазона после разбора;
- отсутствует `source_type`;
- не удалось вычислить `fingerprint`.

### Много `other` после SARIF от SCA-инструмента

SARIF не всегда переносит package metadata. Для SCA используйте нативный JSON инструмента, например `grype -o json` или `trivy -f json`.
