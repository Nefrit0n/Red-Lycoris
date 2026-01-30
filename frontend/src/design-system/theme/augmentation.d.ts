/**
 * RED LYCORIS Design System - MUI Theme Augmentation
 *
 * Extends Material-UI's theme types to include our custom design tokens.
 * This provides full TypeScript support for custom palette colors,
 * typography variants, and other extensions.
 */

import '@mui/material/styles';
import '@mui/material/Typography';
import '@mui/material/Button';

// ============================================================
// PALETTE AUGMENTATION
// ============================================================

declare module '@mui/material/styles' {
  // Extend the Palette interface
  interface Palette {
    // Brand colors
    lotus: Palette['primary'];
    petal: Palette['primary'];
    jade: Palette['primary'];
    gold: Palette['primary'];

    // Night waters (backgrounds)
    night: {
      950: string;
      900: string;
      850: string;
      800: string;
      750: string;
      700: string;
      650: string;
      600: string;
      550: string;
      500: string;
      450: string;
      400: string;
      300: string;
      200: string;
      100: string;
      50: string;
    };

    // Semantic colors for security features
    severity: {
      critical: string;
      high: string;
      medium: string;
      low: string;
      info: string;
    };

    // Status colors
    status: {
      new: string;
      inProgress: string;
      resolved: string;
      dismissed: string;
    };

    // Risk bands
    risk: {
      critical: string;
      high: string;
      medium: string;
      low: string;
      none: string;
    };

    // Glass effect colors
    glass: {
      background: string;
      border: string;
    };

    // Glow colors
    glow: {
      lotus: string;
      petal: string;
      jade: string;
      gold: string;
    };
  }

  // Extend PaletteOptions for theme creation
  interface PaletteOptions {
    lotus?: PaletteOptions['primary'];
    petal?: PaletteOptions['primary'];
    jade?: PaletteOptions['primary'];
    gold?: PaletteOptions['primary'];

    night?: {
      950?: string;
      900?: string;
      850?: string;
      800?: string;
      750?: string;
      700?: string;
      650?: string;
      600?: string;
      550?: string;
      500?: string;
      450?: string;
      400?: string;
      300?: string;
      200?: string;
      100?: string;
      50?: string;
    };

    severity?: {
      critical?: string;
      high?: string;
      medium?: string;
      low?: string;
      info?: string;
    };

    status?: {
      new?: string;
      inProgress?: string;
      resolved?: string;
      dismissed?: string;
    };

    risk?: {
      critical?: string;
      high?: string;
      medium?: string;
      low?: string;
      none?: string;
    };

    glass?: {
      background?: string;
      border?: string;
    };

    glow?: {
      lotus?: string;
      petal?: string;
      jade?: string;
      gold?: string;
    };
  }

  // Extend TypeBackground for custom backgrounds
  interface TypeBackground {
    void: string;
    subtle: string;
    elevated: string;
    overlay: string;
    hover: string;
    active: string;
    selected: string;
  }

  // Extend TypeText for custom text colors
  interface TypeText {
    tertiary: string;
    muted: string;
    inverse: string;
    link: string;
    linkHover: string;
  }

  // Custom theme options
  interface ThemeOptions {
    // Custom shadows
    customShadows?: {
      card: string;
      cardHover: string;
      button: string;
      buttonHover: string;
      dropdown: string;
      modal: string;
      glow: {
        lotus: string;
        petal: string;
        jade: string;
        gold: string;
      };
    };

    // Glass effects
    glass?: {
      subtle: React.CSSProperties;
      light: React.CSSProperties;
      medium: React.CSSProperties;
      card: React.CSSProperties;
      modal: React.CSSProperties;
    };
  }

  interface Theme {
    customShadows: {
      card: string;
      cardHover: string;
      button: string;
      buttonHover: string;
      dropdown: string;
      modal: string;
      glow: {
        lotus: string;
        petal: string;
        jade: string;
        gold: string;
      };
    };

    glass: {
      subtle: React.CSSProperties;
      light: React.CSSProperties;
      medium: React.CSSProperties;
      card: React.CSSProperties;
      modal: React.CSSProperties;
    };
  }
}

// ============================================================
// TYPOGRAPHY AUGMENTATION
// ============================================================

declare module '@mui/material/styles' {
  interface TypographyVariants {
    // Display variants
    displayLg: React.CSSProperties;
    displayMd: React.CSSProperties;
    displaySm: React.CSSProperties;

    // Body variants
    bodyLg: React.CSSProperties;
    bodySm: React.CSSProperties;

    // Label variants
    labelLg: React.CSSProperties;
    labelMd: React.CSSProperties;
    labelSm: React.CSSProperties;

    // Metric variants (for dashboards)
    metricHero: React.CSSProperties;
    metricLg: React.CSSProperties;
    metricMd: React.CSSProperties;
    metricSm: React.CSSProperties;

    // Code variants
    code: React.CSSProperties;
    codeInline: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayLg?: React.CSSProperties;
    displayMd?: React.CSSProperties;
    displaySm?: React.CSSProperties;
    bodyLg?: React.CSSProperties;
    bodySm?: React.CSSProperties;
    labelLg?: React.CSSProperties;
    labelMd?: React.CSSProperties;
    labelSm?: React.CSSProperties;
    metricHero?: React.CSSProperties;
    metricLg?: React.CSSProperties;
    metricMd?: React.CSSProperties;
    metricSm?: React.CSSProperties;
    code?: React.CSSProperties;
    codeInline?: React.CSSProperties;
  }
}

// Extend Typography component props
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayLg: true;
    displayMd: true;
    displaySm: true;
    bodyLg: true;
    bodySm: true;
    labelLg: true;
    labelMd: true;
    labelSm: true;
    metricHero: true;
    metricLg: true;
    metricMd: true;
    metricSm: true;
    code: true;
    codeInline: true;
  }
}

// ============================================================
// BUTTON AUGMENTATION
// ============================================================

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    lotus: true;
    petal: true;
    jade: true;
    gold: true;
  }

  interface ButtonPropsVariantOverrides {
    glass: true;
    glow: true;
  }
}

// ============================================================
// CHIP AUGMENTATION
// ============================================================

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    lotus: true;
    petal: true;
    jade: true;
    gold: true;
    severity_critical: true;
    severity_high: true;
    severity_medium: true;
    severity_low: true;
  }
}

// ============================================================
// BADGE AUGMENTATION
// ============================================================

declare module '@mui/material/Badge' {
  interface BadgePropsColorOverrides {
    lotus: true;
    petal: true;
    jade: true;
    gold: true;
  }
}

// ============================================================
// ALERT AUGMENTATION
// ============================================================

declare module '@mui/material/Alert' {
  interface AlertPropsColorOverrides {
    lotus: true;
    petal: true;
    jade: true;
    gold: true;
  }
}

export {};
