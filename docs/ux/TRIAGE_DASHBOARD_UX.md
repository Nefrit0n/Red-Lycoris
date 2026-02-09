# Triage Dashboard UX Design

## Executive Summary

Данный документ описывает полный UX-дизайн для системы триажа безопасности Red Lycoris, включая:
- **UX Journey**: поток "Найти риск → Приоритизировать → Действовать"
- **Dashboard аналитики**: визуализация метрик и трендов
- **Улучшенная карточка Finding**: evidence, timeline, quick actions
- **Интерактивные компоненты**: клавиатурные сокращения, bulk actions

---

## 1. UX Journey: Security Triage Flow

### 1.1 Personas

```
┌─────────────────────────────────────────────────────────────────┐
│  PERSONA 1: Security Analyst (Junior/Mid)                       │
│  ─────────────────────────────────────────────────────────────  │
│  Goals:                                                         │
│  • Быстро обработать очередь новых findings                     │
│  • Понять контекст уязвимости                                   │
│  • Принять решение: confirm/false-positive/assign               │
│                                                                 │
│  Pain Points:                                                   │
│  • Слишком много шума (false positives)                         │
│  • Недостаток контекста для принятия решения                    │
│  • Повторяющиеся рутинные действия                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PERSONA 2: Security Lead / Manager                             │
│  ─────────────────────────────────────────────────────────────  │
│  Goals:                                                         │
│  • Видеть общую картину security posture                        │
│  • Отслеживать SLA и тренды                                     │
│  • Распределять работу между аналитиками                        │
│                                                                 │
│  Pain Points:                                                   │
│  • Нет единого view на все метрики                              │
│  • Трудно отследить прогресс команды                            │
│  • Неочевидно где "горит" SLA                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Main User Flow: Triage Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRIAGE JOURNEY MAP                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  НАЙТИ   │  →   │ПРИОРИТЕТ │  →   │  ПОНЯТЬ  │  →   │ДЕЙСТВИЕ  │
    │   РИСК   │      │  ИРОВАТЬ │      │ КОНТЕКСТ │      │          │
    └──────────┘      └──────────┘      └──────────┘      └──────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
    │Dashboard │      │Risk-based│      │ Finding  │      │ Quick    │
    │Overview  │      │Filtering │      │ Details  │      │ Actions  │
    └──────────┘      └──────────┘      └──────────┘      └──────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
    • KPI Cards       • Risk Score     • Evidence       • Change Status
    • Trends          • EPSS/KEV       • Code Snippet   • Assign
    • Alerts          • SLA Status     • Timeline       • Comment
    • Heat Map        • Smart Views    • Intel Data     • Bulk Actions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: НАЙТИ РИСК (Dashboard Entry Point)
──────────────────────────────────────────
User Action:  Открывает Dashboard
System:       Показывает KPI + срочные алерты
Outcome:      Пользователь видит где проблемы

STEP 2: ПРИОРИТИЗИРОВАТЬ (Smart Filtering)
──────────────────────────────────────────
User Action:  Кликает на "Critical SLA Breached" или фильтрует
System:       Открывает отфильтрованный список findings
Outcome:      Фокус на самых важных findings

STEP 3: ПОНЯТЬ КОНТЕКСТ (Finding Details)
──────────────────────────────────────────
User Action:  Открывает finding detail
System:       Показывает evidence, code, intel, history
Outcome:      Достаточно контекста для решения

STEP 4: ДЕЙСТВОВАТЬ (Quick Actions)
──────────────────────────────────────────
User Action:  Выбирает действие (confirm/fp/assign)
System:       Применяет, логирует, переходит к следующему
Outcome:      Finding обработан, queue уменьшилась
```

### 1.3 Screen Flow Diagram

