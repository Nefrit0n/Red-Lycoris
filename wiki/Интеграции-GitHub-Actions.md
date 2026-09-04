# Интеграции-GitHub-Actions

Reusable workflow принимает артефакт текущего workflow run и загружает его в проект Red Lycoris. Сам сканер выполняется в предшествующем задании. Используется PAT Red Lycoris со scope `scans:write`; `GITHUB_TOKEN` не подходит для аутентификации в Red Lycoris.

## Подготовка

1. Как `project_admin` или глобальный администратор выпустите PAT целевого проекта.
2. Задайте Actions variables и secrets в настройках репозитория или организации:

| Настройка | Тип | Значение |
|---|---|---|
| `RL_URL` | Variable | HTTPS-адрес без `/api/v1` |
| `RL_PROJECT_ID` | Variable репозитория | UUID ожидаемого проекта для проверки результата |
| `RL_TOKEN` | Secret репозитория | PAT этого проекта |
| `RL_CA_PEM` | Необязательный secret | PEM-цепочка внутреннего CA |
| `RL_RUNNER` | Variable | Метка Linux runner с доступом к Red Lycoris, например self-hosted |

3. Если храните PAT на уровне организации, создайте отдельный секрет для каждого проекта Red Lycoris, например RL_TOKEN_BILLING, и разрешите его только соответствующим репозиториям. В вызывающем workflow передайте выбранный секрет в параметр RL_TOKEN. Общий PAT для всех репозиториев направит все отчёты в один проект.
4. Подготовьте runner с Bash, curl, jq, доверенными CA и доступом к хранилищу артефактов GitHub и серверу Red Lycoris.

