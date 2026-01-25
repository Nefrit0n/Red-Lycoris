/**
 * Lotus Warden Design System - Theme Exports
 *
 * @example
 * import { darkTheme, lightTheme, getTheme } from '@/design-system/theme';
 */

// Theme augmentation (must be imported for types to work)
import './augmentation';

// Export themes
export { darkTheme, lightTheme, default as theme, getTheme } from './theme';
export type { ThemeMode } from './theme';
