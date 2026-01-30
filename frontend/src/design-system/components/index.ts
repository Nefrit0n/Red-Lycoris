/**
 * RED LYCORIS Design System - Component Exports
 *
 * @example
 * import { Button, GlassCard, StatusBadge, MetricDisplay } from '@/design-system/components';
 */

// ============================================================
// BUTTON
// ============================================================

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonColor, ButtonSize } from './Button';

// ============================================================
// STATUS BADGE
// ============================================================

export {
  StatusBadge,
  SeverityBadge,
  FindingStatusBadge,
  RiskBadge,
} from './StatusBadge';
export type {
  StatusBadgeProps,
  SeverityLevel,
  StatusType,
  RiskBand,
  BadgeType,
} from './StatusBadge';

// ============================================================
// GLASS CARD
// ============================================================

export { GlassCard } from './GlassCard';
export type { GlassCardProps, GlassVariant, GlowColor } from './GlassCard';

// ============================================================
// METRIC DISPLAY
// ============================================================

export { MetricDisplay } from './MetricDisplay';
export type {
  MetricDisplayProps,
  MetricSize,
  TrendDirection,
  TrendInfo,
  MetricColor,
} from './MetricDisplay';

// ============================================================
// CHART COMPONENTS
// ============================================================

export { ChartContainer, ChartTooltip, SimpleTooltip } from './Chart';
export type {
  ChartContainerProps,
  ChartTooltipProps,
  SimpleTooltipProps,
  TooltipPayload,
} from './Chart';
