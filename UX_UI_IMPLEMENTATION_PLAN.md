# UX/UI Implementation Plan - Lotus Warden

## Текущее Состояние Фронтенда

| Аспект | Значение |
|--------|----------|
| **Framework** | React 18 + TypeScript + Vite |
| **UI Library** | Material-UI 5.16.7 (Dark theme) |
| **State** | Custom hooks + localStorage |
| **Charts** | ❌ Не установлены |
| **Pages** | 11 основных + 6 admin |

---

## 🎯 План Реализации UX/UI Улучшений

### Phase 1: Dashboard и Визуализация (Высокий приоритет)

#### 1.1 Установка библиотеки для графиков
- [ ] Добавить **Recharts** (легковесная, хорошо интегрируется с React)
- [ ] Создать переиспользуемые chart компоненты

#### 1.2 Главная страница Dashboard `/dashboard`
- [ ] **Metric Cards** - 4 карточки:
  - Total Open Findings
  - Critical/High Findings
  - Findings Fixed This Week
  - Products At Risk
- [ ] **Severity Distribution Chart** (Pie/Donut)
- [ ] **Status Distribution Chart** (Bar)
- [ ] **Findings Trend** (Line chart - за последние 30 дней)
- [ ] **Top 5 Risky Products** (Horizontal bar)
- [ ] **Recent Activity Feed** (последние находки, изменения статуса)

#### 1.3 Обновление роутинга
- [ ] Добавить `/dashboard` как главную страницу
- [ ] Редирект `/` → `/dashboard`
- [ ] Обновить навигацию в Sidebar

---

### Phase 2: Улучшение Findings List

#### 2.1 Saved Views / Filters
- [ ] Сохранение пресетов фильтров в localStorage
- [ ] Quick filters: "My Assigned", "Critical Only", "Needs Triage"
- [ ] Dropdown для выбора сохранённых views

#### 2.2 Группировка и отображение
- [ ] Group by: Rule, File, Product, Scanner
- [ ] Collapsible groups с summary counts
- [ ] Toggle между table/grouped view

#### 2.3 Export функционал
- [ ] Export to CSV
- [ ] Export to PDF (сводный отчёт)
- [ ] Export to SARIF

#### 2.4 Улучшения таблицы
- [ ] Column visibility toggle
- [ ] Resizable columns
- [ ] Quick inline status change (dropdown в таблице)
- [ ] Row hover preview (tooltip с description)

---

### Phase 3: Улучшение Finding Detail

#### 3.1 Code Evidence с подсветкой
- [ ] Добавить **Prism.js** или **highlight.js**
- [ ] Syntax highlighting для code snippets
- [ ] Line numbers
- [ ] Copy code button

#### 3.2 Remediation Guidance
- [ ] Секция "How to Fix" на основе rule_id
- [ ] Links to OWASP/CWE pages
- [ ] Custom remediation notes (редактируемые)

#### 3.3 Timeline улучшения
- [ ] Visual timeline компонент для events
- [ ] Icons для разных типов событий
- [ ] Relative timestamps ("2 hours ago")

#### 3.4 Quick Actions
- [ ] Floating action buttons
- [ ] Keyboard shortcuts (j/k навигация)
- [ ] "Mark as False Positive" one-click
- [ ] "Snooze" functionality

---

### Phase 4: Улучшение Products Page

#### 4.1 Product Cards View
- [ ] Toggle между Table/Cards view
- [ ] Card показывает: name, severity breakdown mini-chart, trend arrow
- [ ] Health score badge (computed from findings)

#### 4.2 Product Detail Page `/products/:id`
- [ ] Product overview с metrics
- [ ] Findings breakdown chart
- [ ] Recent scans timeline
- [ ] Link to filtered findings

#### 4.3 Risk Heatmap
- [ ] Grid view products по risk level
- [ ] Color coding (green → red)
- [ ] Click to drill down

---

