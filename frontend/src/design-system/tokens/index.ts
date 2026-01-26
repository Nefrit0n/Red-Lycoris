/**
 * Lotus Warden Design System - Token Exports
 *
 * Central export point for all design tokens.
 * Import from here for a clean API:
 *
 * @example
 * import { colors, typography, spacing } from '@/design-system/tokens';
 * // or
 * import * as tokens from '@/design-system/tokens';
 */

// ============================================================
// COLOR TOKENS
// ============================================================

export {
  // Primitive colors - raw values
  primitives,
  // Semantic colors - contextual meaning
  semantic,
  // Theme colors
  darkTheme,
  lightTheme,
  // Gradients
  gradients,
  // Alpha/transparency utilities
  alpha,
  // Types
  type Primitives,
  type Semantic,
  type DarkTheme,
  type LightTheme,
  type Gradients,
  type Alpha,
} from './colors';

// ============================================================
// TYPOGRAPHY TOKENS
// ============================================================

export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
  type FontFamily,
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing,
  type TextStyles,
} from './typography';

// ============================================================
// SPACING TOKENS
// ============================================================

export {
  space,
  spacing,
  negativeSpace,
  size,
  type Space,
  type Spacing,
  type NegativeSpace,
  type Size,
} from './spacing';

// ============================================================
// SHADOW TOKENS
// ============================================================

export {
  elevation,
  elevationDark,
  glow,
  focusRing,
  shadowPresets,
  textShadow,
  type Elevation,
  type ElevationDark,
  type Glow,
  type FocusRing,
  type ShadowPresets,
  type TextShadow,
} from './shadows';

// ============================================================
// BORDER TOKENS
// ============================================================

export {
  radius,
  borderWidth,
  borderStyle,
  bordersDark,
  bordersLight,
  outline,
  divider,
  componentBorders,
  type Radius,
  type BorderWidth,
  type BorderStyle,
  type BordersDark,
  type BordersLight,
  type Outline,
  type Divider,
  type ComponentBorders,
} from './borders';

// ============================================================
// EFFECT TOKENS
// ============================================================

export {
  blur,
  glass,
  overlay,
  gradients as effectGradients,
  opacity,
  filters,
  transform,
  effectPresets,
  cursor,
  type Blur,
  type Glass,
  type Overlay,
  type Opacity,
  type Filters,
  type Transform,
  type EffectPresets,
  type Cursor,
} from './effects';

// ============================================================
// ANIMATION TOKENS
// ============================================================

export {
  duration,
  easing,
  keyframes,
  animation,
  transition,
  reducedMotion,
  type Duration,
  type Easing,
  type Keyframes,
  type Animation,
  type Transition,
  type ReducedMotion,
} from './animations';

// ============================================================
// CHART TOKENS
// ============================================================

export {
  chartColors,
  chartAxis,
  chartTooltip,
  chartLegend,
  chartCursor,
  lineChartConfig,
  barChartConfig,
  pieChartConfig,
  progressBarConfig,
  type ChartColors,
  type ChartAxis,
  type ChartTooltipConfig,
} from './charts';

// ============================================================
// CONVENIENCE EXPORTS - Grouped by category
// ============================================================

import {
  primitives,
  semantic,
  darkTheme,
  lightTheme,
  gradients,
  alpha,
} from './colors';

import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} from './typography';

import {
  space,
  spacing,
  negativeSpace,
  size,
} from './spacing';

import {
  elevation,
  elevationDark,
  glow,
  focusRing,
  shadowPresets,
  textShadow,
} from './shadows';

import {
  radius,
  borderWidth,
  borderStyle,
  bordersDark,
  bordersLight,
  outline,
  divider,
  componentBorders,
} from './borders';

import {
  blur,
  glass,
  overlay,
  opacity,
  filters,
  transform,
  effectPresets,
  cursor,
} from './effects';

import {
  duration,
  easing,
  keyframes,
  animation,
  transition,
  reducedMotion,
} from './animations';

import {
  chartColors,
  chartAxis,
  chartTooltip,
  chartLegend,
  chartCursor,
  lineChartConfig,
  barChartConfig,
  pieChartConfig,
  progressBarConfig,
} from './charts';

/**
 * All color-related tokens grouped together
 */
export const colors = {
  primitives,
  semantic,
  dark: darkTheme,
  light: lightTheme,
  gradients,
  alpha,
} as const;

/**
 * All typography-related tokens grouped together
 */
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
} as const;

/**
 * All spacing and size tokens grouped together
 */
export const layout = {
  space,
  spacing,
  negativeSpace,
  size,
} as const;

/**
 * All shadow and glow tokens grouped together
 */
export const shadows = {
  elevation,
  elevationDark,
  glow,
  focusRing,
  presets: shadowPresets,
  text: textShadow,
} as const;

/**
 * All border tokens grouped together
 */
export const borders = {
  radius,
  width: borderWidth,
  style: borderStyle,
  dark: bordersDark,
  light: bordersLight,
  outline,
  divider,
  components: componentBorders,
} as const;

/**
 * All visual effect tokens grouped together
 */
export const effects = {
  blur,
  glass,
  overlay,
  opacity,
  filters,
  transform,
  presets: effectPresets,
  cursor,
} as const;

/**
 * All animation tokens grouped together
 */
export const motion = {
  duration,
  easing,
  keyframes,
  animation,
  transition,
  reducedMotion,
} as const;

/**
 * All chart visualization tokens grouped together
 */
export const charts = {
  colors: chartColors,
  axis: chartAxis,
  tooltip: chartTooltip,
  legend: chartLegend,
  cursor: chartCursor,
  line: lineChartConfig,
  bar: barChartConfig,
  pie: pieChartConfig,
  progress: progressBarConfig,
} as const;

/**
 * Complete token collection
 */
export const tokens = {
  colors,
  typography,
  layout,
  shadows,
  borders,
  effects,
  motion,
  charts,
} as const;

export type Tokens = typeof tokens;
