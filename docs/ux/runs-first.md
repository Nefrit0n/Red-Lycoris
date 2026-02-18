# Runs-first UX Redesign

## What changed

The analysis workflow has been reorganized from a "wizard-first" to a "runs-first" approach:

- **Before**: `/analyze` was a single page with a full-page stepper (Product -> Source -> Scanners) plus a table at the bottom.
- **After**: `/runs` is a dedicated runs list page with filters; the creation form lives inside a right-side Drawer ("Run Builder").

## New routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/runs` | `RunsPage` | Runs list (table + filters + "New analysis" button) |
| `/runs/:id` | `AnalysisJobDetail` | Run detail (enhanced with Rerun, elapsed timer in header) |

### Legacy redirects (backward compat)

| Route | Redirects to |
|-------|-------------|
| `/analyze` | `/runs` |
| `/analyze/:id` | Renders `AnalysisJobDetail` (kept for bookmarks) |

## New components

| Component | Location | Purpose |
|-----------|----------|---------|
| `RunsPage` | `pages/RunsPage.tsx` | Main runs list page |
| `RunBuilderDrawer` | `features/analyze/components/RunBuilderDrawer.tsx` | Drawer form for creating new analysis |
| `RunStatusBadge` | `features/analyze/components/RunStatusBadge.tsx` | Unified status chip with pulse animation |

## Modified files

| File | Change |
|------|--------|
| `App.tsx` | Added `/runs`, `/runs/:id` routes; legacy redirects |
| `Sidebar.tsx` | Nav item "Анализ" -> "Запуски", path `/analyze` -> `/runs` |
| `AnalysisJobDetail.tsx` | Added Rerun button, elapsed in header, RunStatusBadge, back -> `/runs` |

## Loading / Empty states

### `/runs` table

| State | Behavior |
|-------|----------|
| **Loading** | Fixed `<thead>` + 5 skeleton rows; table `min-height: 420px` |
| **Empty (no runs ever)** | Ghost rows + overlay: "Запусков ещё не было" + CTA "Запустить первый анализ" (opens drawer) |
| **Empty (filtered)** | Ghost rows + overlay: "Нет запусков по выбранным фильтрам" + "Сбросить фильтры" button |
| **Data** | Normal table rows with status badges, scanner chips |

### RunBuilderDrawer

- Fixed width (560px on desktop, 100% on mobile)
- Scrollable content area with fixed header and footer
- Footer always visible: compact summary + disabled/enabled CTA
- Upload progress bar shown in footer reserved area (min-height: 24px) to prevent CLS

## Acceptance criteria

1. `/runs` renders the table even during loading (thead + skeleton rows)
2. `/runs` does not change height/width of main blocks when switching between empty/loading/data
3. Drawer "Новый анализ" opens/closes without shifting page content (MUI Drawer with `anchor="right"`)
4. "Запустить анализ" is disabled until config is valid (product + source + at least 1 scanner)
5. After successful launch, redirect to `/runs/:id`
6. On `/runs/:id`: progress X/Y + elapsed timer; errors shown inline with Copy button
7. Rerun button available on completed/failed jobs
