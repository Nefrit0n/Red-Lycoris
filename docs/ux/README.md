# UX/UI Design Documentation

## Overview

Данная директория содержит полную UX/UI документацию для Lotus Warden - ASOC платформы для управления безопасностью приложений.

---

## Documents

### 1. [TRIAGE_DASHBOARD_UX.md](./TRIAGE_DASHBOARD_UX.md)

Основной UX-дизайн документ, включающий:

- **User Personas** - описание целевых пользователей (Security Analyst, Security Lead)
- **UX Journey Map** - полный поток "Найти риск → Приоритизировать → Действовать"
- **Screen Flow Diagrams** - ASCII wireframes всех экранов
- **Dashboard Layout** - сетка и компоненты аналитического дашборда
- **Finding Card Design** - улучшенная карточка finding с табами:
  - Evidence (код, location, rule info)
  - Intelligence (CVE, EPSS, KEV, Risk Score)
  - Timeline (история изменений)
  - Comments
- **Quick Actions** - спецификация быстрых действий
- **Keyboard Shortcuts** - полный список горячих клавиш
- **Design Tokens** - цвета, spacing

### 2. [COMPONENT_SPECIFICATIONS.md](./COMPONENT_SPECIFICATIONS.md)

Детальные спецификации React-компонентов:

- **Dashboard Components**:
  - `MetricCard` - KPI карточка с трендом
  - `AlertsPanel` - панель срочных алертов
  - `SeverityDonutChart` - распределение по severity
  - `TrendLineChart` - тренды за 30 дней

- **Finding Detail Components**:
  - `QuickActionsBar` - панель быстрых действий
  - `EvidenceTab` - код с подсветкой синтаксиса
  - `IntelligenceTab` - CVE/EPSS/KEV информация
  - `TimelineTab` - визуальная timeline

- **Hooks**:
  - `useKeyboardShortcuts` - глобальные горячие клавиши
  - `useDashboardMetrics` - загрузка данных дашборда

- **API Layer**:
  - Dashboard API с агрегацией данных

### 3. [SMART_VIEWS_SPECIFICATION.md](./SMART_VIEWS_SPECIFICATION.md)

Система Smart Views и Saved Filters:

- **23 System Views** по категориям:
  - Triage (My Queue, Needs Triage, Unassigned)
  - Priority (Critical, High Risk)
  - SLA (Breached, Due Soon)
  - Intelligence (KEV, Highly Exploitable)
  - Category (SAST, SCA, Secrets)
  - Status & Time-based

- **Components**:
  - `SmartViewsBar` - панель с табами и категориями

- **Hooks**:
  - `useSavedViews` - управление views с localStorage
  - `useViewUrlSync` - синхронизация с URL

---

## Quick Reference

### Triage Flow

```
Dashboard → Alert Click → Filtered List → Finding Detail → Quick Action → Next
    ↑           ↓              ↓               ↓              ↓
   KPIs     SLA/KEV         j/k nav         Tabs          c/f/r keys
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next finding |
| `k` / `↑` | Previous finding |
| `c` | Confirm finding |
| `f` | Mark as False Positive |
| `r` | Accept Risk |
| `a` | Assign |
| `m` | Add comment |
| `Esc` | Close detail |
| `⌘+K` | Command palette |
| `?` | Show shortcuts |

### Color Tokens

```
Severity:
  Critical: #d32f2f
  High:     #f57c00
  Medium:   #fbc02d
  Low:      #388e3c

Status:
  New:           #2196f3
  Under Review:  #ff9800
  Confirmed:     #f44336
  Mitigated:     #4caf50
```

---

## Implementation Priority

### Phase 1: Dashboard (High Priority)
- [ ] Install Recharts
- [ ] MetricCard component
- [ ] AlertsPanel component
- [ ] SeverityDonutChart
- [ ] TrendLineChart
- [ ] Dashboard page layout

### Phase 2: Finding Detail (High Priority)
- [ ] Refactor FindingDetailDrawer
- [ ] EvidenceTab with syntax highlighting
- [ ] IntelligenceTab with risk breakdown
- [ ] QuickActionsBar
- [ ] TimelineTab improvements

### Phase 3: Smart Views (Medium Priority)
- [ ] SmartViewsBar component
- [ ] useSavedViews hook
- [ ] URL sync
- [ ] Favorites system

### Phase 4: Navigation (Medium Priority)
- [ ] Keyboard navigation (j/k)
- [ ] Global shortcuts
- [ ] Command palette updates

---

## API Dependencies

Компоненты опираются на существующие API контракты:

| Endpoint | Component |
|----------|-----------|
| `GET /api/v1/findings` | FindingsTable, SmartViews |
| `GET /api/v1/findings/{id}` | FindingDetail tabs |
| `GET /api/v1/metrics/risk` | Dashboard charts |
| `PATCH /api/v1/findings/{id}` | QuickActionsBar |
| `POST /api/v1/findings/{id}/comments` | CommentsTab |

### New Endpoints Needed

```
GET /api/v1/metrics/dashboard    → KPI cards with trends
GET /api/v1/metrics/alerts       → Alert counts
GET /api/v1/metrics/trend        → 30-day trend data
GET /api/v1/findings/count       → Fast count for views
```

---

## Related Documents

- [API Contracts v1](../api_contracts_v1.md)
- [Domain Entities](../domain_entities.md)
- [Risk Scoring Guide](../guides/risk-scoring.md)
- [UX/UI Implementation Plan](../../UX_UI_IMPLEMENTATION_PLAN.md)

---

*Created: 2026-01-25*
*Version: 1.0*
