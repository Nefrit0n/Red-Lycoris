/**
 * Lotus Warden Design System - Security Utilities
 *
 * Centralized utilities for severity, status, and risk handling.
 * Provides consistent styling and formatting across the application.
 */

import { alpha } from '@mui/material';
import { semantic } from '../tokens';
import type {
  SeverityLevel,
  StatusType,
  RiskBand,
} from '../components/StatusBadge';

// Re-export types for convenience
export type { SeverityLevel, StatusType, RiskBand };

// ============================================================
// SEVERITY UTILITIES
// ============================================================

export const severityLevels: SeverityLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

export const severityConfig: Record<
  SeverityLevel,
  {
    label: string;
    color: string;
    lightColor: string;
    bgColor: string;
    priority: number;
  }
> = {
  critical: {
    label: 'Critical',
    color: semantic.severity.critical.base,
    lightColor: semantic.severity.critical.text,
    bgColor: semantic.severity.critical.subtle,
    priority: 5,
  },
  high: {
    label: 'High',
    color: semantic.severity.high.base,
    lightColor: semantic.severity.high.text,
    bgColor: semantic.severity.high.subtle,
    priority: 4,
  },
  medium: {
    label: 'Medium',
    color: semantic.severity.medium.base,
    lightColor: semantic.severity.medium.text,
    bgColor: semantic.severity.medium.subtle,
    priority: 3,
  },
  low: {
    label: 'Low',
    color: semantic.severity.low.base,
    lightColor: semantic.severity.low.text,
    bgColor: semantic.severity.low.subtle,
    priority: 2,
  },
  info: {
    label: 'Info',
    color: semantic.severity.info.base,
    lightColor: semantic.severity.info.text,
    bgColor: semantic.severity.info.subtle,
    priority: 1,
  },
};

/**
 * Get severity configuration by level
 */
export const getSeverityConfig = (severity: SeverityLevel) =>
  severityConfig[severity] || severityConfig.info;

/**
 * Get severity color for use in sx props
 */
export const getSeverityColor = (severity: SeverityLevel) =>
  severityConfig[severity]?.color || severityConfig.info.color;

/**
 * Get severity label
 */
export const getSeverityLabel = (severity: SeverityLevel) =>
  severityConfig[severity]?.label || 'Unknown';

/**
 * Compare severities (for sorting)
 */
export const compareSeverity = (a: SeverityLevel, b: SeverityLevel): number =>
  (severityConfig[b]?.priority || 0) - (severityConfig[a]?.priority || 0);

/**
 * Get MUI Chip styles for severity
 */
export const getSeverityChipStyles = (severity: SeverityLevel) => {
  const config = severityConfig[severity];
  return {
    backgroundColor: config?.bgColor,
    color: config?.color,
    borderColor: alpha(config?.color || '#888', 0.3),
  };
};

// ============================================================
// STATUS UTILITIES
// ============================================================

export const statusTypes: StatusType[] = [
  'new',
  'under_review',
  'confirmed',
  'false_positive',
  'out_of_scope',
  'risk_accepted',
  'mitigated',
  'duplicate',
];

export const statusConfig: Record<
  StatusType,
  {
    label: string;
    color: string;
    lightColor: string;
    bgColor: string;
    category: 'active' | 'resolved' | 'dismissed';
  }
> = {
  new: {
    label: 'New',
    color: semantic.status.new.base,
    lightColor: semantic.status.new.text,
    bgColor: semantic.status.new.subtle,
    category: 'active',
  },
  under_review: {
    label: 'Under Review',
    color: semantic.status.inProgress.base,
    lightColor: semantic.status.inProgress.text,
    bgColor: semantic.status.inProgress.subtle,
    category: 'active',
  },
  confirmed: {
    label: 'Confirmed',
    color: semantic.status.resolved.base,
    lightColor: semantic.status.resolved.text,
    bgColor: semantic.status.resolved.subtle,
    category: 'active',
  },
  false_positive: {
    label: 'False Positive',
    color: semantic.status.dismissed.base,
    lightColor: semantic.status.dismissed.text,
    bgColor: semantic.status.dismissed.subtle,
    category: 'dismissed',
  },
  out_of_scope: {
    label: 'Out of Scope',
    color: semantic.status.dismissed.base,
    lightColor: semantic.status.dismissed.text,
    bgColor: semantic.status.dismissed.subtle,
    category: 'dismissed',
  },
  risk_accepted: {
    label: 'Risk Accepted',
    color: semantic.status.inProgress.base,
    lightColor: semantic.status.inProgress.text,
    bgColor: semantic.status.inProgress.subtle,
    category: 'resolved',
  },
  mitigated: {
    label: 'Mitigated',
    color: semantic.status.resolved.base,
    lightColor: semantic.status.resolved.text,
    bgColor: semantic.status.resolved.subtle,
    category: 'resolved',
  },
  duplicate: {
    label: 'Duplicate',
    color: semantic.status.dismissed.base,
    lightColor: semantic.status.dismissed.text,
    bgColor: semantic.status.dismissed.subtle,
    category: 'dismissed',
  },
};

