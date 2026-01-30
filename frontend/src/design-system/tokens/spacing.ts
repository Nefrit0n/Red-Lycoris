/**
 * RED LYCORIS Design System - Spacing Tokens
 *
 * Based on 4px grid system with a harmonic scale.
 * All spacing values are multiples of 4px for pixel-perfect alignment.
 *
 * The scale follows common UI patterns:
 * - Micro (0-8px): Icon padding, tight gaps
 * - Small (12-16px): Component internal spacing
 * - Medium (20-32px): Component gaps, section padding
 * - Large (40-64px): Layout gaps, page margins
 * - Huge (80-128px): Hero sections, major separations
 */

// ============================================================
// BASE SPACING SCALE (in pixels)
// ============================================================

export const space = {
  // Zero
  0: '0',

  // Micro - for fine adjustments
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px

  // Small - component internals
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px

  // Medium - comfortable spacing
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px

  // Large - section spacing
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px

  // Extra large - layout spacing
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  18: '4.5rem',     // 72px
  20: '5rem',       // 80px

  // Huge - major sections
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
} as const;

// ============================================================
// SEMANTIC SPACING - Named tokens for specific use cases
// ============================================================

export const spacing = {
  // Component internal spacing
  component: {
    padding: {
      xs: space[1],     // 4px - tight padding (badges, chips)
      sm: space[2],     // 8px - small padding (buttons, inputs)
      md: space[3],     // 12px - medium padding (cards header)
      lg: space[4],     // 16px - standard padding (cards)
      xl: space[6],     // 24px - comfortable padding (modals)
    },
    gap: {
      xs: space[1],     // 4px - icon-text gap
      sm: space[2],     // 8px - tight element gap
      md: space[3],     // 12px - standard gap
      lg: space[4],     // 16px - comfortable gap
      xl: space[6],     // 24px - spacious gap
    },
  },

  // Section and layout spacing
  section: {
    padding: {
      sm: space[4],     // 16px - tight section
      md: space[6],     // 24px - standard section
      lg: space[8],     // 32px - comfortable section
      xl: space[12],    // 48px - spacious section
    },
    gap: {
      sm: space[4],     // 16px - tight sections
      md: space[6],     // 24px - standard sections
      lg: space[8],     // 32px - comfortable sections
      xl: space[12],    // 48px - spacious sections
    },
  },

  // Page layout
  page: {
    padding: {
      mobile: space[4],   // 16px
      tablet: space[6],   // 24px
      desktop: space[8],  // 32px
    },
    maxWidth: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      full: '100%',
    },
  },

  // Form elements
  form: {
    inputPaddingX: space[3],    // 12px
    inputPaddingY: space[2],    // 8px
    fieldGap: space[4],         // 16px - between fields
    groupGap: space[6],         // 24px - between field groups
    labelGap: space[1.5],       // 6px - label to input
    helperGap: space[1],        // 4px - input to helper text
  },

  // Card variants
  card: {
    padding: {
      compact: space[3],  // 12px
      default: space[4],  // 16px
      comfortable: space[6], // 24px
    },
    gap: space[4],        // 16px - between card sections
    headerPadding: space[4], // 16px
    footerPadding: space[3], // 12px
  },

  // Modal/Dialog
  modal: {
    padding: space[6],    // 24px
    headerPadding: space[5], // 20px
    footerPadding: space[4], // 16px
    gap: space[4],        // 16px
  },

  // Table
  table: {
    cellPaddingX: space[4], // 16px
    cellPaddingY: space[3], // 12px
    headerPaddingY: space[3], // 12px
    rowGap: space[0],     // 0 - rows are typically touching
  },

  // List items
  list: {
    itemPaddingX: space[3], // 12px
    itemPaddingY: space[2], // 8px
    itemGap: space[1],    // 4px
    nestedIndent: space[6], // 24px
  },

  // Navigation
  nav: {
    itemPaddingX: space[3], // 12px
    itemPaddingY: space[2], // 8px
    itemGap: space[1],    // 4px
    sectionGap: space[6], // 24px
  },

  // Sidebar
  sidebar: {
    width: {
      collapsed: '72px',
      expanded: '260px',
    },
    padding: space[3],    // 12px
    itemGap: space[1],    // 4px
  },

  // Header
  header: {
    height: '64px',
    paddingX: space[4],   // 16px
    paddingY: space[3],   // 12px
  },

  // Inset (for focus rings, borders)
  inset: {
    xs: space[0.5],   // 2px
    sm: space[1],     // 4px
    md: space[2],     // 8px
  },
} as const;

// ============================================================
// NEGATIVE SPACING (for margins, transforms)
// ============================================================

export const negativeSpace = {
  '-px': '-1px',
  '-0.5': '-0.125rem',
  '-1': '-0.25rem',
  '-1.5': '-0.375rem',
  '-2': '-0.5rem',
  '-2.5': '-0.625rem',
  '-3': '-0.75rem',
  '-4': '-1rem',
  '-5': '-1.25rem',
  '-6': '-1.5rem',
  '-8': '-2rem',
  '-10': '-2.5rem',
  '-12': '-3rem',
  '-16': '-4rem',
  '-20': '-5rem',
  '-24': '-6rem',
} as const;

// ============================================================
// SIZE TOKENS (width, height)
// ============================================================

export const size = {
  // Fixed sizes
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',

  // Relative sizes
  auto: 'auto',
  full: '100%',
  screen: '100vh',
  screenWidth: '100vw',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content',

  // Icon sizes
  icon: {
    xs: '0.75rem',    // 12px
    sm: '1rem',       // 16px
    md: '1.25rem',    // 20px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '2.5rem',  // 40px
    '3xl': '3rem',    // 48px
  },

  // Avatar sizes
  avatar: {
    xs: '1.5rem',     // 24px
    sm: '2rem',       // 32px
    md: '2.5rem',     // 40px
    lg: '3rem',       // 48px
    xl: '4rem',       // 64px
    '2xl': '5rem',    // 80px
    '3xl': '6rem',    // 96px
  },

  // Button heights
  button: {
    xs: '1.5rem',     // 24px
    sm: '2rem',       // 32px
    md: '2.5rem',     // 40px
    lg: '3rem',       // 48px
    xl: '3.5rem',     // 56px
  },

  // Input heights
  input: {
    sm: '2rem',       // 32px
    md: '2.5rem',     // 40px
    lg: '3rem',       // 48px
  },
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Space = typeof space;
export type Spacing = typeof spacing;
export type NegativeSpace = typeof negativeSpace;
export type Size = typeof size;
