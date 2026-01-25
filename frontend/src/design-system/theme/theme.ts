/**
 * Lotus Warden Design System - MUI Theme Configuration
 *
 * Enhanced Material-UI theme built on our design tokens.
 * Provides dark and light theme variants with full
 * Lotus Warden branding.
 */

import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';
import {
  primitives,
  semantic,
  darkTheme as darkColors,
  lightTheme as lightColors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  radius,
  elevation,
  elevationDark,
  glow,
  focusRing,
  glass,
  duration,
  easing,
} from '../tokens';

// Import augmentation for type support
import './augmentation';

// ============================================================
// SHARED THEME OPTIONS (common to both themes)
// ============================================================

const sharedTypography: ThemeOptions['typography'] = {
  fontFamily: fontFamily.sans,

  // Standard MUI variants (mapped to our text styles)
  h1: {
    ...textStyles.heading.h1,
  },
  h2: {
    ...textStyles.heading.h2,
  },
  h3: {
    ...textStyles.heading.h3,
  },
  h4: {
    ...textStyles.heading.h4,
  },
  h5: {
    ...textStyles.heading.h5,
  },
  h6: {
    ...textStyles.heading.h6,
  },
  subtitle1: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
  },
  subtitle2: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
  },
  body1: {
    ...textStyles.body.md,
  },
  body2: {
    ...textStyles.body.sm,
  },
  caption: {
    ...textStyles.caption.md,
  },
  overline: {
    ...textStyles.overline,
  },
  button: {
    ...textStyles.button.md,
    textTransform: 'none' as const, // Modern approach - no uppercase
  },

  // Custom variants
  displayLg: {
    ...textStyles.display.lg,
  },
  displayMd: {
    ...textStyles.display.md,
  },
  displaySm: {
    ...textStyles.display.sm,
  },
  bodyLg: {
    ...textStyles.body.lg,
  },
  bodySm: {
    ...textStyles.body.sm,
  },
  labelLg: {
    ...textStyles.label.lg,
  },
  labelMd: {
    ...textStyles.label.md,
  },
  labelSm: {
    ...textStyles.label.sm,
  },
  metricHero: {
    ...textStyles.metric.hero,
  },
  metricLg: {
    ...textStyles.metric.lg,
  },
  metricMd: {
    ...textStyles.metric.md,
  },
  metricSm: {
    ...textStyles.metric.sm,
  },
  code: {
    ...textStyles.code.block,
  },
  codeInline: {
    ...textStyles.code.inline,
  },
};

const sharedShape: ThemeOptions['shape'] = {
  borderRadius: parseInt(radius.DEFAULT) * 16, // Convert rem to px (assuming 16px base)
};

// ============================================================
// COMPONENT OVERRIDES FACTORY
// ============================================================