```
                                 ┌─────────────────┐
                                 │   APP ENTRY     │
                                 │   (Login)       │
                                 └────────┬────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DASHBOARD                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│  │ Open    │ │Critical/│ │ Fixed   │ │Products │  ← KPI Cards (clickable)  │
│  │ 247     │ │High 89  │ │ This Wk │ │ At Risk │                            │
│  └────┬────┘ └────┬────┘ └─────────┘ └────┬────┘                            │
│       │           │                        │                                 │
│       │     ┌─────┴─────┐                  │                                 │
│       │     ▼           ▼                  │                                 │
│  ┌────┴────────────────────────────────────┴────┐                           │
│  │  ALERTS PANEL (Needs Immediate Attention)    │                           │
│  │  🔴 12 SLA Breached  │  ⚠️ 5 KEV Active      │  ← Click to filter       │
│  └──────────────────────────────────────────────┘                           │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │ Severity Donut   │  │ Trend (30 days)  │  │ Top Products     │           │
│  │     Chart        │  │   Line Chart     │  │   Risk Rank      │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
         Click KPI/Alert  │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FINDINGS LIST                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Smart Views: [My Queue] [Critical Only] [SLA Soon] [Needs Review] [+]  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Filters: Severity▾ Status▾ Product▾ Risk Band▾  Search: [.......] 🔍   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ☐ │ Sev │ Title              │ Product │ Risk │ SLA    │ Status        ││
│  │───│─────│────────────────────│─────────│──────│────────│───────────────││
│  │ ☐ │ 🔴  │ SQL Injection...   │ API     │ 95   │ ⚠️ 2d  │ [New ▾]       ││
│  │ ☐ │ 🔴  │ Hardcoded Secret   │ Auth    │ 88   │ 🔴 -1d │ [New ▾]       ││
│  │ ☐ │ 🟠  │ XSS in template    │ Web     │ 72   │ ✓ 5d   │ [Review ▾]    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  [Bulk Actions: Assign▾ | Set Status▾ | Export▾]  when rows selected       │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
        Click Row         │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FINDING DETAIL DRAWER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ← Back to list          [Prev] [Next]  (keyboard: j/k)                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ SQL Injection in user input                          [Status: New ▾]   ││
│  │ Product: API Gateway  │  Severity: 🔴 Critical  │  Risk: 95            ││
│  │ SLA: 2 days remaining ████████░░ (80%)                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌── Quick Actions ──────────────────────────────────────────────────────┐  │
│  │ [✓ Confirm] [✗ False Positive] [⏸ Risk Accept] [👤 Assign] [💬 Comment]│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌── Tabs ─────────────────────────────────────────────────────────────────┐│
│  │ [Evidence] [Intelligence] [Timeline] [Related] [Comments]               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌── Evidence Panel ───────────────────────────────────────────────────────┐│
│  │  File: src/api/users.go:142                            [Open in IDE]   ││
│  │  ┌────────────────────────────────────────────────────────────────────┐││
│  │  │ 140 │  func GetUser(id string) (*User, error) {                   │││
│  │  │ 141 │      query := "SELECT * FROM users WHERE id = " + id        │││  ← Highlighted
│  │  │ 142 │      // VULNERABLE: SQL Injection                           │││
│  │  │ 143 │      return db.Query(query)                                 │││
│  │  └────────────────────────────────────────────────────────────────────┘││
│  │  Rule: go.lang.security.sql-injection                                  ││
│  │  CWE: CWE-89  │  OWASP: A03:2021                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dashboard Analytics Design

### 2.1 Layout Grid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SECURITY DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │   OPEN      │  │  CRITICAL   │  │   FIXED     │  │  PRODUCTS   │        │
│   │  FINDINGS   │  │    HIGH     │  │  THIS WEEK  │  │  AT RISK    │        │
│   │             │  │             │  │             │  │             │        │
│   │    247      │  │     89      │  │     34      │  │     12      │        │
│   │   ↑ 12%     │  │   ↓ 5%      │  │   ↑ 28%     │  │   ↓ 2       │        │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│   Row 1: KPI Metric Cards (4 columns)                                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     ALERTS & ATTENTION NEEDED                        │   │
│   │  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐ │   │
│   │  │ 🔴 SLA Breached   │  │ ⚠️ KEV Active     │  │ 📈 New Critical  │ │   │
│   │  │      12           │  │       5           │  │      8 today     │ │   │
│   │  │  View All →       │  │  View All →       │  │  View All →      │ │   │
│   │  └───────────────────┘  └───────────────────┘  └──────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Row 2: Alerts Panel (full width)                                           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────┐  ┌──────────────────────────────────┐    │
│   │    SEVERITY DISTRIBUTION     │  │       FINDINGS TREND (30d)       │    │
│   │                              │  │                                   │    │
│   │         ┌─────┐              │  │     ^                             │    │
│   │        /   C   \             │  │  50 │    ╭──╮                     │    │
│   │       │    12   │            │  │     │   ╱    ╲   ╭──╮             │    │
│   │       │ ┌─────┐ │            │  │  25 │──╱      ╲─╱    ╲──          │    │
│   │       │ │ H   │ │            │  │     │                             │    │
│   │        \│ 77  │/             │  │   0 └──────────────────────────→  │    │
│   │         └─────┘              │  │         Week 1   Week 2   Week 3  │    │
│   │       Medium: 98             │  │                                   │    │
│   │       Low: 60                │  │   ── New  ── Fixed  ── Open       │    │
│   └──────────────────────────────┘  └──────────────────────────────────┘    │
│                                                                              │
│   Row 3: Charts (2 columns)                                                  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────┐  ┌──────────────────────────────────┐    │
│   │     TOP PRODUCTS BY RISK     │  │       RECENT ACTIVITY           │    │
│   │                              │  │                                   │    │
│   │  API Gateway    ████████ 89  │  │  🔴 New: SQL Injection          │    │
│   │  Auth Service   ███████░ 76  │  │     API Gateway • 2 min ago     │    │
│   │  Web Frontend   █████░░░ 54  │  │                                   │    │
│   │  Mobile API     ████░░░░ 42  │  │  ✅ Fixed: XSS in template       │    │
│   │  Scheduler      ███░░░░░ 31  │  │     Web Frontend • 15 min ago   │    │
│   │                              │  │                                   │    │
│   │  [View All Products →]       │  │  👤 Assigned to @john.doe        │    │
│   │                              │  │     Auth leak • 1 hour ago       │    │
│   └──────────────────────────────┘  └──────────────────────────────────┘    │
│                                                                              │
│   Row 4: Lists (2 columns)                                                   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        RISK HEATMAP BY PRODUCT                       │   │
│   │                                                                      │   │
│   │        Low        Medium       High      Critical                    │   │
│   │      ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐                    │   │
│   │ SAST │  5  │     │ 12  │     │  8  │     │  3  │     API Gateway    │   │
│   │      └─────┘     └─────┘     └─────┘     └─────┘                    │   │
│   │      ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐                    │   │
│   │ SCA  │ 23  │     │ 45  │     │ 18  │     │  2  │     Auth Service   │   │
│   │      └─────┘     └─────┘     └─────┘     └─────┘                    │   │
│   │      ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐                    │   │
│   │ SEC  │  0  │     │  2  │     │  4  │     │  1  │     Web Frontend   │   │
│   │      └─────┘     └─────┘     └─────┘     └─────┘                    │   │
│   │                                                                      │   │
│   │   Color intensity = count  │  Click cell to filter                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Row 5: Heatmap (full width)                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 KPI Cards Specification

```typescript
interface MetricCardProps {
  title: string;
  value: number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    period: string;  // "vs last week"
  };
  icon: React.ReactNode;
  color: 'default' | 'success' | 'warning' | 'error';
  onClick?: () => void;  // Navigate to filtered view
  loading?: boolean;
}

