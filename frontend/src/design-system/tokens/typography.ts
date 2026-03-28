/**
 * RED LYCORIS Design System - Typography Tokens
 *
 * Type scale based on Perfect Fourth (1.333) ratio
 * This creates a harmonious, readable hierarchy that feels
 * both modern and professional.
 *
 * Base size: 16px (1rem)
 */

// ============================================================
// FONT FAMILIES
// ============================================================

export const fontFamily = {
  // Primary - Clean, modern sans-serif for UI
  sans: "'IBM Plex Sans', 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  // Monospace - For code, technical data, numbers
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",

  // Display - For large headings (optional, can use sans)
  display: "'IBM Plex Sans', 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ============================================================
// FONT SIZES - Perfect Fourth Scale (1.333)
// ============================================================

export const fontSize = {
  // Micro sizes
  '2xs': '0.625rem',   // 10px - tiny labels
  xs: '0.75rem',       // 12px - captions, badges
  sm: '0.875rem',      // 14px - secondary text, small UI

  // Base sizes
  base: '1rem',        // 16px - body text
  md: '1.125rem',      // 18px - emphasized body

  // Heading sizes
  lg: '1.25rem',       // 20px - h6, card titles
  xl: '1.5rem',        // 24px - h5, section headers
  '2xl': '1.875rem',   // 30px - h4
  '3xl': '2.25rem',    // 36px - h3
  '4xl': '3rem',       // 48px - h2, page titles
  '5xl': '3.75rem',    // 60px - h1, hero
  '6xl': '4.5rem',     // 72px - display

  // Metric/Number sizes (for dashboards)
  metric: {
    sm: '1.5rem',      // 24px - small metrics
    md: '2.25rem',     // 36px - medium metrics
    lg: '3rem',        // 48px - large metrics
    xl: '4rem',        // 64px - hero metrics
  },
} as const;

// ============================================================
// FONT WEIGHTS
// ============================================================

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

// ============================================================
// LINE HEIGHTS
// ============================================================

export const lineHeight = {
  none: 1,           // For single-line text, icons
  tight: 1.2,        // Headings
  snug: 1.375,       // Subheadings
  normal: 1.5,       // Body text
  relaxed: 1.625,    // Comfortable reading
  loose: 2,          // Spaced out text
} as const;

// ============================================================
// LETTER SPACING (Tracking)
// ============================================================

export const letterSpacing = {
  tighter: '-0.05em',  // Display headings
  tight: '-0.025em',   // Large headings
  normal: '0',         // Body text
  wide: '0.025em',     // Small caps, buttons
  wider: '0.05em',     // All caps labels
  widest: '0.1em',     // Extreme tracking
} as const;

// ============================================================
// TEXT STYLES - Precomposed typography styles
// ============================================================

export const textStyles = {
  // Display styles - Large, impactful headings
  display: {
    '2xl': {
      fontFamily: fontFamily.display,
      fontSize: fontSize['6xl'],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tighter,
    },
    xl: {
      fontFamily: fontFamily.display,
      fontSize: fontSize['5xl'],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tighter,
    },
    lg: {
      fontFamily: fontFamily.display,
      fontSize: fontSize['4xl'],
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    md: {
      fontFamily: fontFamily.display,
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    sm: {
      fontFamily: fontFamily.display,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
  },

  // Heading styles - Section and content headings
  heading: {
    h1: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize['3xl'],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    h2: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize['2xl'],
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.tight,
      letterSpacing: letterSpacing.tight,
    },
    h3: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.normal,
    },
    h4: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.normal,
    },
    h5: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.normal,
    },
    h6: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.snug,
      letterSpacing: letterSpacing.wide,
    },
  },

  // Body text styles
  body: {
    lg: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.md,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.relaxed,
      letterSpacing: letterSpacing.normal,
    },
    md: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.base,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
  },

  // Label styles - UI elements
  label: {
    lg: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.base,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.normal,
    },
    md: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.wide,
    },
  },

  // Caption and helper text
  caption: {
    md: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.normal,
    },
    sm: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize['2xs'],
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.normal,
      letterSpacing: letterSpacing.wide,
    },
  },

  // Overline - Small caps style
  overline: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },

  // Code styles
  code: {
    block: {
      fontFamily: fontFamily.mono,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.regular,
      lineHeight: lineHeight.relaxed,
      letterSpacing: letterSpacing.normal,
    },
    inline: {
      fontFamily: fontFamily.mono,
      fontSize: '0.9em', // Relative to parent
      fontWeight: fontWeight.regular,
      lineHeight: 'inherit',
      letterSpacing: letterSpacing.normal,
    },
  },

  // Metric/Number styles for dashboards
  metric: {
    hero: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.metric.xl,
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tight,
      fontVariantNumeric: 'tabular-nums',
    },
    lg: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.metric.lg,
      fontWeight: fontWeight.bold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.tight,
      fontVariantNumeric: 'tabular-nums',
    },
    md: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.metric.md,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.normal,
      fontVariantNumeric: 'tabular-nums',
    },
    sm: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.metric.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.normal,
      fontVariantNumeric: 'tabular-nums',
    },
  },

  // Button text
  button: {
    lg: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.wide,
    },
    md: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.wide,
    },
    sm: {
      fontFamily: fontFamily.sans,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      lineHeight: lineHeight.none,
      letterSpacing: letterSpacing.wide,
    },
  },

  // Link styles
  link: {
    md: {
      fontFamily: fontFamily.sans,
      fontSize: 'inherit',
      fontWeight: fontWeight.medium,
      lineHeight: 'inherit',
      letterSpacing: 'inherit',
      textDecoration: 'none' as const,
    },
    underline: {
      fontFamily: fontFamily.sans,
      fontSize: 'inherit',
      fontWeight: fontWeight.medium,
      lineHeight: 'inherit',
      letterSpacing: 'inherit',
      textDecoration: 'underline' as const,
      textUnderlineOffset: '0.2em',
    },
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type FontFamily = typeof fontFamily;
export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
export type LineHeight = typeof lineHeight;
export type LetterSpacing = typeof letterSpacing;
export type TextStyles = typeof textStyles;
