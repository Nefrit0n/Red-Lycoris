/**
 * Lotus Warden Design System - Color Tokens
 *
 * Philosophy: The lotus grows from dark depths toward the light.
 * Just as security illuminates hidden vulnerabilities, our palette
 * transitions from deep, mysterious backgrounds to vibrant,
 * enlightened accents.
 *
 * Color naming follows the lotus metaphor:
 * - Night Waters: Deep backgrounds (where the lotus roots)
 * - Lotus: Primary brand colors (the flower itself)
 * - Petal: Vibrant accents (individual petals catching light)
 * - Jade: Secondary cool tones (lotus leaves)
 * - Gold: Highlight color (the enlightened center)
 */

// ============================================================
// PRIMITIVE COLORS - Raw color values
// ============================================================

export const primitives = {
  // Night Waters - Deep backgrounds inspired by moonlit water
  night: {
    950: '#05060a',  // Void - deepest black with blue undertone
    900: '#08090e',  // Abyss
    850: '#0b0c12',  // Deep
    800: '#0f1117',  // Default background
    750: '#13151d',  // Subtle elevation
    700: '#171a24',  // Paper/Card
    650: '#1c2030',  // Elevated
    600: '#21263b',  // Overlay
    550: '#282e47',  // Border strong
    500: '#343c5a',  // Border medium
    450: '#424b6d',  // Border subtle
    400: '#525d80',  // Muted text
    300: '#6b7794',  // Secondary text
    200: '#8a94ad',  // Tertiary
    100: '#b0b8cc',  // Placeholder
    50:  '#e2e5ed',  // Light text on dark
  },

  // Lotus - Primary brand color (purple-pink gradient feel)
  lotus: {
    950: '#1a0a24',
    900: '#2d1040',
    800: '#4a1a6b',
    700: '#6b2494',
    600: '#8b31b8',  // Dark
    500: '#a855f7',  // Main - vibrant purple
    400: '#b97afc',  // Light
    300: '#c9a0fd',
    200: '#dbc5fe',
    100: '#ede5ff',
    50:  '#f8f5ff',
  },

  // Petal - Accent color for highlights and CTAs (pink-magenta)
  petal: {
    950: '#2a0a1f',
    900: '#4a1035',
    800: '#7a1a55',
    700: '#a32472',
    600: '#c7328f',  // Dark
    500: '#e855a8',  // Main - vibrant pink
    400: '#f080be',
    300: '#f5a5d0',
    200: '#facce4',
    100: '#fde8f3',
    50:  '#fff5fa',
  },

  // Jade - Secondary color for calm, trustworthy elements (teal-cyan)
  jade: {
    950: '#042f2e',
    900: '#064e4b',
    800: '#0a7571',
    700: '#109693',
    600: '#18b4af',  // Dark
    500: '#22d3ce',  // Main - vibrant teal
    400: '#4eeae5',
    300: '#7cf1ed',
    200: '#b0f7f5',
    100: '#dafcfb',
    50:  '#f0fffe',
  },

  // Gold - Highlight color for important elements (warm amber)
  gold: {
    950: '#2a1a00',
    900: '#4a2f00',
    800: '#7a4d00',
    700: '#a36a00',
    600: '#c98600',  // Dark
    500: '#f0a500',  // Main - rich gold
    400: '#ffbe30',
    300: '#ffd066',
    200: '#ffe299',
    100: '#fff0cc',
    50:  '#fffaeb',
  },

  // Pure
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

// ============================================================
// SEMANTIC COLORS - Contextual meaning
// ============================================================

export const semantic = {
  // Severity levels for vulnerabilities (security-specific)
  severity: {
    critical: {
      base: '#9333ea',      // Deep purple - most severe
      light: '#a855f7',
      dark: '#7c3aed',
      subtle: 'rgba(147, 51, 234, 0.15)',
      text: '#c4a5f7',
    },
    high: {
      base: '#dc2626',      // Red
      light: '#ef4444',
      dark: '#b91c1c',
      subtle: 'rgba(220, 38, 38, 0.15)',
      text: '#fca5a5',
    },
    medium: {
      base: '#ea580c',      // Orange
      light: '#f97316',
      dark: '#c2410c',
      subtle: 'rgba(234, 88, 12, 0.15)',
      text: '#fdba74',
    },
    low: {
      base: '#16a34a',      // Green
      light: '#22c55e',
      dark: '#15803d',
      subtle: 'rgba(22, 163, 74, 0.15)',
      text: '#86efac',
    },
    info: {
      base: '#0ea5e9',      // Sky blue
      light: '#38bdf8',
      dark: '#0284c7',
      subtle: 'rgba(14, 165, 233, 0.15)',
      text: '#7dd3fc',
    },
  },

  // Status colors for workflow states
  status: {
    new: {
      base: '#3b82f6',      // Blue - fresh, needs attention
      light: '#60a5fa',
      subtle: 'rgba(59, 130, 246, 0.15)',
      text: '#93c5fd',
    },
    inProgress: {
      base: '#f59e0b',      // Amber - active work
      light: '#fbbf24',
      subtle: 'rgba(245, 158, 11, 0.15)',
      text: '#fcd34d',
    },
    resolved: {
      base: '#10b981',      // Emerald - success
      light: '#34d399',
      subtle: 'rgba(16, 185, 129, 0.15)',
      text: '#6ee7b7',
    },
    dismissed: {
      base: '#6b7280',      // Gray - inactive
      light: '#9ca3af',
      subtle: 'rgba(107, 114, 128, 0.15)',
      text: '#d1d5db',
    },
  },

  // Feedback colors
  feedback: {
    success: {
      base: '#10b981',
      light: '#34d399',
      dark: '#059669',
      subtle: 'rgba(16, 185, 129, 0.15)',
      text: '#6ee7b7',
    },
    warning: {
      base: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      subtle: 'rgba(245, 158, 11, 0.15)',
      text: '#fcd34d',
    },
    error: {
      base: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      subtle: 'rgba(239, 68, 68, 0.15)',
      text: '#fca5a5',
    },
    info: {
      base: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
      subtle: 'rgba(59, 130, 246, 0.15)',
      text: '#93c5fd',
    },
  },

  // Risk bands
  risk: {
    critical: '#9333ea',
    high: '#dc2626',
    medium: '#ea580c',
    low: '#16a34a',
    none: '#6b7280',
  },
} as const;

// ============================================================
// THEME COLORS - Dark theme (primary)
// ============================================================

export const darkTheme = {
  // Backgrounds
  bg: {
    void: primitives.night[950],        // Deepest - modals overlay bg
    base: primitives.night[800],        // Main app background
    subtle: primitives.night[750],      // Slight elevation
    surface: primitives.night[700],     // Cards, papers
    elevated: primitives.night[650],    // Popovers, dropdowns
    overlay: primitives.night[600],     // Modal backgrounds
    hover: 'rgba(255, 255, 255, 0.04)', // Interactive hover
    active: 'rgba(255, 255, 255, 0.08)', // Interactive active/pressed
    selected: 'rgba(168, 85, 247, 0.12)', // Selected items (lotus tint)
  },

  // Text
  text: {
    primary: '#f4f4f5',                 // High contrast - headings
    secondary: primitives.night[200],   // Body text
    tertiary: primitives.night[300],    // Captions, hints
    muted: primitives.night[400],       // Disabled, placeholders
    inverse: primitives.night[900],     // Text on light backgrounds
    link: primitives.lotus[400],        // Links
    linkHover: primitives.lotus[300],   // Link hover
  },

  // Borders
  border: {
    subtle: primitives.night[600],      // Dividers
    default: primitives.night[550],     // Card borders
    strong: primitives.night[500],      // Input borders
    focus: primitives.lotus[500],       // Focus rings
    interactive: primitives.night[450], // Hover borders
  },

  // Brand colors
  brand: {
    primary: primitives.lotus[500],
    primaryHover: primitives.lotus[400],
    primaryActive: primitives.lotus[600],
    primarySubtle: 'rgba(168, 85, 247, 0.15)',

    secondary: primitives.jade[500],
    secondaryHover: primitives.jade[400],
    secondaryActive: primitives.jade[600],
    secondarySubtle: 'rgba(34, 211, 206, 0.15)',

    accent: primitives.petal[500],
    accentHover: primitives.petal[400],
    accentActive: primitives.petal[600],
    accentSubtle: 'rgba(232, 85, 168, 0.15)',

    gold: primitives.gold[500],
    goldHover: primitives.gold[400],
    goldSubtle: 'rgba(240, 165, 0, 0.15)',
  },

  // Interactive elements
  interactive: {
    // Primary button
    primaryBg: primitives.lotus[500],
    primaryBgHover: primitives.lotus[400],
    primaryBgActive: primitives.lotus[600],
    primaryText: '#ffffff',

    // Secondary button
    secondaryBg: 'transparent',
    secondaryBgHover: 'rgba(168, 85, 247, 0.1)',
    secondaryBgActive: 'rgba(168, 85, 247, 0.2)',
    secondaryBorder: primitives.lotus[500],
    secondaryText: primitives.lotus[400],

    // Ghost button
    ghostBg: 'transparent',
    ghostBgHover: 'rgba(255, 255, 255, 0.06)',
    ghostBgActive: 'rgba(255, 255, 255, 0.1)',
    ghostText: primitives.night[200],

    // Danger button
    dangerBg: semantic.feedback.error.base,
    dangerBgHover: semantic.feedback.error.light,
    dangerBgActive: semantic.feedback.error.dark,
    dangerText: '#ffffff',
  },
} as const;

// ============================================================
// THEME COLORS - Light theme
// ============================================================

export const lightTheme = {
  // Backgrounds
  bg: {
    void: '#000000',
    base: '#fafafa',
    subtle: '#f5f5f5',
    surface: '#ffffff',
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.08)',
    selected: 'rgba(147, 51, 234, 0.08)',
  },

  // Text
  text: {
    primary: '#18181b',
    secondary: '#52525b',
    tertiary: '#71717a',
    muted: '#a1a1aa',
    inverse: '#fafafa',
    link: primitives.lotus[600],
    linkHover: primitives.lotus[700],
  },

  // Borders
  border: {
    subtle: '#f4f4f5',
    default: '#e4e4e7',
    strong: '#d4d4d8',
    focus: primitives.lotus[500],
    interactive: '#a1a1aa',
  },

  // Brand colors (same as dark, but adjusted for light bg)
  brand: {
    primary: primitives.lotus[600],
    primaryHover: primitives.lotus[500],
    primaryActive: primitives.lotus[700],
    primarySubtle: 'rgba(147, 51, 234, 0.1)',

    secondary: primitives.jade[600],
    secondaryHover: primitives.jade[500],
    secondaryActive: primitives.jade[700],
    secondarySubtle: 'rgba(20, 184, 175, 0.1)',

    accent: primitives.petal[600],
    accentHover: primitives.petal[500],
    accentActive: primitives.petal[700],
    accentSubtle: 'rgba(199, 50, 143, 0.1)',

    gold: primitives.gold[600],
    goldHover: primitives.gold[500],
    goldSubtle: 'rgba(201, 134, 0, 0.1)',
  },

  // Interactive elements
  interactive: {
    primaryBg: primitives.lotus[600],
    primaryBgHover: primitives.lotus[500],
    primaryBgActive: primitives.lotus[700],
    primaryText: '#ffffff',

    secondaryBg: 'transparent',
    secondaryBgHover: 'rgba(147, 51, 234, 0.08)',
    secondaryBgActive: 'rgba(147, 51, 234, 0.15)',
    secondaryBorder: primitives.lotus[600],
    secondaryText: primitives.lotus[600],

    ghostBg: 'transparent',
    ghostBgHover: 'rgba(0, 0, 0, 0.04)',
    ghostBgActive: 'rgba(0, 0, 0, 0.08)',
    ghostText: '#52525b',

    dangerBg: semantic.feedback.error.base,
    dangerBgHover: semantic.feedback.error.dark,
    dangerBgActive: '#b91c1c',
    dangerText: '#ffffff',
  },
} as const;