const createComponentOverrides = (mode: 'dark' | 'light'): ThemeOptions['components'] => {
  const colors = mode === 'dark' ? darkColors : lightColors;
  const shadows = mode === 'dark' ? elevationDark : elevation;

  return {
    // Global styles
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${primitives.night[500]} ${primitives.night[800]}`,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: primitives.night[800],
          },
          '&::-webkit-scrollbar-thumb': {
            background: primitives.night[500],
            borderRadius: '4px',
            '&:hover': {
              background: primitives.night[400],
            },
          },
        },
        '::selection': {
          backgroundColor: alpha(primitives.lotus[500], 0.3),
          color: primitives.night[50],
        },
      },
    },

    // Button
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: radius.button,
          fontWeight: fontWeight.semibold,
          textTransform: 'none',
          transition: `all ${duration.fast} ${easing.smooth}`,
          '&:focus-visible': {
            boxShadow: focusRing.default,
          },
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: fontSize.base,
        },
        sizeMedium: {
          padding: '8px 16px',
          fontSize: fontSize.sm,
        },
        sizeSmall: {
          padding: '6px 12px',
          fontSize: fontSize.xs,
        },
        containedPrimary: {
          background: primitives.lotus[500],
          '&:hover': {
            background: primitives.lotus[400],
            boxShadow: glow.lotus.subtle,
          },
          '&:active': {
            background: primitives.lotus[600],
          },
        },
        outlinedPrimary: {
          borderColor: primitives.lotus[500],
          color: primitives.lotus[400],
          '&:hover': {
            borderColor: primitives.lotus[400],
            backgroundColor: alpha(primitives.lotus[500], 0.08),
          },
        },
        textPrimary: {
          color: primitives.lotus[400],
          '&:hover': {
            backgroundColor: alpha(primitives.lotus[500], 0.08),
          },
        },
      },
    },

    // Card
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          backgroundColor: colors.bg.surface,
          border: `1px solid ${colors.border.subtle}`,
          transition: `all ${duration.normal} ${easing.smooth}`,
          '&:hover': {
            borderColor: colors.border.interactive,
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '16px',
          '&:last-child': {
            paddingBottom: '16px',
          },
        },
      },
    },

    // Paper
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.bg.surface,
        },
        rounded: {
          borderRadius: radius.lg,
        },
      },
    },

    // Chip
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: radius.chip,
          fontWeight: fontWeight.medium,
          fontSize: fontSize.xs,
        },
        sizeSmall: {
          height: '24px',
        },
        sizeMedium: {
          height: '32px',
        },
        colorPrimary: {
          backgroundColor: alpha(primitives.lotus[500], 0.15),
          color: primitives.lotus[300],
          '&:hover': {
            backgroundColor: alpha(primitives.lotus[500], 0.25),
          },
        },
        colorSecondary: {
          backgroundColor: alpha(primitives.jade[500], 0.15),
          color: primitives.jade[300],
          '&:hover': {
            backgroundColor: alpha(primitives.jade[500], 0.25),
          },
        },
        colorSuccess: {
          backgroundColor: alpha(semantic.feedback.success.base, 0.15),
          color: semantic.feedback.success.text,
        },
        colorError: {
          backgroundColor: alpha(semantic.feedback.error.base, 0.15),
          color: semantic.feedback.error.text,
        },
        colorWarning: {
          backgroundColor: alpha(semantic.feedback.warning.base, 0.15),
          color: semantic.feedback.warning.text,
        },
        colorInfo: {
          backgroundColor: alpha(semantic.feedback.info.base, 0.15),
          color: semantic.feedback.info.text,
        },
      },
    },

    // TextField / Input
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.input,
          transition: `all ${duration.fast} ${easing.smooth}`,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.border.interactive,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: primitives.lotus[500],
            borderWidth: '2px',
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: semantic.feedback.error.base,
          },
        },
        notchedOutline: {
          borderColor: colors.border.strong,
          transition: `border-color ${duration.fast} ${easing.smooth}`,
        },
        input: {
          padding: '10px 14px',
        },
      },
    },

    // Select
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: radius.input,
        },
      },
    },

    // Menu / Dropdown
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: radius.lg,
          border: `1px solid ${colors.border.default}`,
          boxShadow: shadows.lg,
          marginTop: '4px',
        },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: radius.sm,
          margin: '2px 4px',
          padding: '8px 12px',
          fontSize: fontSize.sm,
          transition: `background-color ${duration.fast} ${easing.smooth}`,
          '&:hover': {
            backgroundColor: colors.bg.hover,
          },
          '&.Mui-selected': {
            backgroundColor: colors.bg.selected,
            '&:hover': {
              backgroundColor: colors.bg.selected,
            },
          },
        },
      },
    },

    // Table
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.xs,
            textTransform: 'uppercase',
            letterSpacing: letterSpacing.wider,
            color: colors.text.secondary,
            backgroundColor: colors.bg.subtle,
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${duration.fast} ${easing.smooth}`,
          '&:hover': {
            backgroundColor: colors.bg.hover,
          },
          '&.Mui-selected': {
            backgroundColor: colors.bg.selected,
            '&:hover': {
              backgroundColor: colors.bg.selected,
            },
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${colors.border.subtle}`,
          padding: '12px 16px',
        },
      },
    },

    // Tooltip
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.bg.elevated,
          color: colors.text.primary,
          border: `1px solid ${colors.border.default}`,
          borderRadius: radius.tooltip,
          fontSize: fontSize.xs,
          padding: '6px 10px',
          boxShadow: shadows.md,
        },
        arrow: {
          color: colors.bg.elevated,
          '&::before': {
            border: `1px solid ${colors.border.default}`,
          },
        },
      },
    },

    // Dialog / Modal
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radius.modal,
          border: `1px solid ${colors.border.subtle}`,
          boxShadow: shadows['2xl'],
          backgroundImage: 'none',
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          padding: '20px 24px 16px',
        },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px 20px',
          gap: '8px',
        },
      },
    },

    // Drawer
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${colors.border.subtle}`,
          backgroundImage: 'none',
        },
      },
    },

    // Alert
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          padding: '12px 16px',
        },
        standardSuccess: {
          backgroundColor: semantic.feedback.success.subtle,
          color: semantic.feedback.success.text,
          '& .MuiAlert-icon': {
            color: semantic.feedback.success.base,
          },
        },
        standardError: {
          backgroundColor: semantic.feedback.error.subtle,
          color: semantic.feedback.error.text,
          '& .MuiAlert-icon': {
            color: semantic.feedback.error.base,
          },
        },
        standardWarning: {
          backgroundColor: semantic.feedback.warning.subtle,
          color: semantic.feedback.warning.text,
          '& .MuiAlert-icon': {
            color: semantic.feedback.warning.base,
          },
        },
        standardInfo: {
          backgroundColor: semantic.feedback.info.subtle,
          color: semantic.feedback.info.text,
          '& .MuiAlert-icon': {
            color: semantic.feedback.info.base,
          },
        },
      },
    },

    // Tabs
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: '40px',
        },
        indicator: {
          backgroundColor: primitives.lotus[500],
          height: '2px',
          borderRadius: '2px 2px 0 0',
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: fontWeight.medium,
          fontSize: fontSize.sm,
          minHeight: '40px',
          padding: '8px 16px',
          transition: `color ${duration.fast} ${easing.smooth}`,
          '&.Mui-selected': {
            color: primitives.lotus[400],
          },
        },
      },
    },

    // Badge
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: fontWeight.semibold,
          fontSize: '10px',
        },
      },
    },

    // Avatar
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: fontWeight.semibold,
          fontSize: fontSize.sm,
        },
      },
    },

    // Skeleton
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: colors.bg.hover,
        },
      },
    },

    // LinearProgress
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: radius.full,
          backgroundColor: colors.bg.hover,
        },
        bar: {
          borderRadius: radius.full,
        },
      },
    },

    // Divider
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.border.subtle,
        },
      },
    },

    // IconButton
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          transition: `all ${duration.fast} ${easing.smooth}`,
          '&:hover': {
            backgroundColor: colors.bg.hover,
          },
          '&:focus-visible': {
            boxShadow: focusRing.subtle,
          },
        },
      },
    },

    // ListItemButton
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          transition: `all ${duration.fast} ${easing.smooth}`,
          '&:hover': {
            backgroundColor: colors.bg.hover,
          },
          '&.Mui-selected': {
            backgroundColor: colors.bg.selected,
            '&:hover': {
              backgroundColor: colors.bg.selected,
            },
          },
        },
      },
    },

    // Autocomplete
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: radius.lg,
          border: `1px solid ${colors.border.default}`,
          boxShadow: shadows.lg,
          marginTop: '4px',
        },
        option: {
          borderRadius: radius.sm,
          margin: '2px 4px',
          padding: '8px 12px',
          '&:hover': {
            backgroundColor: colors.bg.hover,
          },
          '&[aria-selected="true"]': {
            backgroundColor: colors.bg.selected,
          },
        },
      },
    },

    // Backdrop
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(5, 6, 10, 0.8)',
          backdropFilter: 'blur(4px)',
        },
      },
    },
  };
};

