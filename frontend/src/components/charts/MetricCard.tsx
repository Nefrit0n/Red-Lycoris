/**
 * MetricCard Component
 *
 * Dashboard metric card built on the Lotus design system.
 * Displays a value with optional trend, icon, and color accent.
 */

import { ReactNode } from 'react';
import { MetricDisplay, GlassCard } from '../../design-system/components';
import { primitives } from '../../design-system/tokens';
import type { TrendInfo, MetricColor } from '../../design-system/components/MetricDisplay';

export type MetricCardProps = {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  loading?: boolean;
};

// Map legacy color strings to design system colors
const mapColor = (color?: string): MetricColor => {
  if (!color) return 'default';

  // Check for design system color names
  if (color === primitives.lotus[500] || color.includes('lotus')) return 'lotus';
  if (color === primitives.petal[500] || color.includes('petal')) return 'petal';
  if (color === primitives.jade[500] || color.includes('jade')) return 'jade';
  if (color === primitives.gold[500] || color.includes('gold')) return 'gold';

  // Check for semantic colors
  if (color.includes('22c55e') || color.includes('10b981') || color.includes('16a34a')) return 'success';
  if (color.includes('f59e0b') || color.includes('eab308') || color.includes('fbbf24')) return 'warning';
  if (color.includes('ef4444') || color.includes('dc2626') || color.includes('f87171')) return 'error';

  // Default to lotus for the old blue color
  if (color === '#7aa2f7') return 'lotus';

  return 'default';
};

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = '#7aa2f7',
  loading = false,
}: MetricCardProps) => {
  // Convert legacy trend format to new format
  const trendInfo: TrendInfo | undefined = trend
    ? {
        value: trend.value,
        direction: trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'flat',
        isPositive: trend.isPositive,
      }
    : undefined;

  return (
    <MetricDisplay
      value={value}
      title={title}
      subtitle={subtitle}
      icon={icon}
      trend={trendInfo}
      color={mapColor(color)}
      loading={loading}
      colorBar
      variant="solid"
      formatted={typeof value === 'number'}
      sx={{ height: '100%' }}
    />
  );
};

export default MetricCard;
