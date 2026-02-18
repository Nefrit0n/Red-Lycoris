# Integration Tokens UX update

## Что изменили

- Переработали страницу в формат Token Management Console: заголовок, security-подсказка, KPI-чипы, фильтры, selection bar, таблица с безопасными действиями, details drawer.
- Перенесли destructive операции revoke в confirm dialog для single и bulk сценариев.
- Добавили безопасный рендер дат и автора создания токена.
- Упростили рендер permissions в таблице: вместо набора чипов показываем `N scopes` и список в tooltip.
- Доработали create flow: scope org/project, expiration пресеты, permissions, one-time token secret + copy + `I saved it`.

## Loading и Empty состояния

- Таблица не схлопывается на loading: всегда виден `thead` и фиксированная высота контейнера (`min-height`), отображаются 5 skeleton rows.
- Empty state без фильтров: `No integration tokens yet` + CTA `Create token`.
- Empty state при активных фильтрах: `Nothing matches current filters` + CTA `Clear filters`.

## Поведение revoke / confirm

- **Single revoke**: доступно из row actions и из details drawer, всегда открывает confirm dialog.
- **Bulk revoke**: работает через selection bar, кнопка disabled при `0 selected`, перед выполнением всегда confirm dialog.
- После успешного revoke selection очищается, список перезагружается.

## Mapping token DTO -> UI

- `name` -> Name.
- `tenant.project_id` -> Scope (`Project`) и project context в details.
- `scopes[]` -> Permissions (`N scopes`) + tooltip list.
- `state` + `expires_at` -> Status (`Active`/`Revoked`/`Expired`).
- `last_used_at` -> Last used (`Never`, если дата отсутствует/невалидна).
- `expires_at` -> Expires (`—`, если отсутствует/невалидна).
- `created_at` -> Created (`—`, если невалидна).
- `created_by` (string/object) -> Created by по приоритету `name -> email -> id -> System`.

## Date formatting

- Используются единые утилиты:
  - `formatDate(value, fallback)` — безопасное форматирование даты;
  - `formatRelative(value, fallback)` — безопасный относительный формат.
- При `null/undefined/invalid` строка `Invalid Date` не допускается: всегда fallback (`—`/`Never`).
