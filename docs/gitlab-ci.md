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

- `|| true` / `--exit-code=0`: сканеры часто возвращают non-zero при находках — не блокируем upload.
- `after_script`: upload запускается даже если scanner-job упал.
- `--fail-with-body`: ускоряет дебаг 4xx/5xx за счёт тела ошибки.
- `asset_hint=$CI_PROJECT_PATH`: сохраняем контекст ассета для будущей модели assets.
- OpenGrep в SARIF: парсер SARIF даёт больше метаданных, чем plain JSON.
- Trivy: один прогон (`vuln,misconfig,secret`) вместо трёх.
- TruffleHog в `git` режиме: охват утёкших секретов в истории.
- Gitleaks по текущему дереву: быстрый guard для PR.