### Phase 5: Улучшение Analysis/Scan Pages

#### 5.1 Analysis Page UX
- [ ] Drag & drop upload zone
- [ ] Upload progress indicator
- [ ] Real-time job status updates (polling → WebSocket)
- [ ] Scan logs viewer в drawer

#### 5.2 Scan History
- [ ] Timeline view сканов
- [ ] Diff между сканами (new/fixed findings)
- [ ] Re-run scan button

---

### Phase 6: Navigation и General UX

#### 6.1 Обновлённая навигация
```
📊 Dashboard (NEW)
🔍 Findings
   └── All / My Assigned / Saved Views
📦 Products
🔬 Scanning
   └── Run Analysis / Upload / History
⚙️ Admin
```

#### 6.2 Global Search (Cmd+K)
- [ ] Command palette компонент
- [ ] Search across findings, products
- [ ] Quick actions (Navigate to, Create, Filter)

#### 6.3 Notifications
- [ ] Toast notifications для actions
- [ ] Notification center (bell icon)
- [ ] Mark as read functionality

#### 6.4 Theme и Accessibility
- [ ] Light theme toggle
- [ ] High contrast mode
- [ ] Keyboard navigation improvements
- [ ] Screen reader improvements

---

## 📁 Новая Структура Файлов

```
src/
├── components/
│   ├── charts/                    # NEW
│   │   ├── SeverityPieChart.tsx
│   │   ├── StatusBarChart.tsx
│   │   ├── TrendLineChart.tsx
│   │   ├── RiskHeatmap.tsx
│   │   └── MetricCard.tsx
│   ├── common/                    # NEW
│   │   ├── CommandPalette.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── Timeline.tsx
│   │   ├── ExportMenu.tsx
│   │   └── SavedViewsDropdown.tsx
│   └── ... (existing)
├── pages/
│   ├── Dashboard.tsx              # NEW
│   ├── ProductDetail.tsx          # NEW
│   └── ... (existing)
├── hooks/
│   ├── useDashboardData.ts        # NEW
│   ├── useSavedViews.ts           # NEW
│   ├── useKeyboardShortcuts.ts    # NEW
│   └── ... (existing)
└── utils/
    ├── chartHelpers.ts            # NEW
    └── ... (existing)
```

---

## 🔧 Зависимости для Установки

```json
{
  "recharts": "^2.12.0",
  "prismjs": "^1.29.0",
  "@types/prismjs": "^1.26.0",
  "date-fns": "^3.3.0"
}
```

---

## ⏱️ Порядок Выполнения

| # | Задача | Сложность | Файлы |
|---|--------|-----------|-------|
| 1 | Установка Recharts + date-fns | Low | package.json |
| 2 | Создание chart компонентов | Medium | components/charts/* |
| 3 | Dashboard page | Medium | pages/Dashboard.tsx |
| 4 | Обновление роутинга и Sidebar | Low | App.tsx, Sidebar.tsx |
| 5 | API для dashboard данных | Low | api/dashboard.ts |
| 6 | Saved Views для Findings | Medium | hooks/useSavedViews.ts |
| 7 | Export функционал | Medium | components/common/ExportMenu.tsx |
| 8 | Code highlighting | Low | components/common/CodeBlock.tsx |
| 9 | Keyboard shortcuts | Medium | hooks/useKeyboardShortcuts.ts |
| 10 | Product Detail page | Medium | pages/ProductDetail.tsx |

---

## 🎯 Что Делаем Первым?

**Рекомендую начать с Phase 1 (Dashboard):**
1. Даёт максимальный визуальный эффект
2. Создаёт переиспользуемые chart компоненты
3. Улучшает первое впечатление пользователя
4. Относительно изолирован от существующего кода

**Альтернативы:**
- Phase 3 (Finding Detail) - если фокус на daily workflow аналитиков
- Phase 6.2 (Cmd+K Search) - если фокус на power users