/**
 * Get status configuration
 */
export const getStatusConfig = (status: StatusType) =>
  statusConfig[status] || statusConfig.new;

/**
 * Get status color
 */
export const getStatusColor = (status: StatusType) =>
  statusConfig[status]?.color || statusConfig.new.color;

/**
 * Get status label
 */
export const getStatusLabel = (status: StatusType) =>
  statusConfig[status]?.label || 'Unknown';

/**
 * Check if status is considered "resolved"
 */
export const isResolvedStatus = (status: StatusType): boolean =>
  statusConfig[status]?.category === 'resolved';

/**
 * Check if status is considered "dismissed"
 */
export const isDismissedStatus = (status: StatusType): boolean =>
  statusConfig[status]?.category === 'dismissed';

/**
 * Check if status is considered "active"
 */
export const isActiveStatus = (status: StatusType): boolean =>
  statusConfig[status]?.category === 'active';

/**
 * Get MUI Chip styles for status
 */
export const getStatusChipStyles = (status: StatusType) => {
  const config = statusConfig[status];
  return {
    backgroundColor: config?.bgColor,
    color: config?.color,
    borderColor: alpha(config?.color || '#888', 0.3),
  };
};

// ============================================================
// RISK UTILITIES
// ============================================================

export const riskBands: RiskBand[] = ['critical', 'high', 'medium', 'low', 'none'];

export const riskConfig: Record<
  RiskBand,
  {
    label: string;
    color: string;
    lightColor: string;
    bgColor: string;
    minScore: number;
    maxScore: number;
  }
> = {
  critical: {
    label: 'Critical Risk',
    color: semantic.risk.critical,
    lightColor: semantic.severity.critical.text,
    bgColor: semantic.severity.critical.subtle,
    minScore: 9,
    maxScore: 10,
  },
  high: {
    label: 'High Risk',
    color: semantic.risk.high,
    lightColor: semantic.severity.high.text,
    bgColor: semantic.severity.high.subtle,
    minScore: 7,
    maxScore: 8.9,
  },
  medium: {
    label: 'Medium Risk',
    color: semantic.risk.medium,
    lightColor: semantic.severity.medium.text,
    bgColor: semantic.severity.medium.subtle,
    minScore: 4,
    maxScore: 6.9,
  },
  low: {
    label: 'Low Risk',
    color: semantic.risk.low,
    lightColor: semantic.severity.low.text,
    bgColor: semantic.severity.low.subtle,
    minScore: 0.1,
    maxScore: 3.9,
  },
  none: {
    label: 'No Risk',
    color: semantic.risk.none,
    lightColor: '#9ca3af',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    minScore: 0,
    maxScore: 0,
  },
};

/**
 * Get risk configuration
 */
export const getRiskConfig = (risk: RiskBand) =>
  riskConfig[risk] || riskConfig.none;

/**
 * Get risk color
 */
export const getRiskColor = (risk: RiskBand) =>
  riskConfig[risk]?.color || riskConfig.none.color;

/**
 * Get risk label
 */
export const getRiskLabel = (risk: RiskBand) =>
  riskConfig[risk]?.label || 'Unknown';

/**
 * Calculate risk band from CVSS score
 */
export const getRiskBandFromScore = (score: number): RiskBand => {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'none';
};

/**
 * Get MUI Chip styles for risk
 */
export const getRiskChipStyles = (risk: RiskBand) => {
  const config = riskConfig[risk];
  return {
    backgroundColor: config?.bgColor,
    color: config?.color,
    borderColor: alpha(config?.color || '#888', 0.3),
  };
};

// ============================================================
// FORMATTING UTILITIES
// ============================================================

/**
 * Format a count with severity breakdown
 */
export const formatSeverityCounts = (counts: Partial<Record<SeverityLevel, number>>): string => {
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} Critical`);
  if (counts.high) parts.push(`${counts.high} High`);
  if (counts.medium) parts.push(`${counts.medium} Medium`);
  if (counts.low) parts.push(`${counts.low} Low`);
  if (counts.info) parts.push(`${counts.info} Info`);
  return parts.join(', ') || 'None';
};

/**
 * Calculate total count from severity breakdown
 */
export const totalSeverityCount = (counts: Partial<Record<SeverityLevel, number>>): number =>
  Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);

/**
 * Get the highest severity from counts (for summary display)
 */
export const getHighestSeverity = (
  counts: Partial<Record<SeverityLevel, number>>
): SeverityLevel | null => {
  for (const level of severityLevels) {
    if (counts[level] && counts[level]! > 0) return level;
  }
  return null;
};
