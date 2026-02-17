# UX/UI Specification — страница «Анализ» (Analyze)

> Red Lycoris · ASOC Platform · Версия 1.0 · 2026-02-17

---

## A) Key Takeaways

- **Главная проблема** — высота контента шага (step content) непредсказуема: ProductSection ≈80 px, SourceSection ≈180 px, ScannerSection ≈380 px. Итог: карточка-мастер прыгает по высоте при каждом переходе между шагами.
- **Таблица истории** при загрузке и пустом состоянии теряет структуру: исчезают колонки, ширина сжимается, нет скелетона — пользователь видит «дырку» там, где только что была таблица.
- **CTA «Запустить анализ»** доступна на любом шаге вне зависимости от готовности, но валидация — только в `handleSubmit` через toast. Кнопка должна быть disabled до завершения всех 3 шагов.
- **Детальная страница** не показывает общий прогресс (X/Y сканеров), ошибки прячет в Tooltip, не предлагает быстрых действий (Retry/Copy Error).
- **Степпер** не интерактивен (клик по шагу не переключает), нет подсказок под лейблами, кнопка «Далее» на последнем шаге заменяется `<Box />` — неожиданный сдвиг layout.

---

## B) Issues List

| # | Screen / Block | Проблема | Severity | Fix |
|---|----------------|----------|----------|-----|
| 1 | `AnalyzeJobsPage` → step content box | `minHeight: 200` — недостаточно для ScannerSection (≈380 px реального контента), вызывает CLS при переходе к шагу 3 | HIGH | Поднять `minHeight` до `{ xs: 320, sm: 380 }` или использовать `AnimateHeight` |
| 2 | `AnalyzeJobsPage` → nav row (шаг 3) | `<Box />` вместо правой кнопки — правая часть `justifyContent="space-between"` схлопывается | HIGH | Заменить `<Box />` на `<Box sx={{ width: 88 }} />` (ширина кнопки) или отображать кнопку disabled |
| 3 | `RunSummary` → CTA | «Запустить анализ» enabled при любом состоянии мастера; валидация только в runtime через toast | HIGH | Передавать `canSubmit: boolean` (все 3 шага валидны); disabled пока `!canSubmit || submitting` |
| 4 | `RecentAnalyses` → loading state | CircularProgress заменяет всю таблицу — нет колонок, ширина схлопывается | HIGH | Показывать skeleton-строки (5 строк × 7 колонок) при `loading === true`, сохраняя структуру таблицы |
| 5 | `RecentAnalyses` → empty state | Один `<td colSpan={7}>` с текстом — таблица сужается до минимума | MEDIUM | Сохранять `<thead>` и показывать 3 «ghost»-строки (opacity 0.3 + текст-заглушка) + overlay с иконкой и CTA |
| 6 | `AnalysisJobDetail` → scanner error | `errorMessage` показывается только в `Tooltip` на чипе — легко пропустить | HIGH | Показывать `errorMessage` inline под строкой сканера в `<Alert severity="error" size="small">` с кнопкой Copy |
| 7 | `AnalysisJobDetail` → нет общего прогресса | Нет "X/Y сканеров завершено", нет общей длительности в live-режиме | MEDIUM | Добавить `ScannerProgress` блок: `LinearProgress` + "3 / 6 завершено · 00:01:42" |
| 8 | `AnalysisJobDetail` → findings section | Кнопка «Перейти к находкам» рендерится только при `findingsTotal > 0` → CLS | MEDIUM | Всегда рендерить кнопку; `disabled` и `opacity: 0.4` когда `findingsTotal === 0` |
| 9 | `RunSummary` → lastJobId | `"Открыть анализ {full-uuid}"` — полный UUID в кнопке | LOW | Показывать только первые 8 символов: `"→ Анализ #a1b2c3d4"` с иконкой ExternalLink |
| 10 | `AnalyzeJobsPage` → step content | ScannerSection — нет визуального индикатора активного пресета при ручном выборе (пресет «не выбран», но все 4 кнопки outlined) | LOW | Добавить пресет «Вручную» или показывать «Кастомно» когда совпадения нет |
| 11 | `RecentAnalyses` → фильтры | Опции фильтров формируются из `jobs` — при пустом `jobs` фильтры бесполезны и вводят в заблуждение | LOW | Скрывать фильтры при `jobs.length === 0` или отключать select-ы |
| 12 | `AnalyzeJobsPage` → Stepper | Шаги нельзя кликать для навигации — нарушает привычный UX мастеров | MEDIUM | Добавить `onClick` для завершённых шагов (шаги с индексом < activeStep) |
| 13 | `AnalysisJobDetail` → log entries | Лог: `• Запуск сканера — дата` — нет иерархии, timestamp трудно отличить от текста | LOW | Оформить как timeline: иконка-точка (цвет по статусу) + bold label + dim timestamp |
| 14 | `AnalysisJobDetail` → overview grid | `gridTemplateColumns: "1fr 1fr 1fr 1fr"` на desktop без `minWidth` → ячейки сжимаются при длинных значениях | LOW | Добавить `minWidth: 120` на ячейку, использовать `overflow: hidden; textOverflow: ellipsis` |
| 15 | `SourceSection` → latest mode | Текст «Снапшоты ещё не загружались» при `!latestSnapshot` — не объясняет что делать | MEDIUM | Заменить на «Нет снапшотов для этого продукта. [Загрузить первый →]» с action-ссылкой на upload-режим |

