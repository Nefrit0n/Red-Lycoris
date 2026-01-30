/**
 * RED LYCORIS Design System - Shadow & Glow Tokens
 *
 * Shadows create depth and hierarchy in the interface.
 * Glows add the signature "Lotus" ethereal feeling.
 *
 * The system includes:
 * - Elevation shadows (depth)
 * - Glow effects (brand accents)
 * - Inner shadows (inset)
 * - Focus rings (accessibility)
 */

import { primitives } from './colors';

// ============================================================
// ELEVATION SHADOWS - For depth and hierarchy
// ============================================================

export const elevation = {
  // No shadow
  none: 'none',

  // Subtle lift - cards, buttons default
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

  // Light elevation - hover states
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',

  // Medium elevation - dropdowns, popovers
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',

  // High elevation - modals, drawers
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',

  // Highest elevation - toasts, tooltips floating
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',

  // Extreme elevation - hero elements
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',

  // Inner shadow - pressed states, inset elements
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  innerMd: 'inset 0 4px 6px 0 rgba(0, 0, 0, 0.1)',
} as const;

// ============================================================
// DARK MODE SHADOWS - Adjusted for dark backgrounds
// ============================================================

export const elevationDark = {
  none: 'none',

  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',

  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',

  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',

  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',

  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',

  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',

  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
  innerMd: 'inset 0 4px 6px 0 rgba(0, 0, 0, 0.4)',
} as const;

// ============================================================
// GLOW EFFECTS - Brand signature ethereal lighting
// ============================================================

export const glow = {
  // Lotus glow - primary brand
  lotus: {
    sm: `0 0 10px ${primitives.lotus[500]}40, 0 0 20px ${primitives.lotus[500]}20`,
    md: `0 0 15px ${primitives.lotus[500]}50, 0 0 30px ${primitives.lotus[500]}30`,
    lg: `0 0 20px ${primitives.lotus[500]}60, 0 0 40px ${primitives.lotus[500]}40, 0 0 60px ${primitives.lotus[500]}20`,
    xl: `0 0 30px ${primitives.lotus[500]}70, 0 0 60px ${primitives.lotus[500]}50, 0 0 90px ${primitives.lotus[500]}30`,
    // Subtle for cards/buttons
    subtle: `0 0 20px ${primitives.lotus[500]}15`,
    // Ring glow for focus states
    ring: `0 0 0 3px ${primitives.lotus[500]}40`,
  },

  // Petal glow - accent
  petal: {
    sm: `0 0 10px ${primitives.petal[500]}40, 0 0 20px ${primitives.petal[500]}20`,
    md: `0 0 15px ${primitives.petal[500]}50, 0 0 30px ${primitives.petal[500]}30`,
    lg: `0 0 20px ${primitives.petal[500]}60, 0 0 40px ${primitives.petal[500]}40`,
    subtle: `0 0 20px ${primitives.petal[500]}15`,
    ring: `0 0 0 3px ${primitives.petal[500]}40`,
  },

  // Jade glow - secondary
  jade: {
    sm: `0 0 10px ${primitives.jade[500]}40, 0 0 20px ${primitives.jade[500]}20`,
    md: `0 0 15px ${primitives.jade[500]}50, 0 0 30px ${primitives.jade[500]}30`,
    lg: `0 0 20px ${primitives.jade[500]}60, 0 0 40px ${primitives.jade[500]}40`,
    subtle: `0 0 20px ${primitives.jade[500]}15`,
    ring: `0 0 0 3px ${primitives.jade[500]}40`,
  },

  // Gold glow - highlights
  gold: {
    sm: `0 0 10px ${primitives.gold[500]}40, 0 0 20px ${primitives.gold[500]}20`,
    md: `0 0 15px ${primitives.gold[500]}50, 0 0 30px ${primitives.gold[500]}30`,
    lg: `0 0 20px ${primitives.gold[500]}60, 0 0 40px ${primitives.gold[500]}40`,
    subtle: `0 0 20px ${primitives.gold[500]}15`,
    ring: `0 0 0 3px ${primitives.gold[500]}40`,
  },

  // Semantic glows
  success: {
    sm: '0 0 10px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.2)',
    ring: '0 0 0 3px rgba(16, 185, 129, 0.4)',
  },
  error: {
    sm: '0 0 10px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.2)',
    ring: '0 0 0 3px rgba(239, 68, 68, 0.4)',
  },
  warning: {
    sm: '0 0 10px rgba(245, 158, 11, 0.4), 0 0 20px rgba(245, 158, 11, 0.2)',
    ring: '0 0 0 3px rgba(245, 158, 11, 0.4)',
  },

  // White glow - for dark mode highlights
  white: {
    sm: '0 0 10px rgba(255, 255, 255, 0.1), 0 0 20px rgba(255, 255, 255, 0.05)',
    md: '0 0 15px rgba(255, 255, 255, 0.15), 0 0 30px rgba(255, 255, 255, 0.08)',
  },
} as const;

