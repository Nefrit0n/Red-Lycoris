/**
 * RED LYCORIS Design System - Border Tokens
 *
 * Borders define the shape and boundaries of UI elements.
 * The Lotus design uses soft, rounded corners that evoke
 * the gentle curves of lotus petals.
 */

import { primitives, darkTheme, lightTheme } from './colors';

// ============================================================
// BORDER RADIUS
// ============================================================

export const radius = {
  // None - sharp corners
  none: '0',

  // Subtle rounding
  xs: '0.125rem',   // 2px - very subtle
  sm: '0.25rem',    // 4px - inputs, small elements

  // Standard rounding
  md: '0.375rem',   // 6px - buttons, cards
  DEFAULT: '0.75rem', // 12px - default radius
  lg: '0.875rem',   // 14px - larger cards

  // Prominent rounding
  xl: '0.75rem',    // 12px - modals, featured cards
  '2xl': '1rem',    // 16px - large panels
  '3xl': '1.5rem',  // 24px - hero elements

  // Full rounding
  full: '9999px',   // Pills, circles

  // Semantic aliases
  button: '0.75rem',    // 12px
  input: '0.75rem',     // 12px
  card: '0.75rem',      // 12px
  modal: '1rem',        // 16px
  badge: '0.375rem',    // 6px
  chip: '9999px',       // Full round
  avatar: '9999px',     // Circle
  tooltip: '0.375rem',  // 6px
} as const;

// ============================================================
// BORDER WIDTH
// ============================================================

export const borderWidth = {
  0: '0',
  DEFAULT: '1px',
  2: '2px',
  3: '3px',
  4: '4px',
  8: '8px',

  // Semantic
  thin: '1px',
  medium: '2px',
  thick: '4px',
} as const;

// ============================================================
// BORDER STYLES - Complete border definitions
// ============================================================

export const borderStyle = {
  none: 'none',
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
} as const;

// ============================================================
// BORDER PRESETS - Dark theme
// ============================================================

export const bordersDark = {
  // Subtle borders - dividers, separators
  subtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${darkTheme.border.subtle}`,

  // Default borders - cards, containers
  default: `${borderWidth.DEFAULT} ${borderStyle.solid} ${darkTheme.border.default}`,

  // Strong borders - inputs, interactive elements
  strong: `${borderWidth.DEFAULT} ${borderStyle.solid} ${darkTheme.border.strong}`,

  // Focus borders
  focus: `${borderWidth[2]} ${borderStyle.solid} ${primitives.lotus[500]}`,

  // Error borders
  error: `${borderWidth.DEFAULT} ${borderStyle.solid} #ef4444`,

  // Success borders
  success: `${borderWidth.DEFAULT} ${borderStyle.solid} #10b981`,

  // Warning borders
  warning: `${borderWidth.DEFAULT} ${borderStyle.solid} #f59e0b`,

  // Interactive borders (hover)
  interactive: `${borderWidth.DEFAULT} ${borderStyle.solid} ${darkTheme.border.interactive}`,

  // Dashed borders
  dashed: `${borderWidth.DEFAULT} ${borderStyle.dashed} ${darkTheme.border.default}`,
  dashedStrong: `${borderWidth.DEFAULT} ${borderStyle.dashed} ${darkTheme.border.strong}`,

  // Brand colored borders
  lotus: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.lotus[500]}`,
  lotusSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.lotus[500]}40`,

  jade: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.jade[500]}`,
  jadeSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.jade[500]}40`,

  petal: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.petal[500]}`,
  petalSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.petal[500]}40`,

  gold: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.gold[500]}`,
  goldSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.gold[500]}40`,

  // Transparent (for layout purposes)
  transparent: `${borderWidth.DEFAULT} ${borderStyle.solid} transparent`,
} as const;

// ============================================================
// BORDER PRESETS - Light theme
// ============================================================

