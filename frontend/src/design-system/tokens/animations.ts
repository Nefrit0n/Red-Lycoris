/**
 * Lotus Warden Design System - Animation & Motion Tokens
 *
 * Motion design that feels fluid and natural, like water ripples
 * around a lotus flower. Animations should feel responsive yet
 * calm, never jarring or aggressive.
 *
 * Principles:
 * - Quick acknowledgment (< 100ms for feedback)
 * - Natural easing (ease-out for entrances, ease-in for exits)
 * - Purposeful motion (every animation serves a purpose)
 * - Respect user preferences (prefers-reduced-motion)
 */

// ============================================================
// DURATION - How long animations take
// ============================================================

export const duration = {
  // Instant - immediate feedback
  instant: '0ms',

  // Ultra fast - micro-interactions
  fastest: '50ms',

  // Fast - quick feedback, hovers
  fast: '100ms',

  // Normal - standard transitions
  normal: '150ms',

  // Medium - moderate transitions
  medium: '200ms',

  // Moderate - comfortable transitions
  moderate: '250ms',

  // Slow - deliberate transitions
  slow: '300ms',

  // Slower - entrance/exit animations
  slower: '400ms',

  // Slowest - complex animations
  slowest: '500ms',

  // Extra slow - dramatic effect
  dramatic: '700ms',

  // Long - page transitions
  long: '1000ms',

  // Semantic durations
  hover: '150ms',
  focus: '150ms',
  active: '100ms',
  enter: '200ms',
  exit: '150ms',
  expand: '250ms',
  collapse: '200ms',
  fade: '200ms',
  slide: '300ms',
  modal: '300ms',
  page: '400ms',
} as const;

// ============================================================
// EASING - Animation curves
// ============================================================

export const easing = {
  // Linear - constant speed
  linear: 'linear',

  // Standard easings
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',

  // Custom cubic-bezier curves

  // Smooth - gentle, natural feeling
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Emphasized - more dramatic
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',

  // Decelerate - quick start, slow end (for entrances)
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',

  // Accelerate - slow start, quick end (for exits)
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',

  // Spring-like - slight overshoot
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Bounce - playful overshoot
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',

  // Elastic - rubber band effect
  elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',

  // Sharp - quick and decisive
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',

  // Soft - very gentle
  soft: 'cubic-bezier(0.25, 0.1, 0.25, 1)',

  // Semantic easings
  enter: 'cubic-bezier(0, 0, 0.2, 1)',       // decelerate
  exit: 'cubic-bezier(0.4, 0, 1, 1)',         // accelerate
  hover: 'cubic-bezier(0.4, 0, 0.2, 1)',      // smooth
  interactive: 'cubic-bezier(0.4, 0, 0.2, 1)', // smooth
  modal: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // spring
} as const;

// ============================================================
// KEYFRAMES - Reusable animation definitions
// ============================================================