// ============================================================
// FOCUS RINGS - Accessibility-focused visible indicators
// ============================================================

export const focusRing = {
  // Default focus ring (lotus branded)
  default: `0 0 0 2px ${primitives.night[800]}, 0 0 0 4px ${primitives.lotus[500]}`,

  // Offset focus ring (with gap)
  offset: `0 0 0 2px ${primitives.night[800]}, 0 0 0 4px ${primitives.lotus[500]}`,

  // Inset focus ring (inside element)
  inset: `inset 0 0 0 2px ${primitives.lotus[500]}`,

  // Error state focus
  error: `0 0 0 2px ${primitives.night[800]}, 0 0 0 4px #ef4444`,

  // Success state focus
  success: `0 0 0 2px ${primitives.night[800]}, 0 0 0 4px #10b981`,

  // Subtle focus (less prominent)
  subtle: `0 0 0 1px ${primitives.lotus[500]}80`,

  // Glow focus (branded, more prominent)
  glow: `0 0 0 2px ${primitives.night[800]}, 0 0 0 4px ${primitives.lotus[500]}, ${glow.lotus.sm}`,

  // Light mode variants
  light: {
    default: `0 0 0 2px #ffffff, 0 0 0 4px ${primitives.lotus[600]}`,
    offset: `0 0 0 2px #ffffff, 0 0 0 4px ${primitives.lotus[600]}`,
    inset: `inset 0 0 0 2px ${primitives.lotus[600]}`,
  },
} as const;

// ============================================================
// COMBINED SHADOW PRESETS - Common use cases
// ============================================================

export const shadowPresets = {
  // Card shadows with subtle glow
  card: {
    default: elevationDark.sm,
    hover: `${elevationDark.md}, ${glow.lotus.subtle}`,
    active: elevationDark.xs,
  },

  // Button shadows
  button: {
    default: elevationDark.xs,
    hover: elevationDark.sm,
    active: elevationDark.inner,
    primary: {
      default: `${elevationDark.sm}, ${glow.lotus.subtle}`,
      hover: `${elevationDark.md}, ${glow.lotus.sm}`,
      active: elevationDark.xs,
    },
  },

  // Input shadows
  input: {
    default: 'none',
    focus: focusRing.default,
    error: focusRing.error,
  },

  // Modal/Dialog shadows
  modal: {
    default: `${elevationDark['2xl']}, ${glow.lotus.subtle}`,
  },

  // Dropdown/Popover shadows
  dropdown: {
    default: `${elevationDark.lg}, 0 0 0 1px ${primitives.night[600]}`,
  },

  // Toast/Notification shadows
  toast: {
    default: elevationDark.xl,
    success: `${elevationDark.xl}, ${glow.success.sm}`,
    error: `${elevationDark.xl}, ${glow.error.sm}`,
    warning: `${elevationDark.xl}, ${glow.warning.sm}`,
  },

  // Floating action button
  fab: {
    default: `${elevationDark.lg}, ${glow.lotus.sm}`,
    hover: `${elevationDark.xl}, ${glow.lotus.md}`,
  },
} as const;

// ============================================================
// TEXT SHADOWS - For text effects
// ============================================================

export const textShadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 2px 4px rgba(0, 0, 0, 0.3)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.4)',

  // Glow text effects
  glow: {
    lotus: `0 0 10px ${primitives.lotus[500]}80, 0 0 20px ${primitives.lotus[500]}40`,
    petal: `0 0 10px ${primitives.petal[500]}80, 0 0 20px ${primitives.petal[500]}40`,
    jade: `0 0 10px ${primitives.jade[500]}80, 0 0 20px ${primitives.jade[500]}40`,
    gold: `0 0 10px ${primitives.gold[500]}80, 0 0 20px ${primitives.gold[500]}40`,
    white: '0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(255, 255, 255, 0.3)',
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Elevation = typeof elevation;
export type ElevationDark = typeof elevationDark;
export type Glow = typeof glow;
export type FocusRing = typeof focusRing;
export type ShadowPresets = typeof shadowPresets;
export type TextShadow = typeof textShadow;