// ============================================================
// GRADIENT PRESETS
// ============================================================

export const gradients = {
  // Brand gradients
  lotus: 'linear-gradient(135deg, #a855f7 0%, #e855a8 100%)',
  lotusSubtle: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(232, 85, 168, 0.2) 100%)',
  lotusRadial: 'radial-gradient(ellipse at top, #a855f7 0%, #e855a8 50%, transparent 100%)',

  jade: 'linear-gradient(135deg, #22d3ce 0%, #3b82f6 100%)',
  jadeSubtle: 'linear-gradient(135deg, rgba(34, 211, 206, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',

  gold: 'linear-gradient(135deg, #f0a500 0%, #ff6b6b 100%)',
  goldSubtle: 'linear-gradient(135deg, rgba(240, 165, 0, 0.2) 0%, rgba(255, 107, 107, 0.2) 100%)',

  // Severity gradients (for charts, progress bars)
  critical: 'linear-gradient(90deg, #7c3aed 0%, #9333ea 100%)',
  high: 'linear-gradient(90deg, #b91c1c 0%, #dc2626 100%)',
  medium: 'linear-gradient(90deg, #c2410c 0%, #ea580c 100%)',
  low: 'linear-gradient(90deg, #15803d 0%, #16a34a 100%)',

  // Mesh gradients for backgrounds
  meshDark: `
    radial-gradient(at 0% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(34, 211, 206, 0.1) 0%, transparent 50%),
    radial-gradient(at 100% 100%, rgba(232, 85, 168, 0.1) 0%, transparent 50%)
  `,
  meshLight: `
    radial-gradient(at 0% 0%, rgba(147, 51, 234, 0.1) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(20, 184, 175, 0.08) 0%, transparent 50%),
    radial-gradient(at 100% 100%, rgba(199, 50, 143, 0.08) 0%, transparent 50%)
  `,

  // Glass effect backgrounds
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
  glassDark: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
} as const;

