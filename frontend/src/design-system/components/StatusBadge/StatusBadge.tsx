/**
 * StatusBadge Component
 *
 * Unified badge component for displaying severity levels, statuses,
 * and risk bands. Core component for security-related UI.
 */

import React, { forwardRef } from 'react';
import { Chip, ChipProps, alpha, styled, useTheme } from '@mui/material';
import {
  ErrorOutline,
  Warning,
  Info,
  CheckCircleOutline,
  RemoveCircleOutline,
  FiberNew,
  Autorenew,
  Verified,
  Block,
  Security,
} from '@mui/icons-material';
import { semantic } from '../../tokens';

// ============================================================
// TYPES
// ============================================================

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type StatusType =
  | 'new'
  | 'under_review'
  | 'confirmed'
  | 'false_positive'
  | 'out_of_scope'
  | 'risk_accepted'
  | 'mitigated'
  | 'duplicate';
export type RiskBand = 'critical' | 'high' | 'medium' | 'low' | 'none';

export type BadgeType = 'severity' | 'status' | 'risk';

export interface StatusBadgeProps extends Omit<ChipProps, 'color'> {
  /** Type of badge */
  type: BadgeType;
  /** Value based on type */
  value: SeverityLevel | StatusType | RiskBand;
  /** Show icon */
  showIcon?: boolean;
  /** Custom label (overrides default) */
  label?: string;
  /** Compact mode (smaller) */
  compact?: boolean;
  /** Pulsing animation for critical/new items */
  pulse?: boolean;
  /** Glow effect */
  glow?: boolean;
}

// ============================================================
// CONFIGURATION
// ============================================================

const severityConfig: Record<
  SeverityLevel,
  { label: string; color: string; icon: React.ElementType }
> = {
  critical: {
    label: 'Critical',
    color: semantic.severity.critical.base,
    icon: Security,
  },
  high: {
    label: 'High',
    color: semantic.severity.high.base,
    icon: ErrorOutline,
  },
  medium: {
    label: 'Medium',
    color: semantic.severity.medium.base,
    icon: Warning,
  },
  low: {
    label: 'Low',
    color: semantic.severity.low.base,
    icon: CheckCircleOutline,
  },
  info: {
    label: 'Info',
    color: semantic.severity.info.base,
    icon: Info,
  },
};

const statusConfig: Record<
  StatusType,
  { label: string; color: string; icon: React.ElementType }
> = {
  new: {
    label: 'New',
    color: semantic.status.new.base,
    icon: FiberNew,
  },
  under_review: {
    label: 'Under Review',
    color: semantic.status.inProgress.base,
    icon: Autorenew,
  },
  confirmed: {
    label: 'Confirmed',
    color: semantic.status.resolved.base,
    icon: Verified,
  },
  false_positive: {
    label: 'False Positive',
    color: semantic.status.dismissed.base,
    icon: Block,
  },
  out_of_scope: {
    label: 'Out of Scope',
    color: semantic.status.dismissed.base,
    icon: RemoveCircleOutline,
  },
  risk_accepted: {
    label: 'Risk Accepted',
    color: semantic.status.inProgress.base,
    icon: Warning,
  },
  mitigated: {
    label: 'Mitigated',
    color: semantic.status.resolved.base,
    icon: CheckCircleOutline,
  },
  duplicate: {
    label: 'Duplicate',
    color: semantic.status.dismissed.base,
    icon: RemoveCircleOutline,
  },
};

const riskConfig: Record<
  RiskBand,
  { label: string; color: string; icon: React.ElementType }
> = {
  critical: {
    label: 'Critical Risk',
    color: semantic.risk.critical,
    icon: Security,
  },
  high: {
    label: 'High Risk',
    color: semantic.risk.high,
    icon: ErrorOutline,
  },
  medium: {
    label: 'Medium Risk',
    color: semantic.risk.medium,
    icon: Warning,
  },
  low: {
    label: 'Low Risk',
    color: semantic.risk.low,
    icon: CheckCircleOutline,
  },
  none: {
    label: 'No Risk',
    color: semantic.risk.none,
    icon: RemoveCircleOutline,
  },
};

// ============================================================
// STYLED COMPONENTS
// ============================================================

