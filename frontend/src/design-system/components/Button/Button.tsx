/**
 * Red Lycoris Button Component
 *
 * Enhanced button with brand variants, glow effects, and loading states.
 * Built on MUI Button with RED LYCORIS design system integration.
 */

import React, { forwardRef } from 'react';
import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
  CircularProgress,
  alpha,
  styled,
} from '@mui/material';
import { primitives, glow, duration, easing } from '../../tokens';

// ============================================================
// TYPES
// ============================================================

export type ButtonVariant = 'contained' | 'outlined' | 'text' | 'glass' | 'glow';
export type ButtonColor = 'primary' | 'secondary' | 'lotus' | 'petal' | 'jade' | 'gold' | 'error' | 'inherit';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'color'> {
  /** Button visual style */
  variant?: ButtonVariant;
  /** Button color theme */
  color?: ButtonColor;
  /** Button size */
  size?: ButtonSize;
  /** Show loading spinner */
  loading?: boolean;
  /** Text to show while loading */
  loadingText?: string;
  /** Position of loading indicator */
  loadingPosition?: 'start' | 'center' | 'end';
  /** Icon to show at the start */
  startIcon?: React.ReactNode;
  /** Icon to show at the end */
  endIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Disable glow effect on hover (for glow variant) */
  disableGlow?: boolean;
}

// ============================================================
// STYLED COMPONENTS
// ============================================================

const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop) =>
    !['loading', 'loadingPosition', 'loadingText', 'disableGlow'].includes(prop as string),
})<{
  ownerState: {
    variant: ButtonVariant;
    color: ButtonColor;
    loading?: boolean;
    disableGlow?: boolean;
  };
}>(({ theme, ownerState }) => {
  const { variant, color, loading, disableGlow } = ownerState;

  // Base styles
  const baseStyles = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    transition: `all ${duration.fast} ${easing.smooth}`,
    // Respect reduced motion preference
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    '&:disabled': {
      opacity: 0.5,
    },
  };

  // Glass variant styles
  if (variant === 'glass') {
    return {
      ...baseStyles,
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: theme.palette.text.primary,
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
      },
      '&:active': {
        background: 'rgba(255, 255, 255, 0.08)',
      },
    };
  }

  // Glow variant styles
  if (variant === 'glow') {
    const glowColor = color === 'lotus' || color === 'primary'
      ? primitives.lotus[500]
      : color === 'petal'
        ? primitives.petal[500]
        : color === 'jade' || color === 'secondary'
          ? primitives.jade[500]
          : color === 'gold'
            ? primitives.gold[500]
            : color === 'error'
              ? '#ef4444'
              : primitives.lotus[500];

    return {
      ...baseStyles,
      background: glowColor,
      color: '#ffffff',
      boxShadow: `0 0 20px ${alpha(glowColor, 0.3)}`,
      '&:hover': {
        background: alpha(glowColor, 0.9),
        boxShadow: disableGlow
          ? `0 0 20px ${alpha(glowColor, 0.3)}`
          : `0 0 30px ${alpha(glowColor, 0.5)}, 0 0 60px ${alpha(glowColor, 0.3)}`,
        transform: 'translateY(-1px)',
      },
      '&:active': {
        transform: 'translateY(0)',
        boxShadow: `0 0 15px ${alpha(glowColor, 0.4)}`,
      },
      // Respect reduced motion preference
      '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
        '&:hover': {
          transform: 'none',
        },
        '&:active': {
          transform: 'none',
        },
      },
    };
  }

  // Loading state overlay
  if (loading) {
    return {
      ...baseStyles,
      pointerEvents: 'none' as const,
      '& .MuiButton-startIcon, & .MuiButton-endIcon': {
        opacity: 0.5,
      },
    };
  }

  return baseStyles;
});

// Loading spinner wrapper
const LoadingWrapper = styled('span')<{
  position: 'start' | 'center' | 'end';
}>(({ position }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...(position === 'center' && {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
  }),
  ...(position === 'start' && {
    marginRight: 8,
  }),
  ...(position === 'end' && {
    marginLeft: 8,
  }),
}));

// Content wrapper for loading center position
const ContentWrapper = styled('span')<{ hide?: boolean }>(({ hide }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  visibility: hide ? 'hidden' : 'visible',
}));

// ============================================================
// COMPONENT
// ============================================================

/**
 * Red Lycoris Button
 *
 * @example
 * // Basic usage
 * <Button>Click me</Button>
 *
 * // With variants
 * <Button variant="glow" color="lotus">Glow Button</Button>
 * <Button variant="glass">Glass Button</Button>
 *
 * // With loading state
 * <Button loading loadingText="Saving...">Save</Button>
 *
 * // With icons
 * <Button startIcon={<SaveIcon />}>Save</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'contained',
      color = 'primary',
      size = 'medium',
      loading = false,
      loadingText,
      loadingPosition = 'center',
      startIcon,
      endIcon,
      disabled,
      children,
      disableGlow = false,
      ...props
    },
    ref
  ) => {
    // Map custom variants to MUI variants
    const muiVariant =
      variant === 'glass' || variant === 'glow' ? 'contained' : variant;

    // Map custom colors to MUI colors
    const muiColor =
      color === 'lotus' || color === 'petal' || color === 'jade' || color === 'gold'
        ? 'primary'
        : color;

    // Render loading spinner
    const renderLoading = () => (
      <LoadingWrapper position={loadingPosition}>
        <CircularProgress
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
          color="inherit"
          thickness={4}
        />
      </LoadingWrapper>
    );

    // Determine what to show
    const showLoadingStart = loading && loadingPosition === 'start';
    const showLoadingEnd = loading && loadingPosition === 'end';
    const showLoadingCenter = loading && loadingPosition === 'center';

    return (
      <StyledButton
        ref={ref}
        variant={muiVariant}
        color={muiColor}
        size={size}
        disabled={disabled || loading}
        startIcon={showLoadingStart ? renderLoading() : startIcon}
        endIcon={showLoadingEnd ? renderLoading() : endIcon}
        ownerState={{ variant, color, loading, disableGlow }}
        {...props}
      >
        {showLoadingCenter && renderLoading()}
        <ContentWrapper hide={showLoadingCenter}>
          {loading && loadingText ? loadingText : children}
        </ContentWrapper>
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';

export default Button;