---

## C) Layout Proposal

### Страница «Анализ» — общая сетка

```
┌────────────────────────────────────────────────────────────────────────────┐
│  maxWidth: 1200px, mx: auto, px: { xs: 16, md: 32 }, py: { xs: 24, md: 32}│
│                                                                            │
│  <Stack spacing={3}>                                                       │
│    <AnalyzeHeader />          — фиксированная высота ~64px                │
│                                                                            │
│    <Stack direction="row" spacing={3} alignItems="flex-start">            │
│      <Card flex={1} minWidth={0}>   ← МАСТЕР (stepper + content + nav)   │
│        minHeight: 540px             ← ФИКСИРОВАННАЯ минимальная высота    │
│        display: flex                                                       │
│        flexDirection: column                                               │
│        justifyContent: space-between                                       │
│      </Card>                                                               │
│      <Card width={{ xs:"100%", lg: 320 }} position="sticky" top={24}>     │
│        ← РУNSUMMARY sticky sidebar                                        │
│      </Card>                                                               │
│    </Stack>                                                                │
│                                                                            │
│    <Box ref={historyRef}>                                                  │
│      <RecentAnalyses />       — таблица с фиксированными колонками        │
│    </Box>                                                                  │
│    <PaginationControl />                                                   │
│  </Stack>                                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Мастер — внутренняя структура

```
CardContent (flex: 1, display: flex, flexDirection: column)
  ├── <Stepper>                          height: 56px (фиксировано)
  ├── <Divider sx={{ my: 2 }} />
  ├── <Box sx={{ flex: 1, minHeight: 360, overflowY: "auto" }}>
  │     {stepContent}                   ← контент растёт внутрь, не толкает nav
  │   </Box>
  └── <Stack direction="row" justifyContent="space-between"
           sx={{ pt: 2, borderTop: "1px solid divider" }}>
        <Button>Назад</Button>           ← всегда рендерится (disabled на шаге 0)
        <Button>Далее / placeholder</Button>  ← width: 88px всегда
      </Stack>
