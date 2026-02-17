# lw CLI

`lw` — легковесный CLI для GitLab-only ingestion.

## Команда

```bash
lw upload \
  --endpoint https://red-lycoris.example \
  --project my-project \
  --token "$LW_TOKEN" \
  --artifact gl-sast-report.json:format=gitlab-sast
```

## Флаги `upload`

- `--endpoint` (required)
- `--project` (required)
- `--token` (required; только через флаг, CLI его не печатает)
- `--artifact <path[:k=v,...]>` (repeatable)
- `--ci gitlab|auto` (default `auto`)
- `--enrich env,git` (default `env`)
- `--idempotency-key` (optional; иначе вычисляется детерминированно)
- `--state-file` (resume state, default `.lw-upload-state.json`)
- `--max-concurrency` (default `4`)
- `--log json|text` (default `text`)

## Пример локально

```bash
lw upload \
  --endpoint http://localhost:8080 \
  --project demo-project \
  --token "$LW_TOKEN" \
  --artifact ./reports/trivy.json:format=trivy-json,tool_name=trivy,tool_version=0.58.1
```

## Пример в GitLab CI

```yaml
upload_security_reports:
  image: golang:1.24
  script:
    - go build -o lw ./backend/cmd/lw
    - ./lw upload --endpoint https://red-lycoris.example --project "$CI_PROJECT_PATH" --token "$LW_TOKEN" --artifact gl-sast-report.json:format=gitlab-sast
```

## Безопасность

- Собирается только allowlist GitLab `CI_*` переменных (без полного дампа env).
- На `/runs:init` ставится `X-Idempotency-Key`.
- Поддерживаются retry с backoff+jitter и `Retry-After` для `429/5xx`.
- `state-file` позволяет resume без повторной отправки уже загруженных object key.
