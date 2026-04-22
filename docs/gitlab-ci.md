# GitLab CI интеграция с Red Lycoris

## Модель доступа

Рекомендуемая модель: **один GitLab-проект = один проект Red Lycoris = один API-токен**.
Для CI достаточно scope `scans:write`.

## Получение токена

1. Откройте проект в Red Lycoris.
2. Перейдите в настройки проекта → вкладка API Tokens.
3. Создайте токен со scope `scans:write`.
4. Сохраните токен сразу после генерации (повторно он не показывается).

## Добавление токена в GitLab

`Settings → CI/CD → Variables`:

- Key: `REDLYCORIS_TOKEN`
- Value: `rl_pat_...`
- **Masked: включить обязательно**
- Protected: опционально (зависит от вашей модели релизов)

Также добавьте `REDLYCORIS_URL`, например `https://redlycoris.example.com`.

## Готовый `.gitlab-ci.yml`

```yaml
stages:
  - security

variables:
  REDLYCORIS_URL: "https://redlycoris.example.com"
  # REDLYCORIS_TOKEN → Settings → CI/CD → Variables (Masked)

.redlycoris_upload: &redlycoris_upload
  after_script:
    - |
      if [ -f "$REPORT_FILE" ]; then
        curl --fail-with-body --silent --show-error \
          -H "Authorization: Bearer $REDLYCORIS_TOKEN" \
          -F "commit_sha=$CI_COMMIT_SHA" \
          -F "branch=$CI_COMMIT_REF_NAME" \
          -F "scanner=$SCANNER_NAME" \
          -F "scanner_version=${SCANNER_VERSION:-unknown}" \
          -F "ci_job_url=$CI_JOB_URL" \
          -F "asset_hint=$CI_PROJECT_PATH" \
          -F "report=@$REPORT_FILE" \
          "$REDLYCORIS_URL/api/v1/scans" || echo "::warning::upload to redlycoris failed"
      else
        echo "::warning::$REPORT_FILE not found, skipping upload"
      fi

opengrep:
  stage: security
  image: ghcr.io/opengrep/opengrep:latest
  variables:
    REPORT_FILE: opengrep.sarif
    SCANNER_NAME: opengrep
  script:
    - opengrep --version | tee /tmp/ver && export SCANNER_VERSION=$(cat /tmp/ver | head -1)
    - opengrep scan --config auto --sarif --output $REPORT_FILE . || true
  artifacts:
    paths: [opengrep.sarif]
    when: always
    expire_in: 1 week
  <<: *redlycoris_upload

trivy_fs:
  stage: security
  image:
    name: aquasec/trivy:latest
    entrypoint: [""]
  variables:
    REPORT_FILE: trivy.json
    SCANNER_NAME: trivy
    TRIVY_NO_PROGRESS: "true"
    TRIVY_CACHE_DIR: .trivycache
  cache:
    paths: [.trivycache]
  script:
    - export SCANNER_VERSION=$(trivy --version | head -1 | awk '{print $2}')
    - trivy fs --scanners vuln,misconfig,secret --format json --output $REPORT_FILE . || true
  artifacts:
    paths: [trivy.json]
    when: always
    expire_in: 1 week
  <<: *redlycoris_upload

trufflehog:
  stage: security
  image:
    name: trufflesecurity/trufflehog:latest
    entrypoint: [""]
  variables:
    REPORT_FILE: trufflehog.json
    SCANNER_NAME: trufflehog
  script:
    - export SCANNER_VERSION=$(trufflehog --version 2>&1 | head -1 | awk '{print $NF}')
    - trufflehog git file://. --json --no-update > $REPORT_FILE || true
  artifacts:
    paths: [trufflehog.json]
    when: always
    expire_in: 1 week
  <<: *redlycoris_upload

gitleaks:
  stage: security
  image:
    name: zricethezav/gitleaks:latest
    entrypoint: [""]
  variables:
    REPORT_FILE: gitleaks.json
    SCANNER_NAME: gitleaks
  script:
    - export SCANNER_VERSION=$(gitleaks version 2>&1 | head -1)
    - gitleaks detect --source=. --report-path=$REPORT_FILE --report-format=json --exit-code=0
  artifacts:
    paths: [gitleaks.json]
    when: always
    expire_in: 1 week
  <<: *redlycoris_upload
```

## Почему именно так

### `|| true` и `--exit-code=0` у сканеров

Большинство сканеров возвращают ненулевой exit code именно тогда, когда **находят** что-то. Без `|| true` / `--exit-code=0` GitLab пометит job как failed до того, как `after_script` успеет отправить отчёт в Red Lycoris — и находки не приедут. Решение о том, блокировать ли пайплайн на основе severity, принимается **в платформе**, где уже есть триаж, исключения и SLA, а не в CI-скрипте.

### `after_script` вместо `script`

`after_script` выполняется **всегда** — даже если основной блок `script` упал. Это критично: сканер падает именно тогда, когда нашёл что-то серьёзное. Если поставить upload в `script`, при падении сканера отчёт не дойдёт до платформы и находки потеряются.

### `--fail-with-body` у curl

По умолчанию curl при HTTP 4xx/5xx выводит только `curl: (22) The requested URL returned error`. `--fail-with-body` добавляет тело ответа в вывод, что позволяет сразу увидеть, например, `{"error":{"code":"INSUFFICIENT_SCOPE",...}}` прямо в логах GitLab, не разворачивая дополнительные инструменты отладки.

### `asset_hint=$CI_PROJECT_PATH`

Поле сохраняется в `scans.asset_hint` для будущей модели ассетов. Сейчас не используется платформой активно, но позволит ретроспективно связать существующие сканы с ассетами, когда эта функциональность появится.

### OpenGrep — SARIF, не JSON

Red Lycoris имеет зрелый `SARIFParser` с извлечением CVE из taxonomy, кодовых сниппетов и связей между правилами и находками. В SARIF `tool.driver.name` автоматически становится `source_type` («opengrep»). Вариант `--json` тоже поймёт `SemgrepParser`, но SARIF даёт больше метаданных при той же сложности настройки.

### Trivy — один прогон с `vuln,misconfig,secret`

Единственный вызов вместо трёх раздельных (`trivy fs --scanners vuln`, `--scanners misconfig`, `--scanners secret`) сокращает время пайплайна и упрощает управление артефактами. Все три категории находок попадают в один JSON-файл и импортируются одним запросом.

### TruffleHog в режиме `git`, Gitleaks — по дереву: намеренное дублирование

TruffleHog в режиме `git file://.` сканирует **всю историю коммитов** — это его ключевое преимущество: он найдёт секрет, который был добавлен 6 месяцев назад и удалён месяц назад. Gitleaks в режиме `detect` сканирует **текущее состояние** файлов — быстро, без git-истории, отлично подходит для проверки каждого PR.

Дублирование намеренное: у инструментов разные regex-движки и разные false-positive'ы. Red Lycoris склеивает дубли по fingerprint, поэтому лишних записей в базе не появится, зато покрытие выше.
