/**
 * GlassCard Component
 *
 * Premium card component with glassmorphism effects.
 * The signature Lotus Warden UI style.
 */

import React, { forwardRef } from 'react';
import {
  Box,
  BoxProps,
  Paper,
  PaperProps,
  Typography,
  alpha,
  styled,
} from '@mui/material';
import { primitives, glow, radius, duration, easing } from '../../tokens';

// ============================================================
// TYPES
// ============================================================

export type GlassVariant = 'subtle' | 'light' | 'medium' | 'heavy' | 'lotus' | 'solid';
export type GlowColor = 'none' | 'lotus' | 'petal' | 'jade' | 'gold';

export interface GlassCardProps extends Omit<PaperProps, 'variant'> {
  /** Glass intensity variant */
  variant?: GlassVariant;
  /** Glow color on hover */
  glowColor?: GlowColor;
  /** Always show glow (not just on hover) */
  glowAlways?: boolean;
  /** Disable hover effects */
  disableHover?: boolean;
  /** Card header content */
  header?: React.ReactNode;
  /** Card footer content */
  footer?: React.ReactNode;
  /** Header title (shorthand) */
  title?: string;
  /** Header subtitle (shorthand) */
  subtitle?: string;
  /** Header action element */
  headerAction?: React.ReactNode;
  /** Padding preset */
  padding?: 'none' | 'compact' | 'normal' | 'comfortable';
  /** Interactive (clickable) card */
  interactive?: boolean;
  /** Selected state */
  selected?: boolean;
}

// ============================================================
// CONFIGURATION
// ============================================================

const glassStyles: Record<GlassVariant, React.CSSProperties> = {
  subtle: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  light: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  },
  lotus: {
    background: `linear-gradient(135deg, ${alpha(primitives.lotus[500], 0.08)} 0%, ${alpha(primitives.petal[500], 0.05)} 100%)`,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  solid: {
    background: primitives.night[700],
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
};

const glowColors: Record<GlowColor, string> = {
  none: 'transparent',
  lotus: primitives.lotus[500],
  petal: primitives.petal[500],
  jade: primitives.jade[500],
  gold: primitives.gold[500],
};

const paddingPresets: Record<string, string> = {
  none: '0',
  compact: '12px',
  normal: '16px',
  comfortable: '24px',
};

// ============================================================
// STYLED COMPONENTS
// ============================================================

const StyledPaper = styled(Paper, {
  shouldForwardProp: (prop) =>
    ![
      'glassVariant',
      'glowColor',
      'glowAlways',
      'disableHover',
      'interactive',
      'selected',
      'paddingPreset',
    ].includes(prop as string),
})<{
  glassVariant: GlassVariant;
  glowColor: GlowColor;
  glowAlways?: boolean;
  disableHover?: boolean;
  interactive?: boolean;
  selected?: boolean;
  paddingPreset: string;
}>(({
  glassVariant,
  glowColor,
  glowAlways,
  disableHover,
  interactive,
  selected,
  paddingPreset,
}) => {
  const glass = glassStyles[glassVariant];
  const glowValue = glowColors[glowColor];
  const hasGlow = glowColor !== 'none';

  return {
    ...glass,
    borderRadius: radius.card,
    border: `1px solid ${
      selected
        ? alpha(glowValue || primitives.lotus[500], 0.5)
        : glassVariant === 'solid'
          ? primitives.night[600]
          : 'rgba(255, 255, 255, 0.08)'
    }`,
    padding: paddingPresets[paddingPreset],
    transition: `all ${duration.normal} ${easing.smooth}`,
    position: 'relative',
    overflow: 'hidden',

    // Glow effect
    ...(hasGlow && glowAlways && {
      boxShadow: `0 0 20px ${alpha(glowValue, 0.15)}`,
    }),

    // Selected state
    ...(selected && {
      boxShadow: `0 0 0 2px ${alpha(glowValue || primitives.lotus[500], 0.5)}, 0 0 20px ${alpha(glowValue || primitives.lotus[500], 0.2)}`,
    }),

    // Interactive/Hover effects
    ...(!disableHover && {
      cursor: interactive ? 'pointer' : 'default',
      '&:hover': {
        borderColor: selected
          ? alpha(glowValue || primitives.lotus[500], 0.6)
          : 'rgba(255, 255, 255, 0.15)',
        ...(hasGlow && {
          boxShadow: `0 0 25px ${alpha(glowValue, 0.25)}`,
        }),
        ...(interactive && {
          transform: 'translateY(-2px)',
          boxShadow: hasGlow
            ? `0 8px 30px ${alpha(glowValue, 0.2)}, 0 0 20px ${alpha(glowValue, 0.15)}`
            : `0 8px 30px rgba(0, 0, 0, 0.3)`,
        }),
      },
      '&:active': interactive ? {
        transform: 'translateY(0)',
      } : {},
    }),
  };
});

const CardHeader = styled(Box)({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: '16px',
  gap: '12px',
});

const CardFooter = styled(Box)({
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: `1px solid ${alpha(primitives.night[500], 0.5)}`,
});

// ============================================================
// COMPONENT
// ============================================================

/**
 * GlassCard
 *
 * @example
 * // Basic glass card
 * <GlassCard variant="light">Content</GlassCard>
 *
 * // Lotus themed with glow
 * <GlassCard variant="lotus" glowColor="lotus" glowAlways>
 *   Premium content
 * </GlassCard>
 *
 * // With header
 * <GlassCard
 *   title="Dashboard"
 *   subtitle="Overview of your security posture"
 *   headerAction={<IconButton><MoreVertIcon /></IconButton>}
 * >
 *   Content
 * </GlassCard>
 *
 * // Interactive card
 * <GlassCard interactive onClick={handleClick}>
 *   Click me
 * </GlassCard>
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'light',
      glowColor = 'none',
      glowAlways = false,
      disableHover = false,
      header,
      footer,
      title,
      subtitle,
      headerAction,
      padding = 'normal',
      interactive = false,
      selected = false,
      children,
      ...props
    },
    ref
  ) => {
    // Render header if provided
    const renderHeader = () => {
      if (header) return header;
      if (!title && !subtitle && !headerAction) return null;

      return (
        <CardHeader>
          <Box>
            {title && (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  lineHeight: 1.3,
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mt: 0.5,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {headerAction && <Box sx={{ flexShrink: 0 }}>{headerAction}</Box>}
        </CardHeader>
      );
    };

    return (
      <StyledPaper
        ref={ref}
        elevation={0}
        glassVariant={variant}
        glowColor={glowColor}
        glowAlways={glowAlways}
        disableHover={disableHover}
        interactive={interactive}
        selected={selected}
        paddingPreset={padding}
        {...props}
      >
        {renderHeader()}
        {children}
        {footer && <CardFooter>{footer}</CardFooter>}
      </StyledPaper>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