// ============================================================
// ALPHA COLORS - For overlays and transparency
// ============================================================

export const alpha = {
  white: {
    5: 'rgba(255, 255, 255, 0.05)',
    10: 'rgba(255, 255, 255, 0.1)',
    15: 'rgba(255, 255, 255, 0.15)',
    20: 'rgba(255, 255, 255, 0.2)',
    30: 'rgba(255, 255, 255, 0.3)',
    40: 'rgba(255, 255, 255, 0.4)',
    50: 'rgba(255, 255, 255, 0.5)',
    60: 'rgba(255, 255, 255, 0.6)',
    70: 'rgba(255, 255, 255, 0.7)',
    80: 'rgba(255, 255, 255, 0.8)',
    90: 'rgba(255, 255, 255, 0.9)',
  },
  black: {
    5: 'rgba(0, 0, 0, 0.05)',
    10: 'rgba(0, 0, 0, 0.1)',
    15: 'rgba(0, 0, 0, 0.15)',
    20: 'rgba(0, 0, 0, 0.2)',
    30: 'rgba(0, 0, 0, 0.3)',
    40: 'rgba(0, 0, 0, 0.4)',
    50: 'rgba(0, 0, 0, 0.5)',
    60: 'rgba(0, 0, 0, 0.6)',
    70: 'rgba(0, 0, 0, 0.7)',
    80: 'rgba(0, 0, 0, 0.8)',
    90: 'rgba(0, 0, 0, 0.9)',
  },
  lotus: {
    5: 'rgba(168, 85, 247, 0.05)',
    10: 'rgba(168, 85, 247, 0.1)',
    15: 'rgba(168, 85, 247, 0.15)',
    20: 'rgba(168, 85, 247, 0.2)',
    30: 'rgba(168, 85, 247, 0.3)',
    50: 'rgba(168, 85, 247, 0.5)',
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Primitives = typeof primitives;
export type Semantic = typeof semantic;
export type DarkTheme = typeof darkTheme;
export type LightTheme = typeof lightTheme;
export type Gradients = typeof gradients;
export type Alpha = typeof alpha;