export const keyframes = {
  // Fade animations
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },

  // Slide animations
  slideInUp: {
    from: { transform: 'translateY(10px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInDown: {
    from: { transform: 'translateY(-10px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  slideInLeft: {
    from: { transform: 'translateX(-10px)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },
  slideInRight: {
    from: { transform: 'translateX(10px)', opacity: 0 },
    to: { transform: 'translateX(0)', opacity: 1 },
  },
  slideOutUp: {
    from: { transform: 'translateY(0)', opacity: 1 },
    to: { transform: 'translateY(-10px)', opacity: 0 },
  },
  slideOutDown: {
    from: { transform: 'translateY(0)', opacity: 1 },
    to: { transform: 'translateY(10px)', opacity: 0 },
  },

  // Scale animations
  scaleIn: {
    from: { transform: 'scale(0.95)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
  scaleOut: {
    from: { transform: 'scale(1)', opacity: 1 },
    to: { transform: 'scale(0.95)', opacity: 0 },
  },
  scaleInBounce: {
    '0%': { transform: 'scale(0.9)', opacity: 0 },
    '70%': { transform: 'scale(1.02)', opacity: 1 },
    '100%': { transform: 'scale(1)', opacity: 1 },
  },

  // Pulse animations
  pulse: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
  pulseSoft: {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.7 },
  },

  // Shimmer animation (for loading states)
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },

  // Spin animation
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },

  // Ping animation (for notifications)
  ping: {
    '0%': { transform: 'scale(1)', opacity: 1 },
    '75%, 100%': { transform: 'scale(2)', opacity: 0 },
  },

  // Bounce animation
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' },
  },

  // Shake animation (for errors)
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
  },

  // Glow pulse (lotus signature)
  glowPulse: {
    '0%, 100%': {
      boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)',
    },
    '50%': {
      boxShadow: '0 0 30px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)',
    },
  },

  // Float animation (gentle up/down)
  float: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-6px)' },
  },

  // Ripple effect
  ripple: {
    '0%': { transform: 'scale(0)', opacity: 0.5 },
    '100%': { transform: 'scale(4)', opacity: 0 },
  },

  // Expand/Collapse
  expandHeight: {
    from: { height: '0', opacity: 0 },
    to: { height: 'var(--height)', opacity: 1 },
  },
  collapseHeight: {
    from: { height: 'var(--height)', opacity: 1 },
    to: { height: '0', opacity: 0 },
  },

  // Modal specific
  modalEnter: {
    from: {
      opacity: 0,
      transform: 'scale(0.95) translateY(10px)',
    },
    to: {
      opacity: 1,
      transform: 'scale(1) translateY(0)',
    },
  },
  modalExit: {
    from: {
      opacity: 1,
      transform: 'scale(1) translateY(0)',
    },
    to: {
      opacity: 0,
      transform: 'scale(0.95) translateY(10px)',
    },
  },

  // Drawer specific
  drawerEnterLeft: {
    from: { transform: 'translateX(-100%)' },
    to: { transform: 'translateX(0)' },
  },
  drawerExitLeft: {
    from: { transform: 'translateX(0)' },
    to: { transform: 'translateX(-100%)' },
  },
  drawerEnterRight: {
    from: { transform: 'translateX(100%)' },
    to: { transform: 'translateX(0)' },
  },
  drawerExitRight: {
    from: { transform: 'translateX(0)' },
    to: { transform: 'translateX(100%)' },
  },

  // Toast notification
  toastEnter: {
    from: {
      transform: 'translateX(100%) scale(0.9)',
      opacity: 0,
    },
    to: {
      transform: 'translateX(0) scale(1)',
      opacity: 1,
    },
  },
  toastExit: {
    from: {
      transform: 'translateX(0) scale(1)',
      opacity: 1,
    },
    to: {
      transform: 'translateX(100%) scale(0.9)',
      opacity: 0,
    },
  },
} as const;

// ============================================================
// ANIMATION PRESETS - Ready-to-use animation strings
// ============================================================