// ============================================================
// DARK THEME
// ============================================================

const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',

    // Primary - Lotus purple
    primary: {
      main: primitives.lotus[500],
      light: primitives.lotus[400],
      dark: primitives.lotus[600],
      contrastText: '#ffffff',
    },

    // Secondary - Jade teal
    secondary: {
      main: primitives.jade[500],
      light: primitives.jade[400],
      dark: primitives.jade[600],
      contrastText: '#ffffff',
    },

    // Error
    error: {
      main: semantic.feedback.error.base,
      light: semantic.feedback.error.light,
      dark: semantic.feedback.error.dark,
    },

    // Warning
    warning: {
      main: semantic.feedback.warning.base,
      light: semantic.feedback.warning.light,
      dark: semantic.feedback.warning.dark,
    },

    // Success
    success: {
      main: semantic.feedback.success.base,
      light: semantic.feedback.success.light,
      dark: semantic.feedback.success.dark,
    },

    // Info
    info: {
      main: semantic.feedback.info.base,
      light: semantic.feedback.info.light,
      dark: semantic.feedback.info.dark,
    },

    // Background
    background: {
      default: darkColors.bg.base,
      paper: darkColors.bg.surface,
      void: darkColors.bg.void,
      subtle: darkColors.bg.subtle,
      elevated: darkColors.bg.elevated,
      overlay: darkColors.bg.overlay,
      hover: darkColors.bg.hover,
      active: darkColors.bg.active,
      selected: darkColors.bg.selected,
    },

    // Text
    text: {
      primary: darkColors.text.primary,
      secondary: darkColors.text.secondary,
      disabled: darkColors.text.muted,
      tertiary: darkColors.text.tertiary,
      muted: darkColors.text.muted,
      inverse: darkColors.text.inverse,
      link: darkColors.text.link,
      linkHover: darkColors.text.linkHover,
    },

    // Divider
    divider: darkColors.border.subtle,

    // Action colors
    action: {
      active: darkColors.text.secondary,
      hover: darkColors.bg.hover,
      selected: darkColors.bg.selected,
      disabled: darkColors.text.muted,
      disabledBackground: darkColors.bg.hover,
    },

    // Custom brand colors
    lotus: {
      main: primitives.lotus[500],
      light: primitives.lotus[400],
      dark: primitives.lotus[600],
      contrastText: '#ffffff',
    },
    petal: {
      main: primitives.petal[500],
      light: primitives.petal[400],
      dark: primitives.petal[600],
      contrastText: '#ffffff',
    },
    jade: {
      main: primitives.jade[500],
      light: primitives.jade[400],
      dark: primitives.jade[600],
      contrastText: '#ffffff',
    },
    gold: {
      main: primitives.gold[500],
      light: primitives.gold[400],
      dark: primitives.gold[600],
      contrastText: '#000000',
    },

    // Night palette
    night: primitives.night,

    // Severity colors
    severity: {
      critical: semantic.severity.critical.base,
      high: semantic.severity.high.base,
      medium: semantic.severity.medium.base,
      low: semantic.severity.low.base,
      info: semantic.severity.info.base,
    },

    // Status colors
    status: {
      new: semantic.status.new.base,
      inProgress: semantic.status.inProgress.base,
      resolved: semantic.status.resolved.base,
      dismissed: semantic.status.dismissed.base,
    },

    // Risk colors
    risk: semantic.risk,

    // Glass effect colors
    glass: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.08)',
    },

    // Glow colors
    glow: {
      lotus: primitives.lotus[500],
      petal: primitives.petal[500],
      jade: primitives.jade[500],
      gold: primitives.gold[500],
    },
  },

  typography: sharedTypography,
  shape: sharedShape,
  components: createComponentOverrides('dark'),

  // Custom shadows
  customShadows: {
    card: elevationDark.sm,
    cardHover: `${elevationDark.md}, ${glow.lotus.subtle}`,
    button: elevationDark.xs,
    buttonHover: elevationDark.sm,
    dropdown: elevationDark.lg,
    modal: `${elevationDark['2xl']}, ${glow.lotus.subtle}`,
    glow: {
      lotus: glow.lotus.md,
      petal: glow.petal.md,
      jade: glow.jade.md,
      gold: glow.gold.md,
    },
  },

  // Glass effects
  glass: {
    subtle: glass.subtle,
    light: glass.light,
    medium: glass.medium,
    card: glass.card,
    modal: glass.modal,
  },
};

