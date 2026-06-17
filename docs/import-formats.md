# Форматы импорта findings

## Обзор

Red Lycoris принимает результаты сканирования через `POST /api/v1/import`.
Формат входного файла определяется автоматически по структуре JSON.

### Нативные форматы (автодетект)

| Формат | Парсер | Характерный признак |
|--------|--------|---------------------|
| SARIF 2.1.0 | `sarif` | `version` + `runs[]` |
| Trivy JSON | `trivy` | `SchemaVersion` + `Results[]` |
| Semgrep JSON | `semgrep` | `results[]` + `version` |
| gosec JSON | `gosec` | `Issues[]` + `GosecVersion` |
| TruffleHog v3 | `trufflehog` | Top-level массив с `SourceMetadata` |
| Gitleaks | `gitleaks` | Top-level массив с `RuleID` и `Commit` |
| Checkov | `checkov` | `results.passed_checks` / `results.failed_checks` |
| OWASP ZAP | `zap` | `site[]` |
| Grype (Anchore) | `grype` | `matches[]` + `descriptor.name` |
| **Generic Universal** | `generic` | `source_type` + `findings[]` |

Generic — это fallback-парсер: он срабатывает последним, если ни один нативный формат не совпал.
Используйте его для собственных сканеров или любого инструмента, не вошедшего в список выше.

---

## Endpoint

```
POST /api/v1/import?project_id=<uuid>
```

- **Авторизация:** Bearer-токен (API token) или session cookie `rl_session`.
- **Минимальная роль:** `triager` в проекте (для не-администраторов).
- **Лимит тела:** 50 МБ.
- **Content-Type:** `application/json`.

### project_id

`project_id` можно передать двумя способами:

1. **Query-параметр** `?project_id=<uuid>` — имеет приоритет над телом запроса.
2. **Поле тела** `"project_id": "<uuid>"` в Generic-конверте.

Если query-параметр указан, он переопределяет `project_id` из тела для **всех** findings.
Для не-администраторов query-параметр обязателен.

---

## Конверт Generic

```json
{
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_type": "my-custom-scanner",
  "findings": [ ... ]
}
```

| Поле | Тип | Обязательность |
|------|-----|----------------|
| `project_id` | UUID-строка | Опционально (если передан в query) |
| `source_type` | строка | **Обязательно** |
| `findings` | массив | **Обязательно** (может быть пустым) |

---

## Таблица полей finding

### Обязательные

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Краткое название уязвимости. Не может быть пустым. |
| `severity` | int или string | Критичность. Допустимые значения см. ниже. |

### Настоятельно рекомендуемые

| Поле | Тип | Описание |
|------|-----|----------|
| `kind` | string | Категория finding (sca/sast/dast/iac/secrets/other). Если не задан — применяется авто-вывод. |
| `description` | string | Развёрнутое описание уязвимости. |
| `confidence` | int или string | Уверенность в finding. По умолчанию `0` (`low`). |

### Опциональные

| Поле | Тип | Описание |
|------|-----|----------|
| `status` | int или string | Статус finding. По умолчанию `0` (`open`). |
| `file_path` | string | Путь к файлу с уязвимостью. |
| `line_start` | int | Начальная строка в файле. |
| `line_end` | int | Конечная строка в файле. |
| `component` | string | Имя уязвимого компонента/пакета. |
| `component_version` | string | Версия компонента. |
| `cve_ids` | `[]string` | Список CVE (например, `["CVE-2021-44228"]`). |
| `cwe_ids` | `[]int` или `[]string` | CWE-идентификаторы. Принимаются числа `[79]` или строки `["CWE-79"]`. |
| `cpe_uri` | string | CPE URI компонента. |
| `fixed_version` | string | Версия с патчем. |
| `package_ecosystem` | string | Экосистема пакета (npm, pypi, maven, …). |
| `purl` | string | Package URL (pkg:npm/lodash@4.0.0). |
| `code_snippet` | string | Фрагмент уязвимого кода. |
| `code_flow` | object/array | Трассировка потока данных (произвольный JSON). |
| `url` | string | URL, в котором обнаружена уязвимость (DAST). |
| `http_method` | string | HTTP-метод (GET/POST/…). |
| `http_param` | string | Уязвимый параметр запроса. |
| `http_evidence` | object | Доказательство эксплуатации (заголовки, тело). |
| `iac_resource` | string | Ресурс IaC (например, `aws_s3_bucket.my_bucket`). |
| `iac_provider` | string | Провайдер IaC (terraform, cloudformation, …). |
| `secret_kind` | string | Тип секрета (github-token, aws-access-key-id, …). |
| `commit_sha` | string | SHA коммита, в котором найден секрет. |
| `rule_id` | string | Идентификатор правила сканера. |
| `rule_name` | string | Читаемое название правила. |
| `source_type` | string | Переопределяет `source_type` конверта для данного finding. Полезно при импорте результатов нескольких инструментов в одном файле. |

---

## Допустимые значения полей

### severity

| Числовое | Строковые синонимы |
|----------|--------------------|
| `0` | `info`, `informational`, `none`, любое неизвестное значение |
| `1` | `low` |
| `2` | `medium`, `moderate` |
| `3` | `high` |
| `4` | `critical`, `crit` |

Числа за пределами `0–4` клампируются в границы (не отбрасываются).

### confidence

| Числовое | Строковые синонимы |
|----------|--------------------|
| `0` | `low`, любое неизвестное |
| `1` | `medium` |
| `2` | `high` |
| `3` | `confirmed` |