// Example usage:
<MetricCard
  title="Critical & High"
  value={89}
  trend={{ direction: 'down', percentage: 5, period: 'vs last week' }}
  icon={<WarningIcon />}
  color="error"
  onClick={() => navigate('/findings?severity=critical,high')}
/>
```

### 2.3 Alerts Panel Specification

```typescript
interface AlertItem {
  id: string;
  type: 'sla_breach' | 'kev_active' | 'new_critical' | 'policy_fail';
  count: number;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
}

const alertConfig: Record<AlertItem['type'], AlertConfig> = {
  sla_breach: {
    icon: <AlarmIcon />,
    color: '#f44336',  // red
    title: 'SLA Breached',
    filterUrl: '/findings?slaBreached=true'
  },
  kev_active: {
    icon: <SecurityIcon />,
    color: '#ff9800',  // orange
    title: 'KEV Active',
    filterUrl: '/findings?kev=true&status=new,under_review'
  },
  new_critical: {
    icon: <TrendingUpIcon />,
    color: '#f44336',
    title: 'New Critical Today',
    filterUrl: '/findings?severity=critical&dateFrom=today'
  },
  policy_fail: {
    icon: <PolicyIcon />,
    color: '#ff5722',
    title: 'Policy Gate Failed',
    filterUrl: '/import-jobs?gateFailed=true'
  }
};
```

### 2.4 Charts Specifications

#### Severity Distribution (Donut Chart)
```typescript
interface SeverityData {
  name: 'Critical' | 'High' | 'Medium' | 'Low';
  value: number;
  color: string;
}