// ============================================================
// LIGHT THEME
// ============================================================

const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',

    primary: {
      main: primitives.lotus[600],
      light: primitives.lotus[500],
      dark: primitives.lotus[700],
      contrastText: '#ffffff',
    },

    secondary: {
      main: primitives.jade[600],
      light: primitives.jade[500],
      dark: primitives.jade[700],
      contrastText: '#ffffff',
    },

    error: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#b91c1c',
    },

    warning: {
      main: '#d97706',
      light: '#f59e0b',
      dark: '#b45309',
    },

    success: {
      main: '#059669',
      light: '#10b981',
      dark: '#047857',
    },

    info: {
      main: '#2563eb',
      light: '#3b82f6',
      dark: '#1d4ed8',
    },

    background: {
      default: lightColors.bg.base,
      paper: lightColors.bg.surface,
      void: lightColors.bg.void,
      subtle: lightColors.bg.subtle,
      elevated: lightColors.bg.elevated,
      overlay: lightColors.bg.overlay,
      hover: lightColors.bg.hover,
      active: lightColors.bg.active,
      selected: lightColors.bg.selected,
    },

    text: {
      primary: lightColors.text.primary,
      secondary: lightColors.text.secondary,
      disabled: lightColors.text.muted,
      tertiary: lightColors.text.tertiary,
      muted: lightColors.text.muted,
      inverse: lightColors.text.inverse,
      link: lightColors.text.link,
      linkHover: lightColors.text.linkHover,
    },

    divider: lightColors.border.subtle,

    action: {
      active: lightColors.text.secondary,
      hover: lightColors.bg.hover,
      selected: lightColors.bg.selected,
      disabled: lightColors.text.muted,
      disabledBackground: lightColors.bg.hover,
    },

    lotus: {
      main: primitives.lotus[600],
      light: primitives.lotus[500],
      dark: primitives.lotus[700],
      contrastText: '#ffffff',
    },
    petal: {
      main: primitives.petal[600],
      light: primitives.petal[500],
      dark: primitives.petal[700],
      contrastText: '#ffffff',
    },
    jade: {
      main: primitives.jade[600],
      light: primitives.jade[500],
      dark: primitives.jade[700],
      contrastText: '#ffffff',
    },
    gold: {
      main: primitives.gold[600],
      light: primitives.gold[500],
      dark: primitives.gold[700],
      contrastText: '#000000',
    },

    night: primitives.night,
    severity: {
      critical: '#7c3aed',
      high: '#dc2626',
      medium: '#d97706',
      low: '#059669',
      info: '#2563eb',
    },
    status: {
      new: '#2563eb',
      inProgress: '#d97706',
      resolved: '#059669',
      dismissed: '#6b7280',
    },
    risk: {
      critical: '#7c3aed',
      high: '#dc2626',
      medium: '#d97706',
      low: '#059669',
      none: '#6b7280',
    },
    glass: {
      background: 'rgba(0, 0, 0, 0.03)',
      border: 'rgba(0, 0, 0, 0.06)',
    },
    glow: {
      lotus: primitives.lotus[600],
      petal: primitives.petal[600],
      jade: primitives.jade[600],
      gold: primitives.gold[600],
    },
  },

  typography: sharedTypography,
  shape: sharedShape,
  components: createComponentOverrides('light'),

  customShadows: {
    card: elevation.sm,
    cardHover: elevation.md,
    button: elevation.xs,
    buttonHover: elevation.sm,
    dropdown: elevation.lg,
    modal: elevation['2xl'],
    glow: {
      lotus: `0 0 20px ${alpha(primitives.lotus[600], 0.3)}`,
      petal: `0 0 20px ${alpha(primitives.petal[600], 0.3)}`,
      jade: `0 0 20px ${alpha(primitives.jade[600], 0.3)}`,
      gold: `0 0 20px ${alpha(primitives.gold[600], 0.3)}`,
    },
  },

  glass: {
    subtle: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 0, 0, 0.06)',
    },
    light: {
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
    },
    card: {
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    },
    modal: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
    },
  },
};

// ============================================================
// CREATE THEMES
// ============================================================

export const darkTheme = createTheme(darkThemeOptions);
export const lightTheme = createTheme(lightThemeOptions);

// Default export is dark theme (primary)
export default darkTheme;

// ============================================================
// THEME UTILITIES
// ============================================================

/**
 * Get theme by mode name
 */
export const getTheme = (mode: 'dark' | 'light') => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

/**
 * Theme mode type
 */
export type ThemeMode = 'dark' | 'light' | 'system';
