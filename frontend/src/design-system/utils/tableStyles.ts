/**
 * Lotus Warden Design System - Table Styles Configuration
 *
 * Centralized styling for FindingsTable and other data tables.
 * Uses design system tokens for consistency.
 */

import { semantic, primitives, alpha } from '../tokens/colors';

// ============================================================
// SEVERITY CONFIGURATION
// ============================================================

export const tableSeverityStyles = {
  critical: {
    bgcolor: `linear-gradient(135deg, ${semantic.severity.high.base} 0%, ${semantic.severity.critical.base} 100%)`,
    color: primitives.white,
    icon: 'ErrorOutline',
    glow: `0 0 12px ${semantic.severity.high.subtle}`,
    borderColor: semantic.severity.critical.base,
    rowBg: semantic.severity.high.subtle,
  },
  high: {
    bgcolor: semantic.severity.high.base,
    color: primitives.white,
    icon: 'WarningAmber',
    borderColor: semantic.severity.high.base,
    rowBg: `rgba(244, 67, 54, 0.04)`,
  },
  medium: {
    bgcolor: semantic.severity.medium.subtle,
    color: semantic.severity.medium.text,
    borderColor: `rgba(234, 88, 12, 0.5)`,
    icon: 'ReportProblemOutlined',
  },
  low: {
    bgcolor: semantic.severity.low.subtle,
    color: semantic.severity.low.text,
    borderColor: `rgba(22, 163, 74, 0.3)`,
    icon: 'InfoOutlined',
  },
} as const;

export const severityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
} as const;

export const severityBorderColors = {
  low: semantic.severity.low.base,
  medium: semantic.severity.medium.base,
  high: semantic.severity.high.base,
  critical: semantic.severity.critical.base,
} as const;

// ============================================================
// STATUS CONFIGURATION
// ============================================================

export const tableStatusStyles = {
  // Action Required
  new: {
    icon: 'FiberNew',
    bgcolor: semantic.status.new.subtle,
    color: semantic.status.new.text,
    borderColor: `rgba(59, 130, 246, 0.5)`,
    pulse: true,
  },
  under_review: {
    icon: 'Visibility',
    bgcolor: semantic.status.inProgress.subtle,
    color: semantic.status.inProgress.text,
    borderColor: `rgba(245, 158, 11, 0.4)`,
  },
  confirmed: {
    icon: 'CheckCircleOutline',
    bgcolor: `rgba(244, 67, 54, 0.12)`,
    color: '#ef5350',
    borderColor: `rgba(244, 67, 54, 0.4)`,
  },

  // Resolved
  mitigated: {
    icon: 'Verified',
    bgcolor: semantic.status.resolved.subtle,
    color: semantic.status.resolved.text,
    borderColor: `rgba(16, 185, 129, 0.4)`,
  },
  false_positive: {
    icon: 'Block',
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.3)`,
  },
  out_of_scope: {
    icon: 'RemoveCircleOutline',
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.3)`,
  },
  risk_accepted: {
    icon: 'ThumbUpAltOutlined',
    bgcolor: `rgba(255, 193, 7, 0.1)`,
    color: '#ffd54f',
    borderColor: `rgba(255, 193, 7, 0.3)`,
  },
  duplicate: {
    icon: 'ContentCopy',
    bgcolor: semantic.status.dismissed.subtle,
    color: semantic.status.dismissed.text,
    borderColor: `rgba(107, 114, 128, 0.3)`,
  },
} as const;

export const statusLabels = {
  new: 'New',
  under_review: 'Under review',
  confirmed: 'Confirmed',
  false_positive: 'False positive',
  out_of_scope: 'Out of scope',
  risk_accepted: 'Risk accepted',
  mitigated: 'Mitigated',
  duplicate: 'Duplicate',
} as const;

// ============================================================
// RISK BAND CONFIGURATION
// ============================================================

export const riskBandConfig = {
  critical: {
    color: semantic.risk.critical,
    label: 'CRIT',
    fullLabel: 'Critical',
  },
  high: {
    color: semantic.risk.high,
    label: 'HIGH',
    fullLabel: 'High',
  },
  medium: {
    color: semantic.risk.medium,
    label: 'MED',
    fullLabel: 'Medium',
  },
  low: {
    color: semantic.risk.low,
    label: 'LOW',
    fullLabel: 'Low',
  },
} as const;

// ============================================================
// POLICY DECISION STYLES
// ============================================================

export const policyDecisionStyles = {
  pass: {
    label: 'PASS',
    color: semantic.severity.low.text,
    border: `rgba(129, 199, 132, 0.45)`,
  },
  warn: {
    label: 'WARN',
    color: semantic.severity.medium.text,
    border: `rgba(255, 183, 77, 0.45)`,
  },
  fail: {
    label: 'FAIL',
    color: semantic.severity.high.light,
    border: `rgba(239, 83, 80, 0.5)`,
  },
} as const;

// ============================================================
// SLA STATUS STYLES
// ============================================================

export const slaStyles = {
  breached: {
    label: 'BREACHED',
    color: semantic.severity.high.light,
    bgcolor: semantic.severity.high.subtle,
    borderColor: `rgba(244, 67, 54, 0.4)`,
  },
  dueToday: {
    label: 'due today',
    color: semantic.severity.medium.text,
    bgcolor: semantic.severity.medium.subtle,
    borderColor: `rgba(255, 152, 0, 0.4)`,
  },
  onTrack: {
    color: semantic.severity.low.text,
    bgcolor: semantic.severity.low.subtle,
    borderColor: `rgba(129, 199, 132, 0.35)`,
  },
  none: {
    label: '—',
    color: primitives.night[300],
    bgcolor: primitives.transparent,
    borderColor: alpha.white[15],
  },
} as const;

// ============================================================
// TABLE LAYOUT
// ============================================================

export const tableColumnWidths = {
  checkbox: 44,
  severity: 140,
  risk: 120,
  status: 160,
  sla: 130,
  actions: 56,
} as const;

// ============================================================
// TABLE STYLING MIXINS
// ============================================================

export const tableStyles = {
  // Highlight styles for search
  highlightBg: `rgba(255, 193, 7, 0.22)`,

  // Row hover
  rowHover: alpha.white[5],

  // Selected row
  rowSelected: `rgba(168, 85, 247, 0.08)`,

  // Active row (in drawer)
  rowActive: `rgba(168, 85, 247, 0.12)`,

  // Cell borders
  cellBorder: primitives.night[600],

  // Header styles
  headerBg: primitives.night[750],
  headerText: primitives.night[100],
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type SeverityKey = keyof typeof tableSeverityStyles;
export type StatusKey = keyof typeof tableStatusStyles;
export type RiskBandKey = keyof typeof riskBandConfig;
export type PolicyDecisionKey = keyof typeof policyDecisionStyles;
