/**
 * Application Theme Configuration
 *
 * This file re-exports the theme from the design system
 * for backward compatibility and easy migration.
 *
 * @deprecated Import from '@/design-system' or '@/design-system/theme' instead
 */

export { darkTheme as default, darkTheme, lightTheme, getTheme } from './design-system/theme';
export type { ThemeMode } from './design-system/theme';