const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) =>
    !['badgeColor', 'compact', 'pulse', 'glow'].includes(prop as string),
})<{
  badgeColor: string;
  compact?: boolean;
  pulse?: boolean;
  glow?: boolean;
}>(({ badgeColor, compact, pulse, glow }) => ({
  backgroundColor: alpha(badgeColor, 0.15),
  color: badgeColor,
  borderColor: alpha(badgeColor, 0.3),
  fontWeight: 600,
  fontSize: compact ? '0.65rem' : '0.75rem',
  height: compact ? '20px' : '24px',
  letterSpacing: '0.025em',

  '& .MuiChip-icon': {
    color: badgeColor,
    fontSize: compact ? '0.875rem' : '1rem',
  },

  '& .MuiChip-label': {
    padding: compact ? '0 6px' : '0 8px',
  },

  ...(glow && {
    boxShadow: `0 0 12px ${alpha(badgeColor, 0.4)}`,
  }),

  ...(pulse && {
    animation: 'statusPulse 2s ease-in-out infinite',
    '@keyframes statusPulse': {
      '0%, 100%': {
        boxShadow: `0 0 0 0 ${alpha(badgeColor, 0.4)}`,
      },
      '50%': {
        boxShadow: `0 0 0 4px ${alpha(badgeColor, 0.1)}`,
      },
    },
  }),

  '&:hover': {
    backgroundColor: alpha(badgeColor, 0.25),
  },
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getConfig(
  type: BadgeType,
  value: SeverityLevel | StatusType | RiskBand
) {
  switch (type) {
    case 'severity':
      return severityConfig[value as SeverityLevel];
    case 'status':
      return statusConfig[value as StatusType];
    case 'risk':
      return riskConfig[value as RiskBand];
    default:
      return severityConfig.info;
  }
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * StatusBadge
 *
 * @example
 * // Severity badge
 * <StatusBadge type="severity" value="critical" />
 *
 * // Status badge with icon
 * <StatusBadge type="status" value="new" showIcon />
 *
 * // Risk badge with glow
 * <StatusBadge type="risk" value="high" glow />
 *
 * // Compact mode
 * <StatusBadge type="severity" value="medium" compact />
 */
export const StatusBadge = forwardRef<HTMLDivElement, StatusBadgeProps>(
  (
    {
      type,
      value,
      showIcon = false,
      label: customLabel,
      compact = false,
      pulse = false,
      glow = false,
      variant = 'filled',
      size = 'small',
      ...props
    },
    ref
  ) => {
    const config = getConfig(type, value);
    const IconComponent = config.icon;

    // Auto-pulse for critical/new items
    const shouldPulse =
      pulse || (type === 'severity' && value === 'critical') || (type === 'status' && value === 'new');

    return (
      <StyledChip
        ref={ref}
        label={customLabel || config.label}
        icon={showIcon ? <IconComponent /> : undefined}
        variant={variant}
        size={size}
        badgeColor={config.color}
        compact={compact}
        pulse={shouldPulse && !compact}
        glow={glow}
        {...props}
      />
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

// ============================================================
// CONVENIENCE COMPONENTS
// ============================================================

/**
 * SeverityBadge - Shorthand for severity type
 */
export const SeverityBadge = forwardRef<
  HTMLDivElement,
  Omit<StatusBadgeProps, 'type' | 'value'> & { severity: SeverityLevel }
>(({ severity, ...props }, ref) => (
  <StatusBadge ref={ref} type="severity" value={severity} {...props} />
));
SeverityBadge.displayName = 'SeverityBadge';

/**
 * FindingStatusBadge - Shorthand for status type
 */
export const FindingStatusBadge = forwardRef<
  HTMLDivElement,
  Omit<StatusBadgeProps, 'type' | 'value'> & { status: StatusType }
>(({ status, ...props }, ref) => (
  <StatusBadge ref={ref} type="status" value={status} {...props} />
));
FindingStatusBadge.displayName = 'FindingStatusBadge';

/**
 * RiskBadge - Shorthand for risk type
 */
export const RiskBadge = forwardRef<
  HTMLDivElement,
  Omit<StatusBadgeProps, 'type' | 'value'> & { risk: RiskBand }
>(({ risk, ...props }, ref) => (
  <StatusBadge ref={ref} type="risk" value={risk} {...props} />
));
RiskBadge.displayName = 'RiskBadge';

export default StatusBadge;
