/**
 * Tests for useReducedMotion hook
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion, reducedMotionStyles, reducedMotionSx } from '../useReducedMotion';

describe('useReducedMotion', () => {
  // Store original matchMedia
  const originalMatchMedia = window.matchMedia;

  // Mock matchMedia
  const createMatchMedia = (matches: boolean) => {
    return (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  };

  afterEach(() => {
    // Restore original matchMedia
    window.matchMedia = originalMatchMedia;
  });

  it('should return false when user does not prefer reduced motion', () => {
    window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current.prefersReducedMotion).toBe(false);
  });

  it('should return true when user prefers reduced motion', () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current.prefersReducedMotion).toBe(true);
  });

  it('should provide the correct media query string', () => {
    window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current.mediaQuery).toBe('(prefers-reduced-motion: reduce)');
  });

  describe('getTransition', () => {
    it('should return normal transition when reduced motion is not preferred', () => {
      window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getTransition('all 0.3s ease')).toBe('all 0.3s ease');
    });

    it('should return "none" when reduced motion is preferred', () => {
      window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getTransition('all 0.3s ease')).toBe('none');
    });
  });

  describe('getDuration', () => {
    it('should return normal duration when reduced motion is not preferred', () => {
      window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getDuration('300ms')).toBe('300ms');
      expect(result.current.getDuration(300)).toBe('300ms');
    });

    it('should return "0ms" when reduced motion is preferred', () => {
      window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getDuration('300ms')).toBe('0ms');
      expect(result.current.getDuration(300)).toBe('0ms');
    });
  });

  describe('getAnimation', () => {
    it('should return normal animation when reduced motion is not preferred', () => {
      window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getAnimation('fadeIn 0.5s ease')).toBe('fadeIn 0.5s ease');
    });

    it('should return "none" when reduced motion is preferred', () => {
      window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;

      const { result } = renderHook(() => useReducedMotion());

      expect(result.current.getAnimation('fadeIn 0.5s ease')).toBe('none');
    });
  });
});

describe('reducedMotionStyles', () => {
  it('should return styles with media query for reduced motion', () => {
    const styles = reducedMotionStyles({
      transition: 'all 0.3s ease',
      animation: 'fadeIn 0.5s',
    });

    expect(styles.transition).toBe('all 0.3s ease');
    expect(styles.animation).toBe('fadeIn 0.5s');
    expect(styles['@media (prefers-reduced-motion: reduce)']).toEqual({
      transition: 'none',
      animation: 'none',
    });
  });

  it('should handle transform property', () => {
    const styles = reducedMotionStyles({
      transition: 'all 0.3s ease',
      transform: 'translateY(-2px)',
    });

    expect(styles['@media (prefers-reduced-motion: reduce)']).toEqual({
      transition: 'none',
      animation: 'none',
      transform: 'none',
    });
  });
});

describe('reducedMotionSx', () => {
  it('should return sx prop with media query for reduced motion', () => {
    const sx = reducedMotionSx({
      transition: 'all 0.3s ease',
      backgroundColor: 'red',
    });

    expect(sx.transition).toBe('all 0.3s ease');
    expect(sx.backgroundColor).toBe('red');
    expect(sx['@media (prefers-reduced-motion: reduce)']).toEqual({
      transition: 'none !important',
      animation: 'none !important',
    });
  });
});
