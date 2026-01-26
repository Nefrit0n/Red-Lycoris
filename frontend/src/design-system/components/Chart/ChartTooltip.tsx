/**
 * ChartTooltip - Unified tooltip for all charts
 *
 * Provides consistent styling for Recharts tooltips.
 */

import React from 'react';
import { Box, Typography, styled } from '@mui/material';
import { primitives, alpha } from '../../tokens/colors';
import { radius } from '../../tokens/borders';
import { elevation } from '../../tokens/shadows';

// ============================================================
// TYPES
// ============================================================

export interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  /** Custom value formatter */
  formatValue?: (value: number, name: string) => string;
  /** Custom label formatter */
  formatLabel?: (label: string) => string;
  /** Unit suffix for values */
  unit?: string;
}

// ============================================================
// STYLED COMPONENTS
// ============================================================

const TooltipContainer = styled(Box)(() => ({
  backgroundColor: primitives.night[700],
  border: `1px solid ${primitives.night[500]}`,
  borderRadius: radius.md,
  boxShadow: elevation.lg,
  padding: '12px 16px',
  backdropFilter: 'blur(8px)',
  minWidth: 120,
}));

const TooltipLabel = styled(Typography)(() => ({
  color: primitives.night[100],
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
}));

const TooltipItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
});

const ColorDot = styled(Box)<{ dotColor: string }>(({ dotColor }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: dotColor,
  boxShadow: `0 0 6px ${alpha.black[30]}`,
}));

const TooltipValue = styled(Typography)(() => ({
  color: primitives.night[200],
  fontSize: 12,
}));

// ============================================================
// COMPONENT
// ============================================================

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  formatValue,
  formatLabel,
  unit = '',
}) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const displayLabel = formatLabel ? formatLabel(label || '') : label;

  return (
    <TooltipContainer>
      {displayLabel && <TooltipLabel>{displayLabel}</TooltipLabel>}
      {payload.map((entry, index) => {
        const displayValue = formatValue
          ? formatValue(entry.value, entry.name)
          : `${entry.value}${unit}`;

        return (
          <TooltipItem key={index}>
            <ColorDot dotColor={entry.color} />
            <TooltipValue>
              <strong style={{ color: entry.color }}>{entry.name}:</strong> {displayValue}
            </TooltipValue>
          </TooltipItem>
        );
      })}
    </TooltipContainer>
  );
};

// ============================================================
// SIMPLE TOOLTIP VARIANT
// ============================================================

export interface SimpleTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      value: number;
      color?: string;
    };
  }>;
  /** Value suffix */
  suffix?: string;
}

export const SimpleTooltip: React.FC<SimpleTooltipProps> = ({ active, payload, suffix = 'findings' }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <TooltipContainer>
      <TooltipLabel sx={{ color: data.color || primitives.lotus[400] }}>{data.name}</TooltipLabel>
      <TooltipValue>
        {data.value} {suffix}
      </TooltipValue>
    </TooltipContainer>
  );
};

export default ChartTooltip;
