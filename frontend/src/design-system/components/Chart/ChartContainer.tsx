/**
 * ChartContainer - Unified container for all charts
 *
 * Replaces Paper with consistent styling and glass effect.
 */

import React from 'react';
import { Box, Typography, Skeleton, styled } from '@mui/material';
import { primitives, alpha } from '../../tokens/colors';
import { radius } from '../../tokens/borders';
import { elevation } from '../../tokens/shadows';

// ============================================================
// TYPES
// ============================================================

export interface ChartContainerProps {
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Whether data is loading */
  loading?: boolean;
  /** Height of the chart area */
  height?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether there is data to show */
  hasData?: boolean;
  /** Loading skeleton variant */
  loadingVariant?: 'pie' | 'bar' | 'line' | 'list';
  /** Children (chart content) */
  children: React.ReactNode;
  /** Optional action in header */
  action?: React.ReactNode;
}

// ============================================================
// STYLED COMPONENTS
// ============================================================

const Container = styled(Box)(() => ({
  backgroundColor: primitives.night[700],
  borderRadius: radius.lg,
  border: `1px solid ${primitives.night[600]}`,
  boxShadow: elevation.md,
  padding: 24,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const Header = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 16,
});

const EmptyState = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: primitives.night[300],
});

// ============================================================
// LOADING SKELETONS
// ============================================================

const LoadingSkeleton: React.FC<{ variant: ChartContainerProps['loadingVariant']; height: number }> = ({
  variant = 'bar',
  height,
}) => {
  switch (variant) {
    case 'pie':
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Skeleton
            variant="circular"
            width={Math.min(200, height - 50)}
            height={Math.min(200, height - 50)}
            sx={{ bgcolor: alpha.white[10] }}
          />
        </Box>
      );
    case 'line':
      return (
        <Skeleton
          variant="rectangular"
          height={height - 50}
          sx={{ mt: 2, borderRadius: 1, bgcolor: alpha.white[10] }}
        />
      );
    case 'list':
      return (
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: alpha.white[10] }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={20} sx={{ bgcolor: alpha.white[10] }} />
                <Skeleton variant="text" width="40%" height={16} sx={{ bgcolor: alpha.white[10] }} />
              </Box>
            </Box>
          ))}
        </Box>
      );
    case 'bar':
    default:
      return (
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={24}
              sx={{ mb: 1, borderRadius: 1, bgcolor: alpha.white[10] }}
            />
          ))}
        </Box>
      );
  }
};

// ============================================================
// COMPONENT
// ============================================================

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  loading = false,
  height = 250,
  emptyMessage = 'No data available',
  hasData = true,
  loadingVariant = 'bar',
  children,
  action,
}) => {
  if (loading) {
    return (
      <Container>
        <Skeleton variant="text" width="50%" height={28} sx={{ bgcolor: alpha.white[10] }} />
        {subtitle && <Skeleton variant="text" width="30%" height={20} sx={{ bgcolor: alpha.white[10] }} />}
        <LoadingSkeleton variant={loadingVariant} height={height} />
      </Container>
    );
  }

  return (
    <Container>
      {(title || action) && (
        <Header>
          <Box>
            {title && (
              <Typography variant="h6" fontWeight={600} sx={{ color: primitives.night[50] }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" sx={{ color: primitives.night[300], mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Header>
      )}

      {!hasData ? (
        <EmptyState sx={{ minHeight: height }}>
          <Typography color="inherit">{emptyMessage}</Typography>
        </EmptyState>
      ) : (
        <Box sx={{ flex: 1, minHeight: height }}>{children}</Box>
      )}
    </Container>
  );
};

export default ChartContainer;
