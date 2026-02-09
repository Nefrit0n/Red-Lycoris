/**
 * RED LYCORIS Design System - Visual Effects Tokens
 *
 * Modern visual effects that give the interface its premium,
 * ethereal quality. Includes glassmorphism, backdrop effects,
 * overlays, and other visual treatments.
 */

import { primitives, gradients as colorGradients, alpha } from './colors';

// ============================================================
// BACKDROP BLUR - Glassmorphism foundation
// ============================================================

export const blur = {
  none: 'blur(0)',
  xs: 'blur(2px)',
  sm: 'blur(4px)',
  md: 'blur(8px)',
  DEFAULT: 'blur(12px)',
  lg: 'blur(16px)',
  xl: 'blur(24px)',
  '2xl': 'blur(40px)',
  '3xl': 'blur(64px)',
} as const;

// ============================================================
// GLASS EFFECTS - Frosted glass styles
// ============================================================

export const glass = {
  // Subtle glass - light frosted effect
  subtle: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: blur.md,
    WebkitBackdropFilter: blur.md,
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },

  // Light glass - more prominent
  light: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: blur.DEFAULT,
    WebkitBackdropFilter: blur.DEFAULT,
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },

  // Medium glass - standard glassmorphism
  medium: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: blur.lg,
    WebkitBackdropFilter: blur.lg,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },

  // Heavy glass - very prominent
  heavy: {
    background: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: blur.xl,
    WebkitBackdropFilter: blur.xl,
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },

  // Dark glass - for light mode
  dark: {
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: blur.lg,
    WebkitBackdropFilter: blur.lg,
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },

  // Red Lycoris tinted glass - branded
  lotus: {
    background: `linear-gradient(135deg, ${alpha.lotus[5]} 0%, rgba(232, 85, 168, 0.03) 100%)`,
    backdropFilter: blur.lg,
    WebkitBackdropFilter: blur.lg,
    border: `1px solid ${alpha.lotus[10]}`,
  },

  // Card glass - optimized for cards
  card: {
    background: 'rgba(21, 25, 34, 0.8)',
    backdropFilter: blur.DEFAULT,
    WebkitBackdropFilter: blur.DEFAULT,
    border: `1px solid ${primitives.night[600]}`,
  },

  // Modal glass - optimized for modals
  modal: {
    background: 'rgba(15, 17, 23, 0.9)',
    backdropFilter: blur.xl,
    WebkitBackdropFilter: blur.xl,
    border: `1px solid ${primitives.night[550]}`,
  },

  // Sidebar glass
  sidebar: {
    background: 'rgba(21, 25, 34, 0.85)',
    backdropFilter: blur.lg,
    WebkitBackdropFilter: blur.lg,
    border: `1px solid ${primitives.night[600]}`,
  },

  // Header glass
  header: {
    background: 'rgba(15, 17, 23, 0.8)',
    backdropFilter: blur.DEFAULT,
    WebkitBackdropFilter: blur.DEFAULT,
    borderBottom: `1px solid ${primitives.night[600]}`,
  },
} as const;

// ============================================================
// OVERLAY EFFECTS - For modals, drawers, etc.
// ============================================================

export const overlay = {
  // Light overlays
  light: {
    5: 'rgba(0, 0, 0, 0.05)',
    10: 'rgba(0, 0, 0, 0.1)',
    20: 'rgba(0, 0, 0, 0.2)',
    30: 'rgba(0, 0, 0, 0.3)',
    40: 'rgba(0, 0, 0, 0.4)',
    50: 'rgba(0, 0, 0, 0.5)',
    60: 'rgba(0, 0, 0, 0.6)',
    70: 'rgba(0, 0, 0, 0.7)',
    80: 'rgba(0, 0, 0, 0.8)',
    90: 'rgba(0, 0, 0, 0.9)',
  },

  // Modal overlay - with blur
  modal: {
    background: 'rgba(5, 6, 10, 0.8)',
    backdropFilter: blur.sm,
    WebkitBackdropFilter: blur.sm,
  },

  // Drawer overlay
  drawer: {
    background: 'rgba(5, 6, 10, 0.6)',
    backdropFilter: blur.xs,
    WebkitBackdropFilter: blur.xs,
  },

  // Image overlay gradient (for text on images)
  imageBottom: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%)',
  imageTop: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, transparent 100%)',
  imageFull: 'rgba(0, 0, 0, 0.5)',

  // Scrim (for disabling content behind)
  scrim: 'rgba(0, 0, 0, 0.32)',
} as const;

// ============================================================
// GRADIENTS - Re-exported with additional utility gradients
// ============================================================

export const gradients = {
  // Brand gradients (from colors.ts)
  ...colorGradients,

  // Additional utility gradients
  fadeBottom: 'linear-gradient(to bottom, transparent 0%, rgba(15, 17, 23, 1) 100%)',
  fadeTop: 'linear-gradient(to top, transparent 0%, rgba(15, 17, 23, 1) 100%)',
  fadeLeft: 'linear-gradient(to left, transparent 0%, rgba(15, 17, 23, 1) 100%)',
  fadeRight: 'linear-gradient(to right, transparent 0%, rgba(15, 17, 23, 1) 100%)',

  // Shimmer effect for loading states
  shimmer: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)',

  // Border gradients
  borderLotus: `linear-gradient(135deg, ${primitives.lotus[500]} 0%, ${primitives.petal[500]} 100%)`,
  borderJade: `linear-gradient(135deg, ${primitives.jade[500]} 0%, ${primitives.lotus[500]} 100%)`,
  borderGold: `linear-gradient(135deg, ${primitives.gold[500]} 0%, ${primitives.petal[500]} 100%)`,

  // Noise texture overlay (for grain effect)
  noise: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
} as const;

