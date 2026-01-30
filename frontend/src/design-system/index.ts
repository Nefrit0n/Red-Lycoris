/**
 * RED LYCORIS Design System
 *
 * A comprehensive design system for the RED LYCORIS security platform,
 * combining bold red energy with graphite neutrals for clarity and focus.
 *
 * @example
 * // Import specific tokens
 * import { colors, typography, spacing } from '@/design-system';
 *
 * // Import everything
 * import * as designSystem from '@/design-system';
 *
 * // Import from tokens directly
 * import { primitives, darkTheme } from '@/design-system/tokens';
 */

// ============================================================
// TOKEN EXPORTS
// ============================================================

// Re-export all tokens
export * from './tokens';

// Re-export grouped token collections
export {
  colors,
  typography,
  layout,
  shadows,
  borders,
  effects,
  motion,
  tokens,
  type Tokens,
} from './tokens';

// ============================================================
// THEME EXPORTS
// ============================================================

export * from './theme';
export {
  darkTheme,
  lightTheme,
  theme,
  getTheme,
  type ThemeMode,
} from './theme';

// ============================================================
// COMPONENT EXPORTS
// ============================================================

export * from './components';
export {
  Button,
  StatusBadge,
  SeverityBadge,
  FindingStatusBadge,
  RiskBadge,
  GlassCard,
  MetricDisplay,
} from './components';

// ============================================================
// UTILITY EXPORTS
// ============================================================

export * from './utils';

// ============================================================
// VERSION INFO
// ============================================================

export const DESIGN_SYSTEM_VERSION = '1.0.0';

export const DESIGN_SYSTEM_INFO = {
  name: 'RED LYCORIS Design System',
  version: DESIGN_SYSTEM_VERSION,
  description: 'Design tokens and components for RED LYCORIS security platform',
  author: 'RED LYCORIS Team',
} as const;