export const animation = {
  none: 'none',

  // Fade
  fadeIn: `fadeIn ${duration.fade} ${easing.decelerate} forwards`,
  fadeOut: `fadeOut ${duration.fade} ${easing.accelerate} forwards`,

  // Slide
  slideInUp: `slideInUp ${duration.slide} ${easing.decelerate} forwards`,
  slideInDown: `slideInDown ${duration.slide} ${easing.decelerate} forwards`,
  slideInLeft: `slideInLeft ${duration.slide} ${easing.decelerate} forwards`,
  slideInRight: `slideInRight ${duration.slide} ${easing.decelerate} forwards`,
  slideOutUp: `slideOutUp ${duration.slide} ${easing.accelerate} forwards`,
  slideOutDown: `slideOutDown ${duration.slide} ${easing.accelerate} forwards`,

  // Scale
  scaleIn: `scaleIn ${duration.medium} ${easing.decelerate} forwards`,
  scaleOut: `scaleOut ${duration.fast} ${easing.accelerate} forwards`,
  scaleInBounce: `scaleInBounce ${duration.slow} ${easing.spring} forwards`,

  // Continuous
  spin: `spin ${duration.long} ${easing.linear} infinite`,
  pulse: `pulse 2s ${easing.easeInOut} infinite`,
  pulseSoft: `pulseSoft 2s ${easing.easeInOut} infinite`,
  shimmer: `shimmer 2s ${easing.linear} infinite`,
  bounce: `bounce 1s ${easing.easeInOut} infinite`,
  float: `float 3s ${easing.easeInOut} infinite`,
  glowPulse: `glowPulse 2s ${easing.easeInOut} infinite`,

  // Feedback
  shake: `shake 0.5s ${easing.sharp}`,
  ping: `ping 1s ${easing.easeOut} infinite`,

  // Component specific
  modalEnter: `modalEnter ${duration.modal} ${easing.spring} forwards`,
  modalExit: `modalExit ${duration.exit} ${easing.accelerate} forwards`,
  drawerEnter: `drawerEnterRight ${duration.slide} ${easing.decelerate} forwards`,
  drawerExit: `drawerExitRight ${duration.exit} ${easing.accelerate} forwards`,
  toastEnter: `toastEnter ${duration.slow} ${easing.spring} forwards`,
  toastExit: `toastExit ${duration.exit} ${easing.accelerate} forwards`,
} as const;

// ============================================================
// TRANSITION PRESETS - For CSS transition property
// ============================================================

export const transition = {
  none: 'none',
  all: `all ${duration.normal} ${easing.smooth}`,
  allFast: `all ${duration.fast} ${easing.smooth}`,
  allSlow: `all ${duration.slow} ${easing.smooth}`,

  // Specific properties
  colors: `color ${duration.normal} ${easing.smooth}, background-color ${duration.normal} ${easing.smooth}, border-color ${duration.normal} ${easing.smooth}`,
  opacity: `opacity ${duration.normal} ${easing.smooth}`,
  transform: `transform ${duration.normal} ${easing.smooth}`,
  shadow: `box-shadow ${duration.normal} ${easing.smooth}`,

  // Interactive states
  hover: `all ${duration.hover} ${easing.hover}`,
  focus: `all ${duration.focus} ${easing.smooth}, outline ${duration.instant} ${easing.linear}`,
  active: `all ${duration.active} ${easing.sharp}`,

  // Component-specific
  button: `all ${duration.fast} ${easing.smooth}, transform ${duration.fast} ${easing.spring}`,
  input: `border-color ${duration.fast} ${easing.smooth}, box-shadow ${duration.fast} ${easing.smooth}`,
  card: `transform ${duration.normal} ${easing.smooth}, box-shadow ${duration.normal} ${easing.smooth}`,
  modal: `opacity ${duration.modal} ${easing.smooth}, transform ${duration.modal} ${easing.spring}`,
  sidebar: `width ${duration.expand} ${easing.smooth}`,
  accordion: `height ${duration.expand} ${easing.smooth}, opacity ${duration.fade} ${easing.smooth}`,
} as const;

// ============================================================
// REDUCED MOTION - Respect user preferences
// ============================================================

export const reducedMotion = {
  // CSS media query
  query: '@media (prefers-reduced-motion: reduce)',

  // Reduced duration
  duration: {
    instant: '0ms',
    fast: '0ms',
    normal: '0ms',
    slow: '0ms',
  },

  // No animation alternative
  animation: 'none',

  // Instant transition alternative
  transition: 'none',
} as const;

// ============================================================
// TYPE EXPORTS
// ============================================================

export type Duration = typeof duration;
export type Easing = typeof easing;
export type Keyframes = typeof keyframes;
export type Animation = typeof animation;
export type Transition = typeof transition;
export type ReducedMotion = typeof reducedMotion;