export const bordersLight = {
  subtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${lightTheme.border.subtle}`,
  default: `${borderWidth.DEFAULT} ${borderStyle.solid} ${lightTheme.border.default}`,
  strong: `${borderWidth.DEFAULT} ${borderStyle.solid} ${lightTheme.border.strong}`,
  focus: `${borderWidth[2]} ${borderStyle.solid} ${primitives.lotus[600]}`,
  error: `${borderWidth.DEFAULT} ${borderStyle.solid} #dc2626`,
  success: `${borderWidth.DEFAULT} ${borderStyle.solid} #059669`,
  warning: `${borderWidth.DEFAULT} ${borderStyle.solid} #d97706`,
  interactive: `${borderWidth.DEFAULT} ${borderStyle.solid} ${lightTheme.border.interactive}`,
  dashed: `${borderWidth.DEFAULT} ${borderStyle.dashed} ${lightTheme.border.default}`,
  dashedStrong: `${borderWidth.DEFAULT} ${borderStyle.dashed} ${lightTheme.border.strong}`,
  lotus: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.lotus[600]}`,
  lotusSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.lotus[600]}30`,
  jade: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.jade[600]}`,
  jadeSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.jade[600]}30`,
  petal: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.petal[600]}`,
  petalSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.petal[600]}30`,
  gold: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.gold[600]}`,
  goldSubtle: `${borderWidth.DEFAULT} ${borderStyle.solid} ${primitives.gold[600]}30`,
  transparent: `${borderWidth.DEFAULT} ${borderStyle.solid} transparent`,
} as const;

// ============================================================
// OUTLINE STYLES - For focus states (not affecting layout)
// ============================================================

export const outline = {
  none: 'none',

  // Focus outlines
  focus: {
    width: '2px',
    style: 'solid',
    color: primitives.lotus[500],
    offset: '2px',
  },

  // Error focus
  error: {
    width: '2px',
    style: 'solid',
    color: '#ef4444',
    offset: '2px',
  },

  // Ring style (popular modern focus indicator)
  ring: {
    width: '2px',
    style: 'solid',
    color: primitives.lotus[500],
    offset: '2px',
  },
} as const;

// ============================================================
// DIVIDER STYLES
// ============================================================

export const divider = {
  // Horizontal dividers
  horizontal: {
    subtle: {
      height: '1px',
      background: darkTheme.border.subtle,
    },
    default: {
      height: '1px',
      background: darkTheme.border.default,
    },
    strong: {
      height: '1px',
      background: darkTheme.border.strong,
    },
    gradient: {
      height: '1px',
      background: `linear-gradient(90deg, transparent 0%, ${darkTheme.border.default} 50%, transparent 100%)`,
    },
    lotus: {
      height: '2px',
      background: `linear-gradient(90deg, ${primitives.lotus[500]} 0%, ${primitives.petal[500]} 100%)`,
    },
  },

  // Vertical dividers
  vertical: {
    subtle: {
      width: '1px',
      background: darkTheme.border.subtle,
    },
    default: {
      width: '1px',
      background: darkTheme.border.default,
    },
    strong: {
      width: '1px',
      background: darkTheme.border.strong,
    },
  },
} as const;

// ============================================================
// COMPONENT-SPECIFIC BORDER CONFIGS
// ============================================================

export const componentBorders = {
  // Card borders
  card: {
    radius: radius.card,
    border: bordersDark.subtle,
    borderHover: bordersDark.interactive,
  },

  // Button borders
  button: {
    radius: radius.button,
    primary: bordersDark.transparent,
    secondary: bordersDark.lotus,
    ghost: bordersDark.transparent,
    outline: bordersDark.default,
  },

  // Input borders
  input: {
    radius: radius.input,
    default: bordersDark.strong,
    focus: bordersDark.focus,
    error: bordersDark.error,
    disabled: bordersDark.subtle,
  },

  // Badge borders
  badge: {
    radius: radius.badge,
    border: bordersDark.transparent,
  },

  // Chip borders
  chip: {
    radius: radius.chip,
    border: bordersDark.subtle,
  },

  // Modal borders
  modal: {
    radius: radius.modal,
    border: bordersDark.subtle,
  },

  // Tooltip borders
  tooltip: {
    radius: radius.tooltip,
    border: bordersDark.default,
  },

  // Avatar borders
  avatar: {
    radius: radius.avatar,
    border: `2px solid ${darkTheme.bg.surface}`,
    borderRing: `2px solid ${primitives.lotus[500]}`,
  },

  // Table borders
  table: {
    radius: radius.lg,
    headerBorder: bordersDark.subtle,
    cellBorder: bordersDark.subtle,
    rowHover: darkTheme.bg.hover,
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Radius = typeof radius;
export type BorderWidth = typeof borderWidth;
export type BorderStyle = typeof borderStyle;
export type BordersDark = typeof bordersDark;
export type BordersLight = typeof bordersLight;
export type Outline = typeof outline;
export type Divider = typeof divider;
export type ComponentBorders = typeof componentBorders;