```

**Ключевые размеры:**
| Элемент | Значение |
|---------|----------|
| Карточка мастера min-height | 540px |
| Step content min-height | 360px |
| RunSummary ширина (lg+) | 320px |
| RunSummary sticky top | 24px |
| Таблица строка min-height | 52px |
| Таблица skeleton строк | 5 шт |
| Колонка ID | 96px (фиксировано) |
| Колонка Статус | 120px (фиксировано) |
| Колонка Время | 80px (фиксировано) |
| Колонка Создан | 140px (фиксировано) |
| Остальные | flex: 1 |

### Таблица истории — состояния

| Состояние | Поведение |
|-----------|-----------|
| `loading = true` | `<thead>` сохраняется, `<tbody>` = 5 `<Skeleton>` строк (variant="text") |
| `jobs = []` | `<thead>` + пустые 3 строки-«ghost» (opacity 0.15) + центральный overlay: иконка + "Анализов пока нет" + кнопка "Запустить первый анализ" |
| `filteredJobs = []` (активный фильтр) | Как выше, но текст: "Нет анализов по фильтру" + "Сбросить фильтры" |
| Данные есть | Обычная таблица |

---

## D) CTA & States

### Матрица кнопок мастера

| Условие | «Назад» | «Далее» | «Запустить анализ» |
|---------|---------|---------|-------------------|
| Шаг 0, продукт не выбран | disabled | disabled | disabled |
| Шаг 0, продукт выбран | disabled | **active** | disabled |
| Шаг 1, источник не готов | active | disabled | disabled |
| Шаг 1, источник готов | active | **active** | disabled |
| Шаг 2, сканеры не выбраны | active | (hidden/ghost) | disabled |
| Шаг 2, сканеры выбраны | active | (hidden/ghost) | **active** |
| `submitting = true` | disabled | (hidden/ghost) | disabled + spinner |

### Определение `canSubmit`

```typescript
const canSubmit = useMemo(() => {
  if (!selectedProductId) return false;
  if (sourceMode === "latest" && !latestSnapshot) return false;
  if (sourceMode === "select" && !selectedSnapshotId) return false;
  if ((sourceMode === "upload" || sourceMode === "ephemeral") && !archive) return false;
  if (selectedScanners.length === 0) return false;
  return true;
}, [selectedProductId, sourceMode, latestSnapshot, selectedSnapshotId, archive, selectedScanners]);
```

`canSubmit` передаётся в `RunSummary` как проп. Кнопка: `disabled={!canSubmit || submitting}`.

### Синхронизация мастера и RunSummary

- RunSummary **не является шагом** — это "live preview" конфигурации
- Кнопка «Запустить анализ» активируется ТОЛЬКО когда все 3 шага валидны (через `canSubmit`)
- Пользователь может нажать «Запустить анализ» с любого шага, если все данные заполнены — это **намеренный UX** для возврата к середине и повторного запуска с другими параметрами

---

## E) Stepper Improvements

### Шаг 1 — Продукт

- **Лейбл шага:** "Продукт" → **"Продукт"** (без изменений)
- **Подсказка под лейблом:** `"Выберите приложение для анализа"`
- **Состояние поля:** При пустом значении: helper text `"Обязательное поле"` (color: text.secondary, не error до попытки Submit)
- **После выбора:** под полем показывать `"✓ {productName}"` с зелёным чекмарком (caption)
- **Создать продукт:** кнопка-ссылка "+ Новый продукт" рядом с полем (не внутри диалога по умолчанию)

### Шаг 2 — Источник

- **Лейбл шага:** "Источник" → **"Исходники"**
- **Подсказка под лейблом:** `"Код или архив для сканирования"`
- **Радио-кнопки** — добавить описание:
  - `"Последний снапшот"` → sub-label: дата + размер (если есть) или `"Снапшотов нет — выберите другой режим"`
  - `"Из списка"` → sub-label: `"N снапшотов доступно"`
  - `"Загрузить (сохранить)"` → sub-label: `"Сохраняется в истории продукта"`
  - `"Только для задачи"` → sub-label: `"Не сохраняется"`
- **Валидация:** При `sourceMode === "latest"` и `!latestSnapshot` — показывать inline warning под radio (не только в `handleSubmit`)

### Шаг 3 — Сканеры

- **Лейбл шага:** "Сканеры" (без изменений)
- **Подсказка под лейблом:** `"Что именно проверяем"`
- **Пресеты** — добавить `"Вручную"` при нестандартном наборе (или показывать outline без активного)
- **Описание пресета:** `title` атрибут / tooltip при hover: список сканеров в пресете
- **Счётчик:** под сеткой: `"Выбрано: 3 сканера · ~4–10 мин"` (суммарный estimatedTime)
- **Advanced toggle:** "Показать все сканеры" (если в будущем список расширится)

### Навигационная строка

```
[Назад]                           [Далее →]
  disabled на шаге 0        disabled если !canProceed
                             на шаге 2: отсутствует, НО занимает то же место (opacity: 0)
