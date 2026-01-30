/**
 * RED LYCORIS Design System - Chart Tokens
 *
 * Unified chart configuration for all visualization components.
 * Uses design system colors for consistency.
 */

import { semantic, primitives, alpha, gradients } from './colors';

// ============================================================
// CHART COLOR PALETTES
// ============================================================

export const chartColors = {
  // Severity palette (matches semantic.severity)
  severity: {
    critical: semantic.severity.critical.base,
    high: semantic.severity.high.base,
    medium: semantic.severity.medium.base,
    low: semantic.severity.low.base,
    info: semantic.severity.info.base,
  },

  // Status palette (matches semantic.status)
  status: {
    new: semantic.status.new.base,
    inProgress: semantic.status.inProgress.base,
    resolved: semantic.status.resolved.base,
    dismissed: semantic.status.dismissed.base,
  },

  // Activity type colors
  activity: {
    new_finding: semantic.severity.high.base,
    status_change: semantic.status.resolved.base,
    scan_upload: primitives.lotus[400],
  },

  // Primary accent for single-line charts
  primary: primitives.lotus[400],
  secondary: primitives.jade[400],
  tertiary: primitives.petal[400],

  // Risk trend
  risk: {
    avgRisk: primitives.lotus[400],
    critical: semantic.severity.high.base,
  },

  // Multi-series palette (for categorical data)
  categorical: [
    primitives.lotus[500],
    primitives.jade[500],
    primitives.petal[500],
    primitives.gold[500],
    semantic.status.new.base,
    semantic.severity.medium.base,
  ],
} as const;

// ============================================================
// CHART AXIS & GRID STYLING
// ============================================================

export const chartAxis = {
  // Tick styling
  tick: {
    fill: primitives.night[300],
    fontSize: 11,
  },

  // Grid styling
  grid: {
    stroke: primitives.night[600],
    strokeDasharray: '3 3',
  },

  // Axis line (usually hidden)
  axisLine: false,
  tickLine: false,
} as const;

// ============================================================
// CHART TOOLTIP STYLING
// ============================================================

export const chartTooltip = {
  backgroundColor: primitives.night[700],
  border: `1px solid ${primitives.night[500]}`,
  borderRadius: 8,
  boxShadow: `0 8px 32px ${alpha.black[40]}`,
} as const;

// ============================================================
// CHART LEGEND STYLING
// ============================================================

export const chartLegend = {
  textColor: primitives.night[300],
  fontSize: 12,
} as const;

// ============================================================
// CHART CURSOR (hover area)
// ============================================================

export const chartCursor = {
  fill: alpha.white[5],
} as const;

// ============================================================
// LINE CHART CONFIG
// ============================================================

export const lineChartConfig = {
  strokeWidth: 2,
  dot: false,
  activeDot: { r: 5, stroke: primitives.night[800], strokeWidth: 2 },
  type: 'monotone' as const,
} as const;

// ============================================================
// BAR CHART CONFIG
// ============================================================

export const barChartConfig = {
  radius: [4, 4, 4, 4] as [number, number, number, number],
  barSize: 20,
} as const;

// ============================================================
// PIE CHART CONFIG
// ============================================================

export const pieChartConfig = {
  innerRadius: 50,
  outerRadius: 100,
  paddingAngle: 2,
  labelFill: primitives.night[50],
  labelFontSize: 12,
  labelFontWeight: 600,
} as const;

// ============================================================
// PROGRESS BAR STYLING
// ============================================================

export const progressBarConfig = {
  height: 8,
  borderRadius: 4,
  backgroundColor: alpha.white[10],

  // Color by severity
  getSeverityColor: (critical: number, high: number): string => {
    if (critical > 0) return chartColors.severity.critical;
    if (high > 0) return chartColors.severity.high;
    return primitives.lotus[400];
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ChartColors = typeof chartColors;
export type ChartAxis = typeof chartAxis;
export type ChartTooltipConfig = typeof chartTooltip;