// ============================================================
// OPACITY LEVELS
// ============================================================

export const opacity = {
  0: '0',
  5: '0.05',
  10: '0.1',
  15: '0.15',
  20: '0.2',
  25: '0.25',
  30: '0.3',
  40: '0.4',
  50: '0.5',
  60: '0.6',
  70: '0.7',
  75: '0.75',
  80: '0.8',
  90: '0.9',
  95: '0.95',
  100: '1',

  // Semantic opacity
  disabled: '0.5',
  placeholder: '0.6',
  secondary: '0.7',
  hover: '0.8',
  active: '0.9',
} as const;

// ============================================================
// FILTERS - Image and element filters
// ============================================================

export const filters = {
  none: 'none',

  // Grayscale
  grayscale: 'grayscale(100%)',
  grayscaleHalf: 'grayscale(50%)',

  // Brightness
  brightnessUp: 'brightness(1.1)',
  brightnessDown: 'brightness(0.9)',
  brightnessDim: 'brightness(0.7)',

  // Contrast
  contrastUp: 'contrast(1.1)',
  contrastDown: 'contrast(0.9)',

  // Saturation
  saturate: 'saturate(1.2)',
  desaturate: 'saturate(0.8)',

  // Combined filters for states
  disabled: 'grayscale(100%) opacity(0.5)',
  muted: 'grayscale(50%) opacity(0.7)',

  // Drop shadow (for icons, images)
  dropShadow: {
    sm: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.05))',
    md: 'drop-shadow(0 4px 3px rgba(0, 0, 0, 0.07)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.06))',
    lg: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1))',
    xl: 'drop-shadow(0 20px 13px rgba(0, 0, 0, 0.03)) drop-shadow(0 8px 5px rgba(0, 0, 0, 0.08))',
    lotus: `drop-shadow(0 0 8px ${primitives.lotus[500]}60)`,
    petal: `drop-shadow(0 0 8px ${primitives.petal[500]}60)`,
  },
} as const;

// ============================================================
// TRANSFORMS - Common transform utilities
// ============================================================

export const transform = {
  none: 'none',

  // Scale
  scale: {
    95: 'scale(0.95)',
    100: 'scale(1)',
    102: 'scale(1.02)',
    105: 'scale(1.05)',
    110: 'scale(1.1)',
  },

  // Rotate
  rotate: {
    0: 'rotate(0deg)',
    45: 'rotate(45deg)',
    90: 'rotate(90deg)',
    180: 'rotate(180deg)',
    '-45': 'rotate(-45deg)',
    '-90': 'rotate(-90deg)',
  },

  // Translate
  translate: {
    up: {
      sm: 'translateY(-2px)',
      md: 'translateY(-4px)',
      lg: 'translateY(-8px)',
    },
    down: {
      sm: 'translateY(2px)',
      md: 'translateY(4px)',
      lg: 'translateY(8px)',
    },
  },

  // Common interactive transforms
  hover: 'translateY(-2px) scale(1.02)',
  active: 'translateY(0) scale(0.98)',
  focus: 'scale(1.02)',
} as const;

// ============================================================
// VISUAL EFFECT PRESETS - Ready-to-use combinations
// ============================================================

export const effectPresets = {
  // Glass card
  glassCard: {
    ...glass.card,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
  },

  // Glass card with lotus glow
  glassCardGlow: {
    ...glass.lotus,
    boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 0 20px ${alpha.lotus[15]}`,
    borderRadius: '12px',
  },

  // Floating element
  floating: {
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
    transform: 'translateY(-4px)',
  },

  // Pressed element
  pressed: {
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
    transform: 'translateY(1px)',
  },

  // Disabled element
  disabled: {
    opacity: '0.5',
    filter: 'grayscale(30%)',
    pointerEvents: 'none' as const,
  },

  // Gradient border effect (using pseudo-element)
  gradientBorder: {
    position: 'relative' as const,
    background: primitives.night[700],
    borderRadius: '12px',
    // Note: Requires ::before pseudo-element for gradient border
    // backgroundClip: 'padding-box',
  },

  // Shine effect on hover
  shine: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    // Note: Requires ::after pseudo-element for shine animation
  },
} as const;

// ============================================================
// CURSOR STYLES
// ============================================================

export const cursor = {
  auto: 'auto',
  default: 'default',
  pointer: 'pointer',
  wait: 'wait',
  text: 'text',
  move: 'move',
  help: 'help',
  notAllowed: 'not-allowed',
  none: 'none',
  grab: 'grab',
  grabbing: 'grabbing',
  crosshair: 'crosshair',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  colResize: 'col-resize',
  rowResize: 'row-resize',
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Blur = typeof blur;
export type Glass = typeof glass;
export type Overlay = typeof overlay;
export type Gradients = typeof gradients;
export type Opacity = typeof opacity;
export type Filters = typeof filters;
export type Transform = typeof transform;
export type EffectPresets = typeof effectPresets;
export type Cursor = typeof cursor;