```

---

## F) Analysis Details Page Improvements

### Блок общего прогресса (новый, вверху карточки "Сканеры")

```
┌─────────────────────────────────────────────────────────────────┐
│  Прогресс: ████████░░░░  3 / 6 завершено  ·  01:23 прошло      │
│  [Текущий: Trivy — выполняется...]                              │
└─────────────────────────────────────────────────────────────────┘
```

- **Показывать только при** `status === "processing" | "queued"`
- `LinearProgress variant="determinate" value={(completed/total)*100}`
- Elapsed time: `Date.now() - new Date(job.startedAt).getTime()` обновляется каждую секунду отдельным `setInterval`
- Текущий активный сканер: первый с `status === "running" | "processing"`

### Ошибки сканера — исправленный вид

**Вместо Tooltip:**
```
┌─ Trivy  [Ошибка ×]  2 мин 14 сек                    [JSON↓] ──┐
│                                                                   │
│  ┌── Ошибка ────────────────────────────────────────────────┐   │
│  │  exit code 1: database update failed: timeout          │   │
│  │                                          [Копировать □] │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

- Chip с текстом ошибки убрать; вместо него inline `Alert severity="error"` с `variant="outlined"` под строкой сканера
- Кнопка **"Копировать"** — копирует `errorMessage` в clipboard
- Если `errorMessage` длиннее 200 символов — показывать truncated + "Показать полностью"

### Быстрые действия (header карточки)

| Действие | Условие | Поведение |
|----------|---------|-----------|
| **Cancel** | `status === "queued" \| "processing"` | API: `DELETE /analyze/{id}` или `POST /analyze/{id}/cancel` |
| **Retry failed** | `status === "failed"` или есть сканеры с `status === "failed"` | Перезапустить только упавшие сканеры (если API поддерживает) или весь job |
| **Rerun** | `status === "succeeded" \| "failed"` | Создать новый job с теми же параметрами |
| **Download all** | Есть хотя бы 1 артефакт | Скачать все JSON-артефакты (ZIP или по одному) |

### Log Timeline — улучшенный вид

```
  ●─ 14:23:01  Запуск сканера          (●: зелёный)
  ●─ 14:23:45  Сканирование завершено  (●: зелёный)
  ●─ 14:23:45  Артефакт готов          (●: синий)

  ●─ 14:23:01  Запуск сканера          (●: серый)
  ◐─ (live)    Выполняется...          (◐: анимированный)

  ●─ 14:23:01  Запуск сканера          (●: серый)
  ✗─ 14:23:10  Ошибка: exit code 1    (✗: красный)
```

### Секция "Находки" — без CLS

```tsx
// Всегда рендерить, менять только disabled-состояние кнопки
<Button
  variant="outlined"
  size="small"
  disabled={job.findingsTotal === 0}
  sx={{ alignSelf: "flex-start", opacity: job.findingsTotal === 0 ? 0.4 : 1 }}
  onClick={() => navigate("/findings")}
>
  {job.findingsTotal > 0 ? "Перейти к находкам" : "Находок нет"}
</Button>
```

---

## G) Quick Wins / Medium / Big Redesign

### Quick Wins (реализуются за 1–3 часа)

1. **`minHeight: 360`** для контейнера шага в `AnalyzeJobsPage` — устраняет главный CLS мастера
2. **`<Box sx={{ width: 88 }} />`** вместо `<Box />` на шаге 3 навигационной строки — фиксирует layout
3. **`canSubmit` prop** в `RunSummary` — запретить Submit до завершения всех шагов
4. **Skeleton в `RecentAnalyses`** — 5 строк × 7 ячеек при `loading === true`, thead сохраняется
5. **Inline error** в `AnalysisJobDetail` — убрать Tooltip, показывать Alert под строкой сканера
6. **Укороченный ID** в RunSummary lastJobId: `#${id.slice(0, 8)}` вместо полного UUID
7. **Disabled "Перейти к находкам"** вместо conditional render — нет CLS при `findingsTotal === 0`
8. **`position: "sticky", top: 24`** для RunSummary карточки — sidebar не прокручивается при длинном Scanner

### Medium Changes (1–3 дня)