Проверка: runner доступен, переменные настроены, политика доступа к organization secrets включает вызывающий репозиторий. Секреты в reusable workflow передаются явно; не передавайте PAT заданиям, выполняющим непроверенный код внешних pull request. [Секреты Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

## Полный reusable workflow

Сохраните как `.github/workflows/red-lycoris-upload.yml`. Пример использует upload/download-artifact v4 и предназначен для GitHub.com. Для GitHub Enterprise Server подберите поддерживаемый механизм артефактов: v4 не поддерживается на GHES. [Ограничения download-artifact](https://github.com/actions/download-artifact).

~~~yaml
name: Загрузка отчёта в Red Lycoris

on:
  workflow_call:
    inputs:
      rl_url:
        required: true
        type: string
      project_id:
        required: true
        type: string
      artifact_name:
        required: true
        type: string
      report_file:
        type: string
        default: report.json
      scanner:
        required: true
        type: string
      scanner_version:
        type: string
        default: ""
      commit_sha:
        required: true
        type: string
      branch:
        required: true
        type: string
      runner:
        type: string
        default: self-hosted
      upload_timeout:
        type: number
        default: 300
    secrets:
      RL_TOKEN:
        required: true
      RL_CA_PEM:
        required: false

permissions:
  contents: read

jobs:
  upload:
    runs-on: ${{ inputs.runner }}
    timeout-minutes: 15
    steps:
      - name: Скачать отчёт
        uses: actions/download-artifact@v4
        with:
          name: ${{ inputs.artifact_name }}
          path: reports

      - name: Загрузить и проверить скан
        shell: bash
        env:
          RL_URL: ${{ inputs.rl_url }}
          RL_PROJECT_ID: ${{ inputs.project_id }}
          RL_TOKEN: ${{ secrets.RL_TOKEN }}
          RL_CA_PEM: ${{ secrets.RL_CA_PEM }}
          RL_REPORT_FILE: ${{ inputs.report_file }}
          RL_SCANNER: ${{ inputs.scanner }}
          RL_SCANNER_VERSION: ${{ inputs.scanner_version }}
          RL_COMMIT_SHA: ${{ inputs.commit_sha }}
          RL_BRANCH: ${{ inputs.branch }}
          RL_UPLOAD_TIMEOUT: ${{ inputs.upload_timeout }}
          RL_CI_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          set -euo pipefail
          : "${RL_URL:?Задайте адрес}"
          : "${RL_TOKEN:?Задайте PAT}"
          : "${RL_PROJECT_ID:?Задайте проект}"
          : "${RL_COMMIT_SHA:?Задайте коммит}"
          : "${RL_BRANCH:?Задайте ветку}"
          case "$RL_URL" in
            https://*) ;;
            *) echo "RL_URL должен использовать HTTPS" >&2; exit 1 ;;
          esac
          report="reports/$RL_REPORT_FILE"
          test -s "$report"
          work=$(mktemp -d)
          trap 'rm -rf -- "$work"' EXIT
          tls=()
          if [ -n "$RL_CA_PEM" ]; then
            printf '%s\n' "$RL_CA_PEM" > "$work/ca.pem"
            tls=(--cacert "$work/ca.pem")
          fi
          code=$(curl --silent --show-error --proto '=https' \
            --connect-timeout 15 --max-time "$RL_UPLOAD_TIMEOUT" \
            "${tls[@]}" -H "Authorization: Bearer $RL_TOKEN" \
            --form "report=@$report" \
            --form-string "commit_sha=$RL_COMMIT_SHA" \
            --form-string "branch=$RL_BRANCH" \
            --form-string "scanner=$RL_SCANNER" \
            --form-string "scanner_version=$RL_SCANNER_VERSION" \
            --form-string "ci_job_url=$RL_CI_URL" \
            --output "$work/response.json" --write-out '%{http_code}' \
            "${RL_URL%/}/api/v1/scans") || {
              echo "Сетевая ошибка; проверьте сканы перед повтором POST" >&2
              exit 1
            }
          if [ "$code" != 200 ]; then
            echo "Загрузка отклонена, HTTP $code" >&2
            jq -r '.error | {code, request_id}' "$work/response.json" >&2 || true
            exit 1
          fi
          jq -e '.data | (.scan_id | type == "string") and
            (.imported | type == "number") and
            (.updated | type == "number") and (.skipped == 0)' "$work/response.json" >/dev/null
          scan_id=$(jq -r '.data.scan_id' "$work/response.json")
          [[ "$scan_id" =~ ^[0-9a-fA-F-]{36}$ ]]
          code=$(curl --silent --show-error --proto '=https' \
            --connect-timeout 15 --max-time 60 "${tls[@]}" \
            -H "Authorization: Bearer $RL_TOKEN" \
            --output "$work/scan.json" --write-out '%{http_code}' \
            "${RL_URL%/}/api/v1/scans/$scan_id")
          test "$code" = 200
          jq -e --arg project "$RL_PROJECT_ID" --arg sha "$RL_COMMIT_SHA" \
            '.data.scan | .status == "completed" and
            .project_id == $project and .commit_sha == $sha' "$work/scan.json" >/dev/null
          jq '.data | {scan_id, scanner, imported, updated, skipped, duration_ms}' "$work/response.json"
~~~

## Полный вызывающий workflow

Сохраните как `.github/workflows/red-lycoris-smoke.yml` в том же репозитории. Задайте RL_RUNNER для обоих заданий. Этот ручной запуск создаёт синтетическую находку; используйте тестовый проект.

~~~yaml
name: Проверка интеграции Red Lycoris

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  report:
    runs-on: ${{ vars.RL_RUNNER }}
    steps:
      - name: Подготовить контрольный отчёт
        shell: bash
        run: |
          printf '%s\n' '{"source_type":"ci-smoke","findings":[{"kind":"sast","title":"Проверка доставки CI","severity":"info","file_path":"ci-smoke.txt","line_start":1,"rule_id":"ci-smoke"}]}' > report.json
      - name: Сохранить артефакт
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: report.json
          if-no-files-found: error
          retention-days: 1

  upload:
    needs: report
    uses: ./.github/workflows/red-lycoris-upload.yml
    with:
      rl_url: ${{ vars.RL_URL }}
      project_id: ${{ vars.RL_PROJECT_ID }}
      artifact_name: security-report
      report_file: report.json
      scanner: generic
      commit_sha: ${{ github.sha }}
      branch: ${{ github.ref_name }}
      runner: ${{ vars.RL_RUNNER }}
    secrets:
      RL_TOKEN: ${{ secrets.RL_TOKEN }}
      RL_CA_PEM: ${{ secrets.RL_CA_PEM }}
~~~

Проверка: оба задания завершаются успешно, вывод upload содержит scan_id, imported/updated. Workflow дополнительно проверяет completed, UUID проекта и SHA через GET скана. Откройте скан в интерфейсе и проверьте контрольную находку.

## Подключение рабочего отчёта

1. В задании report замените создание синтетического JSON запуском своего сканера. Сохраните отчёт через upload-artifact под именем, которое передаётся в artifact_name.
2. Укажите report_file относительно корня скачанного артефакта, scanner и scanner_version. Не объединяйте разные JSON-файлы простой конкатенацией.
3. Передайте commit_sha и branch проверявшегося исходного кода. Для pull request это могут быть SHA исходной ветки или тестового merge — выбор должен соответствовать фактически проверенному checkout.
4. Для общего workflow организации перенесите reusable-файл в её репозиторий CI и замените uses на `ваша-организация/ci/.github/workflows/red-lycoris-upload.yml@проверенная-ревизия`. Разрешите его использование вызывающим репозиториям и передайте их PAT явно.

Проверка: скачан артефакт именно текущего запуска, scanner/SHA/branch соответствуют проверке, скан принадлежит целевому проекту. Не добавляйте автоматические повторы POST после сетевой ошибки: сначала установите, не был ли скан уже сохранён. При ошибке GET после успешного POST сначала повторите проверку скана, а не загрузку отчёта.

Структура вызова и передача inputs/secrets соответствуют [reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows). Для внешнего workflow используйте проверенную ревизию, а не произвольную движущуюся ветку.

## Диагностика

| Симптом | Что проверить | Проверка после исправления |
|---|---|---|
| Артефакт не найден | Совпадение artifact_name, результат report и наличие upload-artifact в том же run | Шаг скачивания получает report.json |
| RL_TOKEN пуст | Политику organization secret и явную передачу secrets | Авторизованный GET скана возвращает 200 |
| Runner недоступен или сервер не разрешается | Метку RL_RUNNER, DNS и маршрут от runner до экземпляра | Задание получает HTTP-ответ от Red Lycoris |
| Ошибка доверия TLS | RL_CA_PEM и цепочку сертификатов сервера | curl проходит без отключения проверки TLS |
| 401/403/400/413/429/5xx | [Общие ошибки загрузки](Интеграции-GitLab-CI) | HTTP 200 и успешная проверка data.scan |
| HTTP 200, но задание проверки не прошло | Ожидаемый project_id, SHA, доступность GET; не подставлен ли PAT другого проекта | GET показывает completed и нужные значения |

## Источники

[Обработчик сканов](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/scans.go), [маршруты](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/router.go), [проверка PAT](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/session_middleware.go).