### status

| Числовое | Строковые синонимы |
|----------|--------------------|
| `0` | `open` |
| `1` | `confirmed` |
| `2` | `false_positive`, `fp` |
| `3` | `resolved`, `fixed` |
| `4` | `risk_accepted`, `accepted` |

### kind

| Значение | Описание |
|----------|----------|
| `sca` | Уязвимость в зависимости (CVE в пакете) |
| `sast` | Статический анализ кода |
| `dast` | Динамическое тестирование (OWASP ZAP и подобные) |
| `iac` | Ошибка конфигурации Infrastructure as Code |
| `secrets` | Утечка секретов (ключи, токены) |
| `other` | Прочее / не классифицировано |

---

## Эвристика авто-вывода kind

Если `kind` не задан явно (или содержит неизвестное значение), применяется следующий алгоритм.
Первое совпадение выигрывает.

1. `secret_kind != null` **или** `commit_sha != null` → `secrets`
2. `iac_resource != null` **или** `iac_provider != null` → `iac`
3. `url != null` **или** `http_method != null` **или** `http_param != null` → `dast`
4. `len(cve_ids) > 0` **и** (`component != ""` **или** `purl != null` **или** `package_ecosystem != null`) → `sca`
5. `component != ""` **и** (`purl != null` **или** `package_ecosystem != null` **или** `fixed_version != null`) → `sca`
6. `file_path != ""` **и** (`rule_id != null` **или** `line_start > 0`) → `sast`
7. Иначе → `other`

> **Рекомендация:** всегда проставляйте `kind` явно — так поведение предсказуемо и независимо от набора дополнительных полей.

---

## Эталонный JSON (все поля)

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
      "cwe_ids": ["CWE-917", "CWE-400"],
      "cpe_uri": "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*",
      "fixed_version": "2.15.0",
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
      "rule_name": "Уязвимая версия Log4j"
    }
  ]
}
```

### Минимальный валидный пример

```json
{
  "source_type": "my-scanner",
  "findings": [
    {
      "title": "SQL Injection в форме авторизации",
      "severity": "high",
      "kind": "sast"
    }
  ]
}
```

(при использовании query-параметра `?project_id=<uuid>`)

---

## Примеры по типам

### SCA — уязвимость в зависимости

```json
{
  "source_type": "dep-audit",
  "findings": [{
    "kind": "sca",
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

### SAST — статический анализ кода

```json
{
  "source_type": "semgrep-custom",
  "findings": [{
    "kind": "sast",
    "title": "Hardcoded AWS secret key",
    "severity": "critical",
    "file_path": "src/config/aws.go",
    "line_start": 17,
    "rule_id": "hardcoded-credentials",
    "cwe_ids": ["CWE-798"]
  }]
}
```

### DAST — динамическое тестирование

```json
{
  "source_type": "zap-custom",
  "findings": [{
    "kind": "dast",
    "title": "Reflected XSS в параметре q",
    "severity": "high",
    "url": "https://app.example.com/search?q=<script>alert(1)</script>",
    "http_method": "GET",
    "http_param": "q",
    "cwe_ids": ["CWE-79"]
  }]
}
```

### IaC — ошибка конфигурации инфраструктуры

```json
{
  "source_type": "checkov-custom",
  "findings": [{
    "kind": "iac",
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

### Secrets — утечка секрета

```json
{
  "source_type": "trufflehog-custom",
  "findings": [{
    "kind": "secrets",
    "title": "GitHub Personal Access Token в истории git",
    "severity": "critical",
    "secret_kind": "github-pat",
    "commit_sha": "a3f8c21d09e1b4c7d2e5f6a0b1c3d4e5f6a7b8c9",
    "file_path": ".env.backup"
  }]
}
```

---

## Дедупликация

При каждом импорте вычисляется `fingerprint`:

```
fingerprint = SHA256(
    lower(cve_id[0] | "") +
    lower(file_path | "") +
    str(cwe_id[0] | 0) +
    lower(component | "") +
    lower(component_version | "")
)
```

Если finding с таким fingerprint уже существует в проекте:

- **Новая запись не создаётся.**
- `last_seen` обновляется до текущего времени.
- `times_seen` инкрементируется на 1.

Два finding считаются одним и тем же, если совпадают CVE, путь к файлу, CWE, компонент и версия.

---

## Частые проблемы

### Finding получает `kind = other`

**Причина:** поле `kind` не задано и ни одна эвристика не совпала.

**Решение:** явно укажите `"kind": "sast"` (или другое подходящее значение).

### Ошибка `unsupported format: no parser matched the input`

**Причина:** в JSON-теле отсутствует поле `source_type` или массив `findings`.

**Решение:** убедитесь, что конверт содержит оба поля:
```json
{"source_type": "my-tool", "findings": [...]}
```

### Ошибка `project_id is required`

**Причина:** `project_id` не передан ни в query-параметре, ни в теле запроса.

**Решение:** добавьте query-параметр `?project_id=<uuid>` или поле `"project_id"` в конверт.

### Ошибка `VALIDATION_ERROR: title is required`

**Причина:** поле `title` в finding пустое или отсутствует.

**Решение:** каждый finding должен содержать непустой `title`.

### Ошибка `403 Forbidden`

**Причина:** текущий пользователь не имеет роли `triager` или выше в указанном проекте.

**Решение:** назначьте пользователю роль `triager` или `project_admin` в настройках проекта.
