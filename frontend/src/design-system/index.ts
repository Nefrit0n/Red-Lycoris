/**
 * Lotus Warden Design System
 *
 * A comprehensive design system inspired by the lotus flower -
 * emerging from darkness into light, symbolizing the journey
 * of security: finding vulnerabilities in the shadows and
 * bringing clarity through illumination.
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
// FUTURE EXPORTS (placeholders for Phase 3+)
// ============================================================

// Components will be exported here in Phase 3
// export * from './components';

// ============================================================
// VERSION INFO
// ============================================================

export const DESIGN_SYSTEM_VERSION = '1.0.0';

export const DESIGN_SYSTEM_INFO = {
  name: 'Lotus Warden Design System',
  version: DESIGN_SYSTEM_VERSION,
  description: 'Design tokens and components for Lotus Warden security platform',
  author: 'Lotus Warden Team',
} as const;
