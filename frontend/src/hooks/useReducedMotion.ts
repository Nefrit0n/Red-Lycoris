/**
 * useReducedMotion Hook
 *
 * Detects user's preference for reduced motion and provides
 * utilities for respecting this preference throughout the app.
 *
 * @example
 * const { prefersReducedMotion, getTransition, getDuration } = useReducedMotion();
 *
 * // Use in styles
 * const styles = {
 *   transition: getTransition('all 0.3s ease'),
 *   animationDuration: getDuration('300ms'),
 * };
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseReducedMotionReturn {
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;

  /** Get transition value respecting reduced motion preference */
  getTransition: (normalTransition: string) => string;

  /** Get duration value respecting reduced motion preference */
  getDuration: (normalDuration: string | number) => string;

  /** Get animation value respecting reduced motion preference */
  getAnimation: (normalAnimation: string) => string;

  /** CSS media query for prefers-reduced-motion */
  mediaQuery: string;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook to detect and respect user's reduced motion preference
 */
export function useReducedMotion(): UseReducedMotionReturn {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

    // Update state when preference changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const getTransition = useCallback(
    (normalTransition: string): string => {
      if (prefersReducedMotion) return 'none';
      return normalTransition;
    },
    [prefersReducedMotion]
  );

  const getDuration = useCallback(
    (normalDuration: string | number): string => {
      if (prefersReducedMotion) return '0ms';
      return typeof normalDuration === 'number' ? `${normalDuration}ms` : normalDuration;
    },
    [prefersReducedMotion]
  );

  const getAnimation = useCallback(
    (normalAnimation: string): string => {
      if (prefersReducedMotion) return 'none';
      return normalAnimation;
    },
    [prefersReducedMotion]
  );

  return {
    prefersReducedMotion,
    getTransition,
    getDuration,
    getAnimation,
    mediaQuery: REDUCED_MOTION_QUERY,
  };
}

/**
 * CSS-in-JS helper for reduced motion styles
 *
 * @example
 * const styles = {
 *   ...reducedMotionStyles({
 *     transition: 'all 0.3s ease',
 *     animation: 'fadeIn 0.5s ease',
 *   }),
 * };
 */
export const reducedMotionStyles = (normalStyles: {
  transition?: string;
  animation?: string;
  transform?: string;
}) => ({
  ...normalStyles,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    animation: 'none',
    // Keep transform for layout but remove motion
    ...(normalStyles.transform && { transform: 'none' }),
  },
});

/**
 * MUI sx prop helper for reduced motion
 *
 * @example
 * <Box sx={{ ...reducedMotionSx({ transition: 'all 0.3s' }) }} />
 */
export const reducedMotionSx = (normalSx: Record<string, unknown>) => ({
  ...normalSx,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none !important',
    animation: 'none !important',
  },
});

export default useReducedMotion;
