# Интеграции-GitLab-CI

Шаблон загружает готовый отчёт через `POST /api/v1/scans`, проверяет ответ и читает созданный скан. Проект назначается PAT. Поля `project_key` и выбор проекта по имени репозитория сервером не поддерживаются.

## Подготовка

1. Создайте проект Red Lycoris и выпустите PAT со scope `scans:write` как `project_admin` или глобальный администратор.
2. Предоставьте GitLab Runner сетевой доступ к HTTPS-адресу Red Lycoris. Для контейнерного executor нужны доступ к образу и пакетному зеркалу либо подготовленный образ с curl, jq и CA-сертификатами.
3. Задайте переменные CI:

| Переменная | Где задать | Значение |
|---|---|---|
| `RL_URL` | Группа | HTTPS-адрес экземпляра без `/api/v1` |
| `RL_TOKEN` | Каждый репозиторий, masked и protected | PAT соответствующего проекта Red Lycoris |
| `RL_PROJECT_ID` | Каждый репозиторий | Ожидаемый UUID проекта; используется при проверке результата, не отправляется как выбор проекта |
| `RL_CA_FILE` | Группа, переменная типа File, при необходимости | PEM-цепочка внутреннего CA для curl |
| `RL_REPORT_FILE` | Задание | Путь к скачанному артефакту, первоначально `report.json` |
| `RL_SCANNER` | Задание | Имя в записи скана; первоначально `generic` |
| `RL_SCANNER_VERSION` | Задание, необязательно | Версия сканера |
| `RL_UPLOAD_TIMEOUT` | Группа или задание | Ограничение curl в секундах, в шаблоне 300 |

Не задавайте один RL_TOKEN всей группе, если её репозитории должны попадать в разные проекты: все загрузки этим токеном попадут в один проект. Общие URL, CA и таймаут можно наследовать от группы.

Проверка подготовки: переменные видны в настройках с правильными уровнями, PAT принадлежит нужному проекту. Шаблон разрешает загрузку только с protected refs; проверьте, что тестовая ветка защищена и переменная RL_TOKEN доступна заданию. [Правила переменных GitLab](https://docs.gitlab.com/ci/variables/).

## Полный include-шаблон

Сохраните в репозитории приложения как `.gitlab/red-lycoris.yml`. Для общего шаблона можно использовать отдельный репозиторий CI.

~~~yaml
.red-lycoris-upload:
  image: alpine:3.22
  stage: upload
  timeout: 15m
  variables:
    RL_REPORT_FILE: report.json
    RL_SCANNER: generic
    RL_SCANNER_VERSION: ""
    RL_UPLOAD_TIMEOUT: "300"
  rules:
    - if: '$CI_COMMIT_REF_PROTECTED == "true"'
  before_script:
    - apk add --no-cache curl jq ca-certificates
  script:
    - |
      set -eu
      : "${RL_URL:?Задайте RL_URL}"
      : "${RL_TOKEN:?Задайте RL_TOKEN}"
      : "${RL_PROJECT_ID:?Задайте RL_PROJECT_ID}"
      : "${CI_COMMIT_SHA:?Нет SHA коммита}"
      : "${CI_COMMIT_REF_NAME:?Нет имени ref}"
      test -s "$RL_REPORT_FILE"
      case "$RL_URL" in
        https://*) ;;
        *) echo "RL_URL должен использовать HTTPS" >&2; exit 1 ;;
      esac
      set --
      if [ -n "${RL_CA_FILE:-}" ]; then
        test -s "$RL_CA_FILE"
        set -- --cacert "$RL_CA_FILE"
      fi
      response=$(mktemp)
      scan_response=$(mktemp)
      trap 'rm -f "$response" "$scan_response"' EXIT
      code=$(curl --silent --show-error --proto '=https' \
        --connect-timeout 15 --max-time "$RL_UPLOAD_TIMEOUT" \
        "$@" -H "Authorization: Bearer $RL_TOKEN" \
        --form "report=@${RL_REPORT_FILE}" \
        --form-string "commit_sha=$CI_COMMIT_SHA" \
        --form-string "branch=$CI_COMMIT_REF_NAME" \
        --form-string "scanner=$RL_SCANNER" \
        --form-string "scanner_version=$RL_SCANNER_VERSION" \
        --form-string "ci_job_url=$CI_JOB_URL" \
        --output "$response" --write-out '%{http_code}' \
        "${RL_URL%/}/api/v1/scans") || {
          echo "Сетевая ошибка; проверьте сканы перед повтором POST" >&2
          exit 1
        }
      if [ "$code" != 200 ]; then
        echo "Загрузка отклонена, HTTP $code" >&2
        jq -r '.error | {code, request_id}' "$response" >&2 || true
        exit 1
      fi
      jq -e '.data | (.scan_id | type == "string") and
        (.imported | type == "number") and
        (.updated | type == "number") and (.skipped == 0)' "$response" >/dev/null
      scan_id=$(jq -r '.data.scan_id' "$response")
      printf '%s' "$scan_id" | grep -Eq '^[0-9a-fA-F-]{36}$'
      code=$(curl --silent --show-error --proto '=https' \
        --connect-timeout 15 --max-time 60 "$@" \
        -H "Authorization: Bearer $RL_TOKEN" \
        --output "$scan_response" --write-out '%{http_code}' \
        "${RL_URL%/}/api/v1/scans/$scan_id")
      test "$code" = 200
      jq -e --arg project "$RL_PROJECT_ID" --arg sha "$CI_COMMIT_SHA" \
        '.data.scan | .status == "completed" and
        .project_id == $project and .commit_sha == $sha' "$scan_response" >/dev/null
      jq '.data | {scan_id, scanner, imported, updated, skipped, duration_ms}' "$response"