const severityColors = {
  Critical: '#d32f2f',  // Dark Red
  High: '#f57c00',      // Orange
  Medium: '#fbc02d',    // Yellow
  Low: '#388e3c'        // Green
};
```

#### Findings Trend (Line Chart)
```typescript
interface TrendPoint {
  date: string;       // "2024-01-15"
  newCount: number;
  fixedCount: number;
  openCount: number;
}

// Chart shows 30 days with 3 lines:
// - New findings (red dashed)
// - Fixed findings (green solid)
// - Open total (blue solid)
```

#### Risk Heatmap
```typescript
interface HeatmapCell {
  category: 'SAST' | 'SCA' | 'SECRETS' | 'CONFIG' | 'DAST';
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  productId?: string;
}

// Color intensity based on count
// Click cell → filter findings
```

---

## 3. Finding Card Design (Improved)

### 3.1 Finding Detail Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FINDING DETAIL VIEW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌── Header ──────────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  ← Back to Findings                              [Prev ↑] [Next ↓]     │ │
│  │                                                                         │ │
│  │  SQL Injection vulnerability in user query                              │ │
│  │  ═══════════════════════════════════════════                            │ │
│  │                                                                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ SEVERITY │  │  STATUS  │  │ PRODUCT  │  │RISK SCORE│  │   SLA    │  │ │
│  │  │ 🔴 Crit  │  │  🆕 New  │  │API Gatew │  │   95/100 │  │ 2d left  │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌── Quick Actions Bar ───────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  [✓ Confirm]  [✗ False Positive]  [⏸ Accept Risk]  [👤 Assign ▾]       │ │
│  │                                                                         │ │
│  │  [🔗 Create Ticket]  [📋 Copy Link]  [💬 Add Comment]  [⋮ More]        │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌── Tabs ────────────────────────────────────────────────────────────────┐ │
│  │  [Evidence]  [Intelligence]  [Timeline]  [Related]  [Comments (3)]     │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌── Tab Content ─────────────────────────────────────────────────────────┐ │
│  │                                                                         │ │
│  │  [Content depends on selected tab - see sections below]                 │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Evidence Tab

```
┌── Evidence Tab ────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌── Location ─────────────────────────────────────────────────────────┐   │
│  │  📁 src/api/handlers/users.go                                       │   │
│  │  Line: 142-145                                                      │   │
│  │  [Open in VS Code]  [Open in GitHub]  [Copy Path]                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Code Snippet ─────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │   139 │                                                        │ │   │
│  │  │   140 │  func GetUser(id string) (*User, error) {              │ │   │
│  │  │   141 │      // Build query with user input                    │ │   │
│  │  │ ► 142 │      query := "SELECT * FROM users WHERE id=" + id     │ │  ← Highlighted
│  │  │   143 │      rows, err := db.Query(query)                      │ │   │
│  │  │   144 │      if err != nil {                                   │ │   │
│  │  │   145 │          return nil, err                               │ │   │
│  │  │   146 │      }                                                 │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │  Syntax: Go  │  [Copy Code]  │  [Expand ↕]                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Detection Info ───────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Scanner:     Semgrep v1.45.0                                        │   │
│  │  Rule:        go.lang.security.audit.sqli.taint-sqli                │   │
│  │  Message:     User-controlled data flows into SQL query              │   │
│  │                                                                      │   │
│  │  ┌── Classification ─────────────────────────────────────────────┐  │   │
│  │  │  CWE-89: SQL Injection                              [→ Link]  │  │   │
│  │  │  OWASP A03:2021 - Injection                         [→ Link]  │  │   │
│  │  │  SANS Top 25: CWE-89                                [→ Link]  │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Remediation Guidance ─────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ⚡ How to Fix                                                       │   │
│  │  ───────────                                                         │   │
│  │  Use parameterized queries instead of string concatenation:          │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  // Before (vulnerable)                                        │ │   │
│  │  │  query := "SELECT * FROM users WHERE id=" + id                 │ │   │
│  │  │                                                                │ │   │
│  │  │  // After (safe)                                               │ │   │
│  │  │  query := "SELECT * FROM users WHERE id = $1"                  │ │   │
│  │  │  rows, err := db.Query(query, id)                              │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  📚 References:                                                      │   │
│  │  • OWASP SQL Injection Prevention Cheat Sheet                       │   │
│  │  • Go database/sql documentation                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Intelligence Tab

```
┌── Intelligence Tab ────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌── Vulnerability Identifiers ────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  CVE-2024-12345    [NVD →]  [Mitre →]                               │   │
│  │  GHSA-xxxx-yyyy    [GitHub Advisory →]                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Risk Metrics ─────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │ CVSS Score      │  │ EPSS Score      │  │ KEV Status      │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │    9.8          │  │   0.67          │  │   🔴 YES        │      │   │
│  │  │   CRITICAL      │  │  Top 5%         │  │  CISA Listed    │      │   │
│  │  │                 │  │                 │  │                 │      │   │
│  │  │  ████████████░  │  │  ████████████░  │  │  Known Exploit  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Risk Score Breakdown ─────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Overall Risk Score: 95/100                                          │   │
│  │  ══════════════════════════════════════════════════════════════════  │   │
│  │                                                                      │   │
│  │  ┌── Factor Breakdown ───────────────────────────────────────────┐  │   │
│  │  │                                                                │  │   │
│  │  │  Impact (CVSS 9.8)                    ████████████████░░ 40%  │  │   │
│  │  │  Exploitability (EPSS 0.67)           ████████████████░░ 35%  │  │   │
│  │  │  Asset Criticality (Production API)   ██████████░░░░░░░░ 15%  │  │   │
│  │  │  Exposure (Internet-facing)           ██████░░░░░░░░░░░░ 10%  │  │   │
│  │  │                                                                │  │   │
│  │  │  🔴 KEV Multiplier Applied (+25%)                              │  │   │
│  │  │                                                                │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │  Model: lotus-risk-v2.1  │  Last Updated: 2024-01-15 14:30 UTC      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Package Information (SCA only) ───────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Package:     lodash                                                 │   │
│  │  Installed:   4.17.15                                                │   │
│  │  Fixed In:    4.17.21                         [Show Changelog →]    │   │
│  │  Ecosystem:   npm                                                    │   │
│  │  PURL:        pkg:npm/lodash@4.17.15                                │   │
│  │                                                                      │   │
│  │  [Upgrade Command: npm update lodash@4.17.21]                [Copy] │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Timeline Tab

```
┌── Timeline Tab ────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌── Filters ──────────────────────────────────────────────────────────┐   │
│  │  Show: [All] [Status Changes] [Comments] [Assignments] [SLA Events] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌── Timeline ─────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ○───────────────────────────────────────────────────────────────○  │   │
│  │  │                                                                   │   │
│  │  │  TODAY                                                            │   │
│  │  │  ├─ 14:30  💬 @john.doe commented                                │   │
│  │  │  │         "Investigating affected endpoints..."                  │   │
│  │  │  │                                                                │   │
│  │  │  └─ 10:15  🔄 Status: New → Under Review                         │   │
│  │  │            by @jane.smith                                         │   │
│  │  │                                                                   │   │
│  │  │  YESTERDAY                                                        │   │
│  │  │  ├─ 16:45  👤 Assigned to @john.doe                              │   │
│  │  │  │         by @security-bot                                       │   │
│  │  │  │                                                                │   │
│  │  │  └─ 09:00  🆕 Finding Created                                    │   │
│  │  │            Source: Semgrep Scan #1234                             │   │
│  │  │            Import Job: job_abc123                                 │   │
│  │  │                                                                   │   │
│  │  │  2 DAYS AGO                                                       │   │
│  │  │  └─ 11:30  🔁 Occurrence Count: 1 → 3                            │   │
│  │  │            Found in additional locations                          │   │
│  │  │                                                                   │   │
│  │  ○───────────────────────────────────────────────────────────────○  │   │
│  │                                                                      │   │
│  │  [Load More History...]                                              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Quick Actions Specification

```typescript
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;           // Keyboard shortcut
  variant: 'primary' | 'secondary' | 'danger';
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  action: (finding: Finding) => Promise<void>;
}

const quickActions: QuickAction[] = [
  {
    id: 'confirm',
    label: 'Confirm',
    icon: <CheckIcon />,
    shortcut: 'c',
    variant: 'primary',
    action: async (f) => await updateStatus(f.id, 'confirmed')
  },
  {
    id: 'false_positive',
    label: 'False Positive',
    icon: <CloseIcon />,
    shortcut: 'f',
    variant: 'secondary',
    requiresConfirmation: true,
    confirmationMessage: 'Mark as false positive? Add a reason:',
    action: async (f, reason) => await updateStatus(f.id, 'false_positive', reason)
  },
  {
    id: 'accept_risk',
    label: 'Accept Risk',
    icon: <WarningIcon />,
    shortcut: 'r',
    variant: 'danger',
    requiresConfirmation: true,
    confirmationMessage: 'Accept risk for this finding? This requires justification:',
    action: async (f, reason) => await updateStatus(f.id, 'risk_accepted', reason)
  },
  {
    id: 'assign',
    label: 'Assign',
    icon: <PersonIcon />,
    shortcut: 'a',
    variant: 'secondary',
    action: async (f, assigneeId) => await assignFinding(f.id, assigneeId)
  },
  {
    id: 'create_ticket',
    label: 'Create Ticket',
    icon: <TicketIcon />,
    shortcut: 't',
    variant: 'secondary',
    action: async (f) => await createJiraTicket(f.id)
  }
];
```

### 3.6 Keyboard Shortcuts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KEYBOARD SHORTCUTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NAVIGATION                           ACTIONS                                │
│  ───────────                          ───────                                │
│  j / ↓    Next finding               c    Confirm finding                   │
│  k / ↑    Previous finding           f    Mark as False Positive            │
│  Enter    Open detail view           r    Accept Risk                       │
│  Esc      Close detail / Clear       a    Assign to user                    │
│  g d      Go to Dashboard            t    Create ticket                     │
│  g f      Go to Findings             m    Add comment                       │
│  g p      Go to Products                                                     │
│                                                                              │
│  SELECTION                            GLOBAL                                 │
│  ─────────                            ──────                                 │
│  x        Toggle row selection       ⌘+K / Ctrl+K  Command palette         │
│  ⇧+x      Select range              ?             Show shortcuts            │
│  ⌘+a      Select all visible        /             Focus search              │
│  ⌘+⇧+a   Deselect all                                                       │
│                                                                              │
│  BULK ACTIONS (when selected)                                                │
│  ─────────────────────────────                                               │
│  b s      Bulk set status                                                    │
│  b a      Bulk assign                                                        │
│  b e      Bulk export                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Smart Views (Saved Filters)

### 4.1 Predefined Views

```typescript
interface SavedView {
  id: string;
  name: string;
  icon: React.ReactNode;
  filters: FilterState;
  isDefault?: boolean;
  isSystem?: boolean;  // Cannot be deleted
  badge?: {
    type: 'count' | 'alert';
    value: number | 'live';
  };
}

const systemViews: SavedView[] = [
  {
    id: 'my-queue',
    name: 'My Queue',
    icon: <InboxIcon />,
    filters: { assigneeId: 'current_user', status: ['new', 'under_review'] },
    isSystem: true,
    badge: { type: 'count', value: 'live' }
  },
  {
    id: 'needs-triage',
    name: 'Needs Triage',
    icon: <PriorityHighIcon />,
    filters: { status: ['new'], severity: ['critical', 'high'] },
    isSystem: true,
    badge: { type: 'count', value: 'live' }
  },
  {
    id: 'sla-urgent',
    name: 'SLA Urgent',
    icon: <AlarmIcon />,
    filters: { slaDaysRemaining: { max: 3 }, status: ['new', 'under_review', 'confirmed'] },
    isSystem: true,
    badge: { type: 'alert', value: 'live' }
  },
  {
    id: 'kev-active',
    name: 'KEV Active',
    icon: <SecurityIcon />,
    filters: { kev: true, status: ['new', 'under_review', 'confirmed'] },
    isSystem: true
  },
  {
    id: 'critical-all',
    name: 'All Critical',
    icon: <ErrorIcon />,
    filters: { severity: ['critical'] },
    isSystem: true
  }
];
```

### 4.2 View Selector UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMART VIEWS                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌── System Views ─────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │  [📥 My Queue (12)]  [⚠️ Needs Triage (45)]  [⏰ SLA Urgent (8)]    │    │
│  │                                                                      │    │
│  │  [🛡️ KEV Active (5)]  [🔴 All Critical (23)]                        │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌── My Saved Views ───────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │  [API Issues]  [Auth Team]  [This Week's Imports]  [+ Create New]   │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component Architecture

### 5.1 New/Updated Components

```
src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardPage.tsx           # Main dashboard container
│   │   ├── MetricCard.tsx              # KPI card with trend
│   │   ├── AlertsPanel.tsx             # Urgent alerts section
│   │   ├── SeverityDonutChart.tsx      # Severity distribution
│   │   ├── TrendLineChart.tsx          # 30-day trend
│   │   ├── TopProductsChart.tsx        # Risk ranking
│   │   ├── RecentActivityFeed.tsx      # Activity stream
│   │   └── RiskHeatmap.tsx             # Category x Severity matrix
│   │
│   ├── findings/
│   │   ├── FindingsList.tsx            # Main list page (updated)
│   │   ├── FindingsTable.tsx           # Table component (refactored)
│   │   ├── SmartViewsBar.tsx           # NEW: saved views selector
│   │   ├── FindingDetailDrawer.tsx     # Detail side panel (updated)
│   │   ├── QuickActionsBar.tsx         # NEW: action buttons
│   │   ├── tabs/
│   │   │   ├── EvidenceTab.tsx         # NEW: code evidence
│   │   │   ├── IntelligenceTab.tsx     # NEW: CVE/EPSS/KEV info
│   │   │   ├── TimelineTab.tsx         # Updated: visual timeline
│   │   │   ├── RelatedTab.tsx          # NEW: related findings
│   │   │   └── CommentsTab.tsx         # Updated: threaded comments
│   │   └── cards/
│   │       ├── SeverityBadge.tsx       # Reusable severity indicator
│   │       ├── RiskScoreGauge.tsx      # NEW: risk score visualization
│   │       ├── SlaIndicator.tsx        # SLA progress bar
│   │       └── StatusDropdown.tsx      # Inline status changer
│   │
│   ├── common/
│   │   ├── CodeBlock.tsx               # Syntax highlighted code
│   │   ├── Timeline.tsx                # Generic timeline component
│   │   ├── KeyboardShortcutsHelp.tsx   # NEW: shortcuts modal
│   │   └── CommandPalette.tsx          # Updated: more commands
│   │
│   └── charts/
│       ├── BaseChart.tsx               # Chart wrapper with loading
│       ├── DonutChart.tsx              # Reusable donut
│       ├── LineChart.tsx               # Reusable line
│       ├── BarChart.tsx                # Reusable bar
│       └── Heatmap.tsx                 # Category matrix
│
├── hooks/
│   ├── useDashboardMetrics.ts          # Dashboard data fetching
│   ├── useSmartViews.ts                # Saved views management
│   ├── useFindingNavigation.ts         # j/k navigation
│   ├── useKeyboardShortcuts.ts         # Global shortcuts
│   └── useRiskBreakdown.ts             # Risk factor analysis
│
├── api/
│   ├── dashboard.ts                    # Dashboard API calls
│   ├── metrics.ts                      # Metrics endpoints
│   └── findings.ts                     # Updated with new params
│
└── types/
    ├── dashboard.ts                    # Dashboard types
    ├── findings.ts                     # Updated finding types
    └── views.ts                        # Saved views types
```

### 5.2 API Integration

Based on existing contracts from `/backend/internal/dto/v1/`:

```typescript
// Dashboard metrics endpoint
GET /api/v1/metrics/dashboard
Response: {
  totalOpen: number;
  criticalHigh: number;
  fixedThisWeek: number;
  productsAtRisk: number;
  trends: {
    totalOpen: { direction: 'up' | 'down'; percent: number };
    criticalHigh: { direction: 'up' | 'down'; percent: number };
    fixedThisWeek: { direction: 'up' | 'down'; percent: number };
  };
}

// Alerts endpoint
GET /api/v1/metrics/alerts
Response: {
  slaBreached: number;
  kevActive: number;
  newCriticalToday: number;
  policyFailed: number;
}

// Risk metrics (existing)
GET /api/v1/metrics/risk
Response: RiskMetricsDTO  // Already defined in contracts

// Finding detail (extended)
GET /api/v1/findings/{id}?includeRiskFactors=true&includeEvents=true
Response: FindingDetailDTO with:
  - riskFactors: RiskFactors
  - events: FindingEvent[]
  - comments: FindingComment[]
  - intel_details: IntelDetail
```

---

## 6. Implementation Priority

### Phase 1: Dashboard Core (Week 1-2)
1. MetricCard component
2. AlertsPanel component
3. Basic charts (Donut, Line)
4. Dashboard page layout
5. API integration

### Phase 2: Finding Detail Improvement (Week 3-4)
1. Refactor FindingDetailDrawer
2. Evidence tab with code block
3. Intelligence tab with risk breakdown
4. Timeline tab improvements
5. Quick Actions bar

### Phase 3: Smart Views & Navigation (Week 5)
1. SmartViewsBar component
2. Keyboard navigation (j/k)
3. Keyboard shortcuts system
4. URL sync for views

### Phase 4: Advanced Features (Week 6)
1. Risk heatmap
2. Recent activity feed
3. Advanced timeline filters
4. Bulk actions improvements

---

## 7. Design Tokens

```typescript
// Color palette for security UI
const securityColors = {
  severity: {
    critical: { main: '#d32f2f', light: '#ff6659', dark: '#9a0007' },
    high:     { main: '#f57c00', light: '#ffad42', dark: '#bb4d00' },
    medium:   { main: '#fbc02d', light: '#fff263', dark: '#c49000' },
    low:      { main: '#388e3c', light: '#6abf69', dark: '#00600f' },
  },
  status: {
    new:           '#2196f3',  // Blue
    under_review:  '#ff9800',  // Orange
    confirmed:     '#f44336',  // Red
    false_positive: '#9e9e9e', // Gray
    mitigated:     '#4caf50',  // Green
    risk_accepted: '#9c27b0',  // Purple
  },
  risk: {
    critical: '#d32f2f',
    high:     '#f57c00',
    medium:   '#fbc02d',
    low:      '#388e3c',
  }
};

// Spacing for dashboard grid
const dashboardGrid = {
  gap: 24,           // Gap between cards
  cardPadding: 20,   // Internal card padding
  sectionGap: 32,    // Gap between sections
};
```

---

*Document Version: 1.0*
*Created: 2026-01-25*
*Author: UX/UI Design System*
