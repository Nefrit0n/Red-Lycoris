/**
 * MetricDisplay Component
 *
 * Beautiful metric display for dashboards with trend indicators,
 * animated counters, and Lotus design system styling.
 */

import React, { forwardRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  alpha,
  styled,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { GlassCard, GlassCardProps } from '../GlassCard';
import { primitives, textStyles, duration, easing } from '../../tokens';

// ============================================================
// TYPES
// ============================================================

export type MetricSize = 'small' | 'medium' | 'large' | 'hero';
export type TrendDirection = 'up' | 'down' | 'flat';
export type MetricColor = 'default' | 'lotus' | 'petal' | 'jade' | 'gold' | 'success' | 'warning' | 'error';

export interface TrendInfo {
  value: number;
  direction: TrendDirection;
  /** Is the trend positive (up is good) or negative (down is good) */
  isPositive?: boolean;
  /** Label for the trend (e.g., "vs last week") */
  label?: string;
}

export interface MetricDisplayProps extends Omit<GlassCardProps, 'title'> {
  /** Metric value (number or string) */
  value: number | string;
  /** Metric title/label */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Trend information */
  trend?: TrendInfo;
  /** Size variant */
  size?: MetricSize;
  /** Color theme for the value */
  color?: MetricColor;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Format value as percentage */
  percentage?: boolean;
  /** Format value with thousand separators */
  formatted?: boolean;
  /** Decimal places for number formatting */
  decimals?: number;
  /** Prefix (e.g., "$", "€") */
  prefix?: string;
  /** Suffix (e.g., "%", "ms") */
  suffix?: string;
  /** Animate the value counting up */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Sparkline data for mini chart */
  sparkline?: number[];
  /** Color bar on the side */
  colorBar?: boolean;
}

// ============================================================
// CONFIGURATION
// ============================================================

const sizeConfig: Record<MetricSize, { value: string; title: string; trend: string }> = {
  small: { value: '1.5rem', title: '0.75rem', trend: '0.65rem' },
  medium: { value: '2.25rem', title: '0.875rem', trend: '0.75rem' },
  large: { value: '3rem', title: '1rem', trend: '0.875rem' },
  hero: { value: '4rem', title: '1.125rem', trend: '1rem' },
};

const colorConfig: Record<MetricColor, string> = {
  default: primitives.night[50],
  lotus: primitives.lotus[400],
  petal: primitives.petal[400],
  jade: primitives.jade[400],
  gold: primitives.gold[400],
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

// ============================================================
// STYLED COMPONENTS
// ============================================================

const MetricWrapper = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

const ValueRow = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
});

const TrendBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isPositive',
})<{ isPositive: boolean }>(({ isPositive }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: alpha(isPositive ? '#10b981' : '#ef4444', 0.15),
  color: isPositive ? '#10b981' : '#ef4444',
}));

const IconWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  backgroundColor: alpha(color, 0.15),
  color: color,
  flexShrink: 0,
  '& svg': {
    fontSize: '1.25rem',
  },
}));

const ColorBarIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'barColor',
})<{ barColor: string }>(({ barColor }) => ({
  position: 'absolute',
  left: 0,
  top: '12px',
  bottom: '12px',
  width: '3px',
  borderRadius: '0 3px 3px 0',
  backgroundColor: barColor,
}));

const SparklineContainer = styled(Box)({
  height: '32px',
  marginTop: '8px',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2px',
});

const SparklineBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'heightPercent' && prop !== 'barColor',
})<{ heightPercent: number; barColor: string }>(({ heightPercent, barColor }) => ({
  flex: 1,
  height: `${heightPercent}%`,
  backgroundColor: alpha(barColor, 0.4),
  borderRadius: '2px 2px 0 0',
  minHeight: '2px',
  transition: `height ${duration.normal} ${easing.smooth}`,
  '&:last-child': {
    backgroundColor: barColor,
  },
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(
  value: number,
  formatted: boolean,
  decimals: number,
  percentage: boolean,
  prefix?: string,
  suffix?: string
): string {
  let result = value;

  // Apply decimals
  result = Number(result.toFixed(decimals));

  // Format with thousand separators
  let formatted_string = formatted
    ? result.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : result.toString();

  // Add prefix/suffix
  if (prefix) formatted_string = prefix + formatted_string;
  if (suffix) formatted_string = formatted_string + suffix;
  if (percentage) formatted_string = formatted_string + '%';

  return formatted_string;
}

function useAnimatedCounter(
  target: number,
  enabled: boolean,
  duration_ms: number
): number {
  const [current, setCurrent] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setCurrent(target);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration_ms, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (target - startValue) * easeProgress;

      setCurrent(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, enabled, duration_ms]);

  return current;
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * MetricDisplay
 *
 * @example
 * // Basic metric
 * <MetricDisplay value={1234} title="Total Findings" />
 *
 * // With trend
 * <MetricDisplay
 *   value={42}
 *   title="Critical Issues"
 *   trend={{ value: 12, direction: 'up', isPositive: false }}
 *   color="error"
 * />
 *
 * // Hero size with animation
 * <MetricDisplay
 *   value={98.5}
 *   title="Security Score"
 *   size="hero"
 *   color="jade"
 *   suffix="%"
 *   animate
 * />
 *
 * // With sparkline
 * <MetricDisplay
 *   value={156}
 *   title="Weekly Scans"
 *   sparkline={[12, 19, 15, 22, 18, 25, 30]}
 * />
 */
export const MetricDisplay = forwardRef<HTMLDivElement, MetricDisplayProps>(
  (
    {
      value,
      title,
      subtitle,
      trend,
      size = 'medium',
      color = 'default',
      icon,
      loading = false,
      percentage = false,
      formatted = true,
      decimals = 0,
      prefix,
      suffix,
      animate = false,
      animationDuration = 1000,
      sparkline,
      colorBar = false,
      variant = 'light',
      ...cardProps
    },
    ref
  ) => {
    const theme = useTheme();
    const sizes = sizeConfig[size];
    const valueColor = colorConfig[color];

    // Animated value
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const animatedValue = useAnimatedCounter(
      numericValue,
      animate && typeof value === 'number',
      animationDuration
    );

    // Format the display value
    const displayValue =
      typeof value === 'string'
        ? value
        : formatNumber(
            animate ? animatedValue : numericValue,
            formatted,
            decimals,
            percentage,
            prefix,
            suffix
          );

    // Render trend indicator
    const renderTrend = () => {
      if (!trend) return null;

      const TrendIcon =
        trend.direction === 'up'
          ? ArrowUpward
          : trend.direction === 'down'
            ? ArrowDownward
            : TrendingFlat;

      const isPositive = trend.isPositive ?? trend.direction === 'up';

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <TrendBadge isPositive={isPositive}>
            <TrendIcon sx={{ fontSize: '0.875rem' }} />
            {Math.abs(trend.value)}%
          </TrendBadge>
          {trend.label && (
            <Typography
              variant="caption"
              sx={{ color: 'text.tertiary', fontSize: sizes.trend }}
            >
              {trend.label}
            </Typography>
          )}
        </Box>
      );
    };

    // Render sparkline
    const renderSparkline = () => {
      if (!sparkline || sparkline.length === 0) return null;

      const max = Math.max(...sparkline);
      const min = Math.min(...sparkline);
      const range = max - min || 1;

      return (
        <SparklineContainer>
          {sparkline.map((val, i) => (
            <SparklineBar
              key={i}
              heightPercent={((val - min) / range) * 80 + 20}
              barColor={valueColor}
            />
          ))}
        </SparklineContainer>
      );
    };

    // Loading state
    if (loading) {
      return (
        <GlassCard ref={ref} variant={variant} {...cardProps}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            {icon && <Skeleton variant="rounded" width={40} height={40} />}
            <MetricWrapper sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={sizes.title} />
              <Skeleton variant="text" width="80%" height={sizes.value} />
              {trend && <Skeleton variant="text" width="40%" height={20} />}
            </MetricWrapper>
          </Box>
          {sparkline && <Skeleton variant="rectangular" height={32} sx={{ mt: 1 }} />}
        </GlassCard>
      );
    }

    return (
      <GlassCard
        ref={ref}
        variant={variant}
        sx={{ position: 'relative', ...cardProps.sx }}
        {...cardProps}
      >
        {colorBar && <ColorBarIndicator barColor={valueColor} />}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            pl: colorBar ? 1.5 : 0,
          }}
        >
          {icon && <IconWrapper color={valueColor}>{icon}</IconWrapper>}

          <MetricWrapper sx={{ flex: 1 }}>
            <Typography
              variant="overline"
              sx={{
                fontSize: sizes.title,
                color: 'text.secondary',
                fontWeight: 500,
                letterSpacing: '0.05em',
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>

            <ValueRow>
              <Typography
                sx={{
                  fontSize: sizes.value,
                  fontWeight: 700,
                  color: valueColor,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {displayValue}
              </Typography>
            </ValueRow>

            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: 'text.tertiary', mt: 0.25 }}
              >
                {subtitle}
              </Typography>
            )}

            {renderTrend()}
          </MetricWrapper>
        </Box>

        {renderSparkline()}
      </GlassCard>
    );
  }
);

MetricDisplay.displayName = 'MetricDisplay';

export default MetricDisplay;