~~~

Шаблон не следует HTTP redirect и не отключает проверку сертификата. Для внутреннего CA используйте RL_CA_FILE. В закрытом контуре замените образ на подготовленный образ из внутреннего реестра и уберите установку пакетов, если curl/jq уже включены. Значение timeout относится к клиенту и не увеличивает таймаут reverse proxy.

## Полный проверочный pipeline

В тестовом репозитории сохраните этот файл как `.gitlab-ci.yml`. Он создаёт синтетическую находку для проверки доставки. Используйте отдельный тестовый проект Red Lycoris.

~~~yaml
include:
  - local: '/.gitlab/red-lycoris.yml'

stages:
  - report
  - upload

prepare-report:
  image: alpine:3.22
  stage: report
  rules:
    - if: '$CI_COMMIT_REF_PROTECTED == "true"'
  script:
    - |
      printf '%s\n' '{"source_type":"ci-smoke","findings":[{"kind":"sast","title":"Проверка доставки CI","severity":"info","file_path":"ci-smoke.txt","line_start":1,"rule_id":"ci-smoke"}]}' > report.json
  artifacts:
    paths:
      - report.json
    expire_in: 1 day

upload-report:
  extends: .red-lycoris-upload
  needs:
    - job: prepare-report
      artifacts: true
~~~

Проверка: оба задания завершились успешно, последнее вывело scan_id и счётчики. В Red Lycoris появился скан со статусом completed, SHA запуска и тестовой находкой. При повторе ожидается новый скан и updated для уже существующей находки.

## Подключение сканера и нового репозитория

1. Замените prepare-report существующим заданием сканера, которое сохраняет нативный JSON или SARIF в artifacts.paths. Передавайте только файл отчёта, без примеси консольных логов.
2. В upload-report укажите имя задания в needs, путь в RL_REPORT_FILE, имя и версию сканера. Для нескольких отчётов создайте отдельные задания загрузки.
3. При подключении другого репозитория выпустите PAT его проекта, задайте RL_TOKEN и RL_PROJECT_ID и подключите тот же include.

Для общего репозитория шаблонов замените local-include на:

~~~yaml
include:
  - project: 'platform/ci-templates'
    ref: 'v1'
    file: '/red-lycoris.yml'
~~~

Замените project, ref и file на свои значения; сохраните шаблон по выбранному пути. Доступ к закрытому репозиторию шаблонов должен быть предоставлен пользователю, запускающему pipeline. Для стабильности закрепите проверенную ревизию шаблона. [Синтаксис include](https://docs.gitlab.com/ci/yaml/#includeproject).

Проверка подключения: CI Lint принимает объединённый YAML; задание получает артефакт нужного сканера, а созданный скан принадлежит ожидаемому UUID проекта и содержит правильный commit_sha. Если сканер завершает работу ненулевым кодом при наличии находок, настройте его политику кодов возврата и передачу artifacts осознанно: этот шаблон запускается после успешного предшествующего задания и не скрывает его сбой.

## Ошибки загрузки

| Симптом | Причина | Решение и проверка |
|---|---|---|
| RL_TOKEN не задан / upload пропущен | Protected variable недоступна текущему ref или ref не защищён | Проверьте правила pipeline и protection; повторите на разрешённой ветке |
| Нет report.json | Неверные needs, artifacts.paths либо RL_REPORT_FILE | Проверьте артефакт задания сканера; test -s должен пройти |
| HTTP 401, UNAUTHORIZED | PAT неверен, отозван или просрочен | Выпустите/подставьте действующий PAT; повторный запрос скана должен дать 200 |
| HTTP 401, AUTHENTICATION_REQUIRED | Нет PAT либо использована пользовательская сессия на /scans | Передайте PAT; проверьте data.scan_id после загрузки |
| HTTP 403, INSUFFICIENT_SCOPE | У PAT нет scans:write | Выпустите PAT с нужным scope и повторите |
| HTTP 400, VALIDATION_ERROR | Нет commit_sha/branch/report, неверная multipart-форма или превышен лимит тела | Проверьте поля, размер и лимиты; успешная загрузка должна вернуть data |
| HTTP 400, PARSE_ERROR | Неподдерживаемая структура, повреждённый либо нераспознаваемый пустой отчёт | Сверьте [таблицу парсеров](Интеграции-Поддерживаемые-сканеры); проверьте format на контрольном отчёте |
| HTTP 413 | Ограничение размера на reverse proxy | Согласуйте его с лимитом backend; повторите с допустимым отчётом |
| HTTP 429 | На /scans собственного rate limit нет; проверьте proxy или промежуточный сервис | Определите источник по его логам; после ожидания сначала проверьте, не создан ли скан |
| Сетевой таймаут или 5xx | Ошибка связи, proxy или backend; исход POST может быть неизвестен | Сверьте сканы по SHA/ветке, проверьте серверные логи; не запускайте слепые повторы |
| Загрузка дала 200, проверка проекта не прошла | Подставлен PAT другого проекта | Найдите созданный скан, исправьте RL_TOKEN и RL_PROJECT_ID; проверьте следующий скан |

## Источники

[Контракт обработчика](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/scans.go), [проверка scopes](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/api/auth_middleware.go), [форматы](https://github.com/Nefrit0n/Red-Lycoris/blob/main/backend/internal/parser/detect.go).