1. **Progress block** на детальной странице: LinearProgress + "X/Y" + elapsed timer
2. **Кликабельные шаги** в Stepper для завершённых шагов (навигация назад)
3. **Sub-labels** под шагами (`alternativeLabel` + `StepLabel optional`)
4. **Empty state overlay** в таблице истории: иллюстрация + CTA «Запустить первый анализ»
5. **Copy button** для `errorMessage` в деталях сканера
6. **Radio sub-labels** в SourceSection: дата/размер снапшота рядом с каждым radio
7. **Счётчик сканеров** под ScannerSection: "Выбрано: N · ~X–Y мин"
8. **Фильтры скрыты/disabled** при пустом списке анализов

### Big Redesign (опционально)

1. **Split layout** для детальной страницы: список сканеров слева (панель), детали/лог справа
2. **Live log streaming** через SSE/WebSocket вместо polling (нужен backend)
3. **Visual timeline** выполнения: Gantt-подобная диаграмма всех сканеров с overlap
4. **Sidebar drawer** для мастера (вместо inline степпера) на широких экранах
5. **Сравнение запусков**: diff между двумя analysis job (новые vs. исправленные находки)

---

## H) Dev-Ready Acceptance Criteria

### Layout & No-CLS

- [ ] **AC-01** Карточка мастера (`AnalyzeJobsPage`) имеет `minHeight` не менее **540px** — нет изменения высоты при переключении между шагами 1, 2, 3
- [ ] **AC-02** Переход с шага 2 на шаг 3 (Сканеры) не изменяет высоту карточки более чем на 20px при разрешении 1280×800
- [ ] **AC-03** На шаге 3 правая часть навигационной строки (`space-between`) сохраняет ширину — нет сдвига кнопки «Назад» влево
- [ ] **AC-04** При `loading === true` в `RecentAnalyses`: `<thead>` виден, `<tbody>` содержит ровно 5 skeleton-строк, ширина Paper не изменяется
- [ ] **AC-05** При `filteredJobs.length === 0`: `<thead>` виден, наличие данных-заглушек или overlay не меняет ширину таблицы

### CTA & States

- [ ] **AC-06** Кнопка «Запустить анализ» в RunSummary `disabled`, если не выполнено хотя бы одно из условий: продукт выбран, источник готов, выбран хотя бы один сканер
- [ ] **AC-07** Кнопка «Запустить анализ» `disabled` в течение всей операции `submitting === true`
- [ ] **AC-08** Кнопка «Далее» на шаге 0 `disabled`, пока `selectedProductId` пуст
- [ ] **AC-09** Кнопка «Далее» на шаге 1 `disabled`, пока не выполнены условия выбранного `sourceMode`

### Empty States & Errors

- [ ] **AC-10** При `jobs.length === 0` (после загрузки) таблица показывает пустое состояние с текстом «Анализов пока нет» и ссылкой/кнопкой для запуска первого анализа
- [ ] **AC-11** Ошибки сканеров в `AnalysisJobDetail` отображаются **inline** (не только в Tooltip) в `Alert severity="error"` под соответствующей строкой сканера
- [ ] **AC-12** `errorMessage` длиннее 200 символов обрезается с кнопкой «Показать полностью»

### Detail Page Progress

- [ ] **AC-13** При `status === "processing"` на детальной странице отображается блок прогресса: LinearProgress + текст «X / Y завершено»
- [ ] **AC-14** Кнопка «Перейти к находкам» рендерится **всегда** (не только при `findingsTotal > 0`); при 0 находках — `disabled` с текстом «Находок нет»

### UX Polish

- [ ] **AC-15** В RunSummary поле «Последний запуск» показывает `#${id.slice(0, 8)}` — полный UUID не виден в UI
- [ ] **AC-16** RunSummary имеет `position: sticky; top: 24px` на экранах ≥ 1200px — sidebar не прокручивается вместе со страницей
- [ ] **AC-17** Кнопка копирования `errorMessage` в буфер (при наличии ошибки в сканере) работает корректно в современных браузерах (navigator.clipboard API)
- [ ] **AC-18** Фильтры в `RecentAnalyses` (`statusFilter`, `productFilter`, `scannerFilter`) деактивированы / скрыты, пока `jobs.length === 0`
- [ ] **AC-19** Анимация pulse на чипе статуса «В работе» (`processing`) продолжает работать при polling-обновлении без мерцания остального интерфейса
- [ ] **AC-20** Все интерактивные элементы имеют min touch target 44×44px (WCAG 2.5.5) — проверить кнопки Copy, JSON, Retry в деталях сканера
